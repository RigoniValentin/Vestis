import mongoose, { Document, Schema, Types } from "mongoose";

export type SubscriptionTransferStatus =
  | "awaiting_review"
  | "approved"
  | "rejected";

/**
 * Registro de una solicitud de suscripción mediante transferencia bancaria,
 * pendiente de aprobación por el admin.
 * Al aprobarse, se actualiza User.subscription.
 */
export interface ISubscriptionTransfer extends Document {
  userId: Types.ObjectId;
  amount: number;
  currency: string;
  referenceNumber: string;
  receiptUrl: string;
  status: SubscriptionTransferStatus;
  adminNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionTransferSchema: Schema = new Schema<ISubscriptionTransfer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ARS" },
    referenceNumber: { type: String, required: true, trim: true },
    receiptUrl: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["awaiting_review", "approved", "rejected"],
      default: "awaiting_review",
      index: true,
    },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

export const SubscriptionTransferModel = mongoose.model<ISubscriptionTransfer>(
  "SubscriptionTransfer",
  SubscriptionTransferSchema
);
