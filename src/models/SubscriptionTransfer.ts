import mongoose, { Document, Schema, Types } from "mongoose";

export type SubscriptionTransferStatus =
  | "awaiting_review"
  | "approved"
  | "rejected";

export type SubscriptionTransferMethod = "bank" | "prex";

/**
 * Registro de una solicitud de suscripción mediante un canal de
 * transferencia (banco tradicional o billetera virtual PREX). El admin
 * revisa el comprobante y aprueba o rechaza desde el panel.
 *
 * Al aprobarse, se actualiza User.subscription.
 */
export interface ISubscriptionTransfer extends Document {
  userId: Types.ObjectId;
  amount: number;
  currency: string;
  method: SubscriptionTransferMethod;

  /** Comprobante del canal "bank" (transferencia bancaria). */
  referenceNumber?: string;
  receiptUrl?: string;

  /** Comprobante del canal "prex" (billetera virtual). */
  prexReferenceNumber?: string;
  prexReceiptUrl?: string;

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
    method: {
      type: String,
      enum: ["bank", "prex"],
      default: "bank",
      required: true,
    },

    referenceNumber: { type: String, trim: true },
    receiptUrl: { type: String, trim: true },

    prexReferenceNumber: { type: String, trim: true },
    prexReceiptUrl: { type: String, trim: true },

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