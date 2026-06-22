import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICommunityNotification extends Document {
  recipient: Types.ObjectId;
  actor?: Types.ObjectId;
  type: "reaction" | "comment" | "answer" | "system";
  text: string;
  icon: string;
  link?: string;
  postId?: Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const CommunityNotificationSchema = new Schema<ICommunityNotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: ["reaction", "comment", "answer", "system"],
      required: true,
    },
    text: { type: String, required: true },
    icon: { type: String, default: "💜" },
    link: { type: String },
    postId: { type: Schema.Types.ObjectId, ref: "CommunityPost" },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

CommunityNotificationSchema.index({ recipient: 1, createdAt: -1 });

export const CommunityNotificationModel = mongoose.model<ICommunityNotification>(
  "CommunityNotification",
  CommunityNotificationSchema
);
