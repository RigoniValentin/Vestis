import mongoose, { Schema, Document, Types } from "mongoose";

export type ReactionKey = "claridad" | "pulso" | "raiz" | "abrazo";
export const REACTION_KEYS: ReactionKey[] = [
  "claridad",
  "pulso",
  "raiz",
  "abrazo",
];

export type QnaTopic = "Consciencia" | "Emociones" | "Biología";
export const QNA_TOPICS: QnaTopic[] = ["Consciencia", "Emociones", "Biología"];

export interface ICommunityComment {
  _id?: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  createdAt?: Date;
}

export interface ICommunityPost extends Document {
  author: Types.ObjectId;
  content: string;
  imageUrl?: string;
  link?: { label: string; url: string };
  topic?: QnaTopic;
  category: string;
  type: "post" | "question" | "answer" | "sponsored";
  isFromLiz: boolean;
  marketEntry?: Types.ObjectId;
  isPinned: boolean;
  isHidden: boolean;
  reactions: Record<ReactionKey, Types.ObjectId[]>;
  savedBy: Types.ObjectId[];
  comments: ICommunityComment[];
  createdAt: Date;
  updatedAt: Date;
}

const CommunityCommentSchema = new Schema<ICommunityComment>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 600 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CommunityPostSchema = new Schema<ICommunityPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 1200 },
    imageUrl: { type: String },
    link: {
      label: { type: String, trim: true },
      url: { type: String, trim: true },
    },
    topic: { type: String, enum: QNA_TOPICS },
    category: { type: String, default: "Reflexión compartida" },
    type: {
      type: String,
      enum: ["post", "question", "answer", "sponsored"],
      default: "post",
    },
    isFromLiz: { type: Boolean, default: false },
    marketEntry: { type: Schema.Types.ObjectId, ref: "MarketEntry" },
    isPinned: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    reactions: {
      claridad: [{ type: Schema.Types.ObjectId, ref: "User" }],
      pulso: [{ type: Schema.Types.ObjectId, ref: "User" }],
      raiz: [{ type: Schema.Types.ObjectId, ref: "User" }],
      abrazo: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    savedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: { type: [CommunityCommentSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

CommunityPostSchema.index({ createdAt: -1 });
CommunityPostSchema.index({ topic: 1, createdAt: -1 });

export const CommunityPostModel = mongoose.model<ICommunityPost>(
  "CommunityPost",
  CommunityPostSchema
);
