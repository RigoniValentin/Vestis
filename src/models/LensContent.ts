import mongoose, { Schema, Document, Types } from "mongoose";
import { QnaTopic, QNA_TOPICS } from "./CommunityPost";

export interface ILensContent extends Document {
  topic: QnaTopic;
  title: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  link?: { label: string; url: string };
  isPinned: boolean;
  isActive: boolean;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

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
