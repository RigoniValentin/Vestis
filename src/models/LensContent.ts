import mongoose, { Schema, Document, Types } from "mongoose";
import { QnaTopic, QNA_TOPICS } from "./CommunityPost";

export interface ILensAttachment {
  url: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

export interface ILensContent extends Document {
  topic: QnaTopic;
  title: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  link?: { label: string; url: string };
  attachments?: ILensAttachment[];
  isPinned: boolean;
  isActive: boolean;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LensAttachmentSchema = new Schema<ILensAttachment>(
  {
    url: { type: String, required: true, trim: true, maxlength: 500 },
    originalName: { type: String, trim: true, maxlength: 255 },
    mimeType: { type: String, trim: true, maxlength: 120 },
    size: { type: Number },
  },
  { _id: false }
);

const LensContentSchema = new Schema<ILensContent>(
  {
    topic: { type: String, enum: QNA_TOPICS, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, trim: true, maxlength: 4000 },
    imageUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    link: {
      label: { type: String, trim: true, maxlength: 80 },
      url: { type: String, trim: true, maxlength: 500 },
    },
    attachments: {
      type: [LensAttachmentSchema],
      default: [],
    },
    isPinned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

LensContentSchema.index({ topic: 1, isPinned: -1, createdAt: -1 });

export const LensContentModel = mongoose.model<ILensContent>(
  "LensContent",
  LensContentSchema
);
