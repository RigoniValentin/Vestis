import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { UserModel } from "@models/Users";
import { dispatchCommunityWebhook } from "@services/communityWebhookService";

const COMMUNITY_ROOM = "community";
const MARKET_ROOM = "community:market";
const ADMINS_ROOM = "community:admins";

let io: Server | null = null;

const userRoom = (userId: string) => `community:user:${userId}`;
const topicRoom = (topic: string) => `community:qna:${topic}`;

const getId = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const emitToRooms = (rooms: string[], event: string, payload: unknown) => {
  if (!io) return;
  const targetRooms = Array.from(new Set(rooms.filter(Boolean)));
  let target: any = io;
  targetRooms.forEach((room) => {
    target = target.to(room);
  });
  target.emit(event, payload);
  void dispatchCommunityWebhook(event, payload);
};

const emitToAll = (event: string, payload: unknown) => {
  if (!io) return;
  io.emit(event, payload);
  void dispatchCommunityWebhook(event, payload);
};

const getSocketToken = (socket: Socket): string | undefined => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");
  return typeof token === "string" ? token.replace(/^"|"$/g, "") : undefined;
};

const resolveSocketUser = async (socket: Socket) => {
  const token = getSocketToken(socket);
  const secret = process.env.JWT_SECRET as string;
  if (!token || !secret) return null;

  const decoded = jwt.verify(token, secret) as any;
  const userId = decoded?.id || decoded?._id;
  if (!userId) return null;

  const user = await UserModel.findById(userId)
    .populate("roles")
    .select("_id name username avatarUrl roles")
    .lean();
  if (!user) return null;

  const isAdmin = !!(user as any).roles?.some((role: any) =>
    ["admin", "superadmin"].includes(role?.name)
  );

  return {
    id: String((user as any)._id),
    isAdmin,
    name: (user as any).name,
    username: (user as any).username,
    avatarUrl: (user as any).avatarUrl,
  };
};

const setupCommunitySocket = async (socket: Socket) => {
  socket.join(COMMUNITY_ROOM);
  socket.join(MARKET_ROOM);

  try {
    const user = await resolveSocketUser(socket);
    if (user) {
      socket.data.communityUser = user;
      socket.join(userRoom(user.id));
      if (user.isAdmin) socket.join(ADMINS_ROOM);
    }
  } catch (error: any) {
    socket.emit("community:auth:error", {
      message: "No se pudo autenticar el canal realtime de comunidad",
    });
  }

  socket.on(
    "community:join",
    (payload?: { topic?: string; view?: "feed" | "qna" | "market" | "saved" }) => {
      socket.join(COMMUNITY_ROOM);
      if (payload?.view === "market") socket.join(MARKET_ROOM);
      if (payload?.topic && payload.topic !== "Todas") {
        socket.join(topicRoom(payload.topic));
      }
    }
  );

  socket.on("community:leave-topic", (topic?: string) => {
    if (topic) socket.leave(topicRoom(topic));
  });
};

export const initCommunityRealtime = (server: Server) => {
  io = server;
  io.on("connection", (socket) => {
    void setupCommunitySocket(socket);
  });
};

export const emitPostCreated = (post: any) => {
  const payload = { post };
  const rooms = [COMMUNITY_ROOM];
  if (post?.topic) rooms.push(topicRoom(String(post.topic)));
  emitToRooms(rooms, "community:post:created", payload);
  emitAdminSummaryStale();
};

export const emitPostUpdated = (post: any, action: string) => {
  const payload = { post, action };
  const rooms = [COMMUNITY_ROOM];
  if (post?.topic) rooms.push(topicRoom(String(post.topic)));
  emitToRooms(rooms, "community:post:updated", payload);
};

export const emitPostDeleted = (postId: string) => {
  emitToRooms([COMMUNITY_ROOM], "community:post:deleted", { postId });
  emitAdminSummaryStale();
};

export const emitPostSaved = (postId: string, userId: string, saved: boolean) => {
  emitToRooms([userRoom(userId)], "community:post:saved", { postId, userId, saved });
};

export const emitMarketCreated = (entry: any) => {
  emitToRooms([COMMUNITY_ROOM, MARKET_ROOM], "community:market:created", { entry });
  emitAdminSummaryStale();
};

export const emitMarketUpdated = (entry: any) => {
  emitToRooms([COMMUNITY_ROOM, MARKET_ROOM], "community:market:updated", { entry });
  emitAdminSummaryStale();
};

export const emitMarketDeleted = (entryId: string) => {
  emitToRooms([COMMUNITY_ROOM, MARKET_ROOM], "community:market:deleted", { entryId });
  emitAdminSummaryStale();
};

export const emitCommunityNotification = (notification: any) => {
  const recipientId = getId(notification?.recipient);
  if (!recipientId) return;
  emitToRooms([userRoom(recipientId)], "community:notification:created", {
    notification,
  });
  emitAdminSummaryStale();
};

export const emitNotificationsRead = (userId: string) => {
  emitToRooms([userRoom(userId)], "community:notifications:read", { userId });
};

export const emitProfileUpdated = (user: {
  userId: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
}) => {
  emitToRooms([COMMUNITY_ROOM, userRoom(user.userId)], "community:profile:updated", user);
};

export const emitAdminSummaryStale = () => {
  emitToRooms([ADMINS_ROOM], "community:admin:summary:stale", {
    changedAt: new Date().toISOString(),
  });
};

export const emitCommunityWebhookEvent = (event: string, payload: unknown) => {
  emitToAll(event, payload);
};

export const emitLensContentCreated = (item: any) => {
  const payload = { item };
  const rooms = [COMMUNITY_ROOM];
  if (item?.topic) rooms.push(topicRoom(String(item.topic)));
  emitToRooms(rooms, "community:lens-content:created", payload);
  emitAdminSummaryStale();
};

export const emitLensContentUpdated = (item: any, action = "update") => {
  const payload = { item, action };
  const rooms = [COMMUNITY_ROOM];
  if (item?.topic) rooms.push(topicRoom(String(item.topic)));
  emitToRooms(rooms, "community:lens-content:updated", payload);
};

export const emitLensContentDeleted = (itemId: string) => {
  emitToRooms([COMMUNITY_ROOM], "community:lens-content:deleted", { itemId });
  emitAdminSummaryStale();
};
