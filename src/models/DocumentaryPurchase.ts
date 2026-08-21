import mongoose, { Schema, Document, Types } from "mongoose";

export type DocPurchaseMethod =
  | "paypal"
  | "mercadopago"
  | "transfer"
  | "prex"
  | "coupon"
  | "admin"
  | "free";

export type DocPurchaseStatus =
  | "pending"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "failed"
  | "refunded";

export interface IDocumentaryPurchase extends Document {
  userId: Types.ObjectId;
  documentarySlug: string;
  transactionId?: string;
  method: DocPurchaseMethod;
  amount: number;
  currency: string;
  status: DocPurchaseStatus;
  paidAt?: Date;

  // Transferencia bancaria (canal "transfer")
  transferReferenceNumber?: string;
  transferReceiptUrl?: string;

  // Billetera virtual PREX (canal "prex")
  prexReferenceNumber?: string;
  prexReceiptUrl?: string;

  adminNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const DocumentaryPurchaseSchema: Schema = new Schema<IDocumentaryPurchase>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentarySlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    transactionId: { type: String, trim: true, index: true },
    method: {
      type: String,
      required: true,
      enum: [
        "paypal",
        "mercadopago",
        "transfer",
        "prex",
        "coupon",
        "admin",
        "free",
      ],
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "ARS" },
    status: {
      type: String,
      required: true,
      enum: [
        "pending",
        "awaiting_review",
        "approved",
        "rejected",
        "failed",
        "refunded",
      ],
      default: "pending",
      index: true,
    },
    paidAt: { type: Date },

    transferReferenceNumber: { type: String, trim: true },
    transferReceiptUrl: { type: String, trim: true },

    prexReferenceNumber: { type: String, trim: true },
    prexReceiptUrl: { type: String, trim: true },

    adminNotes: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

DocumentaryPurchaseSchema.index({ userId: 1, documentarySlug: 1, status: 1 });

export const DocumentaryPurchaseModel = mongoose.model<IDocumentaryPurchase>(
  "DocumentaryPurchase",
  DocumentaryPurchaseSchema
);