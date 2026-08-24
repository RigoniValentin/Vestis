import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDocumentaryPlayCounter extends Document {
  userId: Types.ObjectId;
  documentarySlug: string;
  playsUsed: number;
  lastPlayAt?: Date;
  lastResetAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentaryPlayCounterSchema: Schema = new Schema<IDocumentaryPlayCounter>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentarySlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    playsUsed: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastPlayAt: { type: Date },
    lastResetAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

DocumentaryPlayCounterSchema.index(
  { userId: 1, documentarySlug: 1 },
  { unique: true }
);

export const DocumentaryPlayCounterModel = mongoose.model<IDocumentaryPlayCounter>(
  "DocumentaryPlayCounter",
  DocumentaryPlayCounterSchema
);