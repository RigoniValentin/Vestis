import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMarketEntry extends Document {
  owner: Types.ObjectId;
  brand: string;
  category: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  isActive: boolean;
  isFeatured: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MarketEntrySchema = new Schema<IMarketEntry>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    brand: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 600 },
    url: { type: String, required: true, trim: true },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

MarketEntrySchema.index({ isActive: 1, isFeatured: -1, createdAt: -1 });

export const MarketEntryModel = mongoose.model<IMarketEntry>(
  "MarketEntry",
  MarketEntrySchema
);
