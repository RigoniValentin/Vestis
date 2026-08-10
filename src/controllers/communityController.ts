import { Request, Response } from "express";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import {
  CommunityPostModel,
  REACTION_KEYS,
  ReactionKey,
  QNA_TOPICS,
  QnaTopic,
} from "@models/CommunityPost";
import { MarketEntryModel } from "@models/MarketEntry";
import { CommunityNotificationModel } from "@models/CommunityNotification";
import { QuestionModel } from "@models/Question";
import { LensContentModel } from "@models/LensContent";
import { UserModel } from "@models/Users";
import {
  buildAvatarUrl,
  buildCommunityImageUrl,
  buildMarketImageUrl,
} from "@middlewares/uploadCommunity";
import {
  emitCommunityNotification,
  emitMarketCreated,
  emitMarketDeleted,
  emitMarketUpdated,
  emitNotificationsRead,
  emitPostCreated,
  emitPostDeleted,
  emitPostSaved,
  emitPostUpdated,
  emitProfileUpdated,
} from "@services/communityRealtimeService";

const isAdminUser = (req: Request): boolean => {
  const user: any = (req as any).currentUser;
  return !!user?.roles?.some((role: any) =>
    ["admin", "superadmin"].includes(role?.name)
  );
};

const isPremiumUser = (req: Request): boolean => {
  const user: any = (req as any).currentUser;
  if (!user) return false;
  if (isAdminUser(req)) return true;
  const exp = user.subscription?.expirationDate;
  return !!exp && new Date(exp) > new Date();
};

const cleanFile = async (filename?: string, subdir = "community") => {
  if (!filename) return;
  try {
    const full = path.join(process.cwd(), "uploads", subdir, filename);
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
};

const cleanFileByUrl = async (url?: string) => {
  if (!url) return;
  try {
    const relative = url.replace(/^\//, "");
    const full = path.join(process.cwd(), relative);
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
};

const POPULATE_AUTHOR = {
  path: "author",
  select: "name username avatarUrl",
};
const POPULATE_COMMENT_AUTHOR = {
  path: "comments.author",
  select: "name username avatarUrl",
};

const computeLevel = (points: number) => {
  if (points >= 350) return { name: "Faro evolutivo", badge: "🔆", min: 350 };
  if (points >= 150) return { name: "Tejedora de sentido", badge: "🪡", min: 150 };
  if (points >= 50) return { name: "Pulso consciente", badge: "💜", min: 50 };
  return { name: "Semilla despierta", badge: "🌱", min: 0 };
};

/* ─── POSTS ────────────────────────────────────── */

export const listPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { topic, view, mine, includeHidden, includeQna } = req.query;
    const canIncludeHidden = includeHidden === "true" && isAdminUser(req);
    const canIncludeQna = includeQna === "true";
    const filter: any = canIncludeHidden ? {} : { isHidden: false };

    if (topic && QNA_TOPICS.includes(topic as QnaTopic)) {
      filter.topic = topic;
    }
    if (view === "qna") {
      filter.type = { $in: ["question", "answer"] };
    } else if (view === "market") {
      filter.type = "sponsored";
    } else if (!canIncludeQna) {
      filter.type = { $nin: ["question", "answer"] };
    }
    if (mine === "true" && (req as any).currentUser?.id) {
      filter.author = (req as any).currentUser.id;
    }

    const posts = await CommunityPostModel.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(150)
      .populate(POPULATE_AUTHOR)
      .populate(POPULATE_COMMENT_AUTHOR)
      .populate("marketEntry", "brand category title url imageUrl");

    res.json({ success: true, data: posts });
  } catch (error: any) {
    console.error("listPosts error:", error);
    res.status(500).json({ message: "Error listando posts" });
  }
};

export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const { content, topic, category, type, link, postAsLiz } = req.body || {};

    if (!content || String(content).trim().length < 1) {
      res.status(400).json({ message: "El contenido es requerido" });
      return;
    }

    const finalType: "post" | "question" | "answer" = ["question", "answer"].includes(type)
      ? type
      : "post";

    // Solo premium o admin pueden hacer preguntas a Liz
    if (finalType === "question" && !isPremiumUser(req)) {
      res.status(403).json({ message: "Necesitás suscripción para enviar preguntas" });
      return;
    }
    // Solo admins pueden publicar como respuesta oficial de Liz
    const fromLiz = !!postAsLiz && isAdminUser(req);
    if (finalType === "answer" && !isAdminUser(req)) {
      res.status(403).json({ message: "Solo administradores pueden responder oficialmente" });
      return;
    }

    const post = await CommunityPostModel.create({
      author: userId,
      content: String(content).trim(),
      imageUrl: req.file ? buildCommunityImageUrl(req.file.filename) : undefined,
      topic: QNA_TOPICS.includes(topic as QnaTopic) ? topic : undefined,
      category:
        category ||
        (finalType === "question"
          ? `Pregunta · ${topic || "General"}`
          : finalType === "answer"
          ? "Q&A respondida"
          : "Reflexión compartida"),
      type: finalType,
      isFromLiz: fromLiz,
      link: link?.url ? { label: link.label || "Ver más", url: link.url } : undefined,
    });

    let adminNotifications: any[] = [];

    // Si es pregunta, notificar a todos los admins
    if (finalType === "question") {
      const admins = await UserModel.find().populate("roles").lean();
      const adminIds = admins
        .filter((u: any) =>
          u.roles?.some((r: any) => ["admin", "superadmin"].includes(r?.name))
        )
        .map((u: any) => u._id);
      if (adminIds.length > 0) {
        adminNotifications = await CommunityNotificationModel.insertMany(
          adminIds.map((id) => ({
            recipient: id,
            actor: userId,
            type: "system",
            text: `Nueva pregunta en ${topic || "Comunidad"}`,
            icon: "💌",
            postId: post._id,
          }))
        );
      }
    }

    const populated = await CommunityPostModel.findById(post._id)
      .populate(POPULATE_AUTHOR)
      .populate(POPULATE_COMMENT_AUTHOR);

    if (populated) emitPostCreated(populated);
    adminNotifications.forEach((notification) => emitCommunityNotification(notification));

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    console.error("createPost error:", error);
    if (req.file) await cleanFile(req.file.filename);
    res.status(500).json({ message: "Error creando post" });
  }
};

export const reactToPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const { reaction } = req.body || {};
    if (!REACTION_KEYS.includes(reaction)) {
      res.status(400).json({ message: "Reacción inválida" });
      return;
    }

    const post = await CommunityPostModel.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post no encontrado" });
      return;
    }

    let userActiveReaction: ReactionKey | null = null;
    for (const key of REACTION_KEYS) {
      const idx = post.reactions[key].findIndex(
        (id) => String(id) === String(userId)
      );
      if (idx >= 0) {
        userActiveReaction = key;
        post.reactions[key].splice(idx, 1);
      }
    }

    let notification: any = null;

    if (userActiveReaction !== reaction) {
      post.reactions[reaction as ReactionKey].push(
        new mongoose.Types.ObjectId(userId)
      );

      if (String(post.author) !== String(userId)) {
        notification = await CommunityNotificationModel.create({
          recipient: post.author,
          actor: userId,
          type: "reaction",
          icon: "✨",
          text: `Reaccionaron a tu publicación`,
          postId: post._id,
        });
      }
    }

    await post.save();
    const populated = await CommunityPostModel.findById(post._id)
      .populate(POPULATE_AUTHOR)
      .populate(POPULATE_COMMENT_AUTHOR);

    if (populated) emitPostUpdated(populated, "reaction");
    if (notification) emitCommunityNotification(notification);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error("reactToPost error:", error);
    res.status(500).json({ message: "Error reaccionando" });
  }
};

export const toggleSavePost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const post = await CommunityPostModel.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post no encontrado" });
      return;
    }
    const idx = post.savedBy.findIndex((id) => String(id) === String(userId));
    if (idx >= 0) post.savedBy.splice(idx, 1);
    else post.savedBy.push(new mongoose.Types.ObjectId(userId));
    await post.save();
    emitPostSaved(String(post._id), String(userId), idx < 0);
    res.json({ success: true, saved: idx < 0 });
  } catch (error) {
    console.error("toggleSavePost error:", error);
    res.status(500).json({ message: "Error guardando" });
  }
};

export const addComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const { content } = req.body || {};
    if (!content || String(content).trim().length < 1) {
      res.status(400).json({ message: "Comentario vacío" });
      return;
    }

    const post = await CommunityPostModel.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post no encontrado" });
      return;
    }

    post.comments.push({
      author: new mongoose.Types.ObjectId(userId),
      content: String(content).trim(),
    } as any);
    await post.save();

    let notification: any = null;

    if (String(post.author) !== String(userId)) {
      notification = await CommunityNotificationModel.create({
        recipient: post.author,
        actor: userId,
        type: "comment",
        icon: "💬",
        text: `Comentaron tu publicación`,
        postId: post._id,
      });
    }

    const populated = await CommunityPostModel.findById(post._id)
      .populate(POPULATE_AUTHOR)
      .populate(POPULATE_COMMENT_AUTHOR);
    if (populated) emitPostUpdated(populated, "comment");
    if (notification) emitCommunityNotification(notification);
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error("addComment error:", error);
    res.status(500).json({ message: "Error comentando" });
  }
};

export const deletePost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const post = await CommunityPostModel.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post no encontrado" });
      return;
    }
    if (String(post.author) !== String(userId) && !isAdminUser(req)) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    await cleanFileByUrl(post.imageUrl);
    const postId = String(post._id);
    await post.deleteOne();
    emitPostDeleted(postId);
    res.json({ success: true });
  } catch (error) {
    console.error("deletePost error:", error);
    res.status(500).json({ message: "Error eliminando" });
  }
};

export const deleteComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const post = await CommunityPostModel.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post no encontrado" });
      return;
    }
    const comment = post.comments.find(
      (c) => String(c._id) === req.params.commentId
    );
    if (!comment) {
      res.status(404).json({ message: "Comentario no encontrado" });
      return;
    }
    if (String(comment.author) !== String(userId) && !isAdminUser(req)) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    post.comments = post.comments.filter(
      (c) => String(c._id) !== req.params.commentId
    ) as any;
    await post.save();
    const populated = await CommunityPostModel.findById(post._id)
      .populate(POPULATE_AUTHOR)
      .populate(POPULATE_COMMENT_AUTHOR);
    if (populated) emitPostUpdated(populated, "comment_deleted");
    res.json({ success: true });
  } catch (error) {
    console.error("deleteComment error:", error);
    res.status(500).json({ message: "Error" });
  }
};

/* ─── ADMIN: post moderation ─────────────────── */

export const togglePinPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const post = await CommunityPostModel.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post no encontrado" });
      return;
    }
    post.isPinned = !post.isPinned;
    await post.save();
    const populated = await CommunityPostModel.findById(post._id)
      .populate(POPULATE_AUTHOR)
      .populate(POPULATE_COMMENT_AUTHOR);
    if (populated) emitPostUpdated(populated, "pin");
    res.json({ success: true, data: populated || post });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const toggleHidePost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const post = await CommunityPostModel.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post no encontrado" });
      return;
    }
    post.isHidden = !post.isHidden;
    await post.save();
    const populated = await CommunityPostModel.findById(post._id)
      .populate(POPULATE_AUTHOR)
      .populate(POPULATE_COMMENT_AUTHOR);
    if (populated) emitPostUpdated(populated, "hide");
    res.json({ success: true, data: populated || post });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/* ─── MARKET ─────────────────────────────────── */

export const listMarketEntries = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const now = new Date();
    const entries = await MarketEntryModel.find({
      isActive: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    })
      .sort({ isFeatured: -1, createdAt: -1 })
      .populate("owner", "name username avatarUrl");
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error("listMarketEntries error:", error);
    res.status(500).json({ message: "Error" });
  }
};

export const adminListMarketEntries = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const entries = await MarketEntryModel.find()
      .sort({ createdAt: -1 })
      .populate("owner", "name username email avatarUrl");
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const createMarketEntry = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const { brand, category, title, description, url, isFeatured, expiresAt, ownerId } =
      req.body || {};
    if (!brand || !category || !title || !description || !url) {
      if (req.file) await cleanFile(req.file.filename, "market");
      res.status(400).json({ message: "Faltan campos requeridos" });
      return;
    }
    const owner = isAdminUser(req) && ownerId ? ownerId : userId;

    const entry = await MarketEntryModel.create({
      owner,
      brand,
      category,
      title,
      description,
      url,
      imageUrl: req.file ? buildMarketImageUrl(req.file.filename) : undefined,
      isFeatured: isAdminUser(req) ? !!isFeatured : false,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
    const populated = await MarketEntryModel.findById(entry._id).populate(
      "owner",
      "name username avatarUrl"
    );
    if (populated) emitMarketCreated(populated);
    res.status(201).json({ success: true, data: populated || entry });
  } catch (error: any) {
    console.error("createMarketEntry error:", error);
    if (req.file) await cleanFile(req.file.filename, "market");
    res.status(500).json({ message: "Error creando entrada de market" });
  }
};

export const updateMarketEntry = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const entry = await MarketEntryModel.findById(req.params.id);
    if (!entry) {
      if (req.file) await cleanFile(req.file.filename, "market");
      res.status(404).json({ message: "Entrada no encontrada" });
      return;
    }
    if (String(entry.owner) !== String(userId) && !isAdminUser(req)) {
      if (req.file) await cleanFile(req.file.filename, "market");
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    const updatable = ["brand", "category", "title", "description", "url"];
    updatable.forEach((field) => {
      if (req.body?.[field] !== undefined) (entry as any)[field] = req.body[field];
    });
    if (isAdminUser(req)) {
      if (req.body?.isActive !== undefined)
        entry.isActive = req.body.isActive === true || req.body.isActive === "true";
      if (req.body?.isFeatured !== undefined)
        entry.isFeatured =
          req.body.isFeatured === true || req.body.isFeatured === "true";
      if (req.body?.expiresAt !== undefined)
        entry.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : undefined;
    }
    if (req.file) {
      await cleanFileByUrl(entry.imageUrl);
      entry.imageUrl = buildMarketImageUrl(req.file.filename);
    }
    await entry.save();
    const populated = await MarketEntryModel.findById(entry._id).populate(
      "owner",
      "name username avatarUrl"
    );
    if (populated) emitMarketUpdated(populated);
    res.json({ success: true, data: populated || entry });
  } catch (error) {
    console.error("updateMarketEntry error:", error);
    res.status(500).json({ message: "Error actualizando" });
  }
};

export const deleteMarketEntry = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const entry = await MarketEntryModel.findById(req.params.id);
    if (!entry) {
      res.status(404).json({ message: "No encontrada" });
      return;
    }
    if (String(entry.owner) !== String(userId) && !isAdminUser(req)) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    await cleanFileByUrl(entry.imageUrl);
    const entryId = String(entry._id);
    await entry.deleteOne();
    emitMarketDeleted(entryId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/* ─── NOTIFICATIONS ──────────────────────────── */

export const listNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const items = await CommunityNotificationModel.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const markNotificationsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    await CommunityNotificationModel.updateMany(
      { recipient: userId, read: false },
      { $set: { read: true } }
    );
    emitNotificationsRead(String(userId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/* ─── AVATAR / PROFILE ───────────────────────── */

export const uploadOwnAvatar = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "Imagen requerida" });
      return;
    }
    const user = await UserModel.findById(userId);
    if (!user) {
      await cleanFile(req.file.filename, "avatars");
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    if ((user as any).avatarUrl) {
      await cleanFileByUrl((user as any).avatarUrl);
    }
    (user as any).avatarUrl = buildAvatarUrl(req.file.filename);
    await user.save();
    emitProfileUpdated({
      userId: String((user as any)._id),
      name: (user as any).name,
      username: (user as any).username,
      avatarUrl: (user as any).avatarUrl,
      bio: (user as any).bio,
    });
    res.json({ success: true, avatarUrl: (user as any).avatarUrl });
  } catch (error) {
    console.error("uploadOwnAvatar error:", error);
    if (req.file) await cleanFile(req.file.filename, "avatars");
    res.status(500).json({ message: "Error subiendo avatar" });
  }
};

export const removeOwnAvatar = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    await cleanFileByUrl((user as any).avatarUrl);
    (user as any).avatarUrl = undefined;
    await user.save();
    emitProfileUpdated({
      userId: String((user as any)._id),
      name: (user as any).name,
      username: (user as any).username,
      avatarUrl: undefined,
      bio: (user as any).bio,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/* ─── COMMUNITY PROFILE / SUMMARY ────────────── */

export const getMyCommunityProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }
    const user = await UserModel.findById(userId).select(
      "name username email avatarUrl bio subscription"
    );
    if (!user) {
      res.status(404).json({ message: "No encontrado" });
      return;
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const postsCount = await CommunityPostModel.countDocuments({
      author: userObjectId,
    });
    const savedCount = await CommunityPostModel.countDocuments({
      savedBy: userObjectId,
    });
    const reactionsReceivedAgg = await CommunityPostModel.aggregate([
      { $match: { author: userObjectId } },
      {
        $project: {
          total: {
            $add: [
              { $size: { $ifNull: ["$reactions.claridad", []] } },
              { $size: { $ifNull: ["$reactions.pulso", []] } },
              { $size: { $ifNull: ["$reactions.raiz", []] } },
              { $size: { $ifNull: ["$reactions.abrazo", []] } },
            ],
          },
          commentsCount: { $size: { $ifNull: ["$comments", []] } },
        },
      },
      {
        $group: {
          _id: null,
          totalReactions: { $sum: "$total" },
          totalComments: { $sum: "$commentsCount" },
        },
      },
    ]);

    const totalReactions = reactionsReceivedAgg[0]?.totalReactions || 0;
    const totalComments = reactionsReceivedAgg[0]?.totalComments || 0;
    const points = postsCount * 5 + totalComments * 8 + totalReactions * 2;
    const level = computeLevel(points);
    const isPremium = isPremiumUser(req);
    const isAdmin = isAdminUser(req);

    res.json({
      success: true,
      data: {
        user,
        stats: { postsCount, savedCount, totalReactions, totalComments, points },
        level,
        isPremium,
        isAdmin,
      },
    });
  } catch (error) {
    console.error("getMyCommunityProfile error:", error);
    res.status(500).json({ message: "Error" });
  }
};

/* ─── ADMIN SUMMARY ──────────────────────────── */

export const adminCommunitySummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const [postsTotal, postsHidden, questionsOpen, marketActive, notificationsTotal, lensContentTotal] =
      await Promise.all([
        CommunityPostModel.countDocuments({}),
        CommunityPostModel.countDocuments({ isHidden: true }),
        QuestionModel.countDocuments({ status: "pending" }),
        MarketEntryModel.countDocuments({ isActive: true }),
        CommunityNotificationModel.countDocuments({}),
        LensContentModel.countDocuments({}),
      ]);
    res.json({
      success: true,
      data: {
        postsTotal,
        postsHidden,
        questionsOpen,
        marketActive,
        notificationsTotal,
        lensContentTotal,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};
