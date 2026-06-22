import mongoose, { Schema } from "mongoose";
import { Question } from "types/QuestionsTypes";

const QuestionSchema: Schema = new Schema<Question>(
  {
    text: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "answered", "rejected"],
      default: "pending",
    },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    responseType: {
      type: String,
      enum: ["text", "youtube"],
      default: undefined,
    },
    responseText: { type: String, default: undefined },
    responseVideoUrl: { type: String, default: undefined },
    respondedAt: { type: Date, default: undefined },
    answerUrls: { type: [String], default: [] },
    rejectComment: { type: String, default: undefined },
    rejectedAt: { type: Date, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

export const QuestionModel = mongoose.model<Question>(
  "Question",
  QuestionSchema
);
