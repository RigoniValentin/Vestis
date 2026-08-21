import mongoose, { Document, Schema, Types } from "mongoose";

export type OrderPaymentMethod =
  | "mercadopago"
  | "paypal"
  | "transfer"
  | "prex"
  | "whatsapp";

export type OrderPaymentStatus =
  | "pending" // creado, sin pago aún (whatsapp o esperando comprobante)
  | "awaiting_review" // comprobante subido, esperando que admin apruebe
  | "approved" // pagado / confirmado
  | "rejected" // admin rechazó
  | "cancelled";

export type OrderFulfillmentStatus =
  | "pending"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface IOrderItem {
  productId: Types.ObjectId;
  catalogType: "product" | "tshirt-config" | "accessory";
  sourceId?: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  items: IOrderItem[];
  total: number;
  currency: string;

  // Información del cliente (snapshot al crear el pedido)
  customer: {
    name: string;
    email: string;
    phone?: string;
  };

  // Pago
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;

  // Datos del gateway (MP/PayPal)
  gatewayPreferenceId?: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  gatewayPayerEmail?: string;

  /**
   * Comprobante de transferencia bancaria.
   * Mantener los nombres `transfer*` por compatibilidad con datos legacy.
   */
  transferReferenceNumber?: string;
  transferReceiptUrl?: string;

  /**
   * Comprobante de pago por billetera virtual PREX (u otra wallet).
   * El método se distingue por `paymentMethod === "prex"`.
   */
  prexReferenceNumber?: string;
  prexReceiptUrl?: string;

  // Revisión por admin
  adminNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;

  communityBonusGrantedAt?: Date;
  communityBonusExpirationDate?: Date;

  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    catalogType: {
      type: String,
      enum: ["product", "tshirt-config", "accessory"],
      default: "product",
    },
    sourceId: { type: String, trim: true },
    name: { type: String, required: true },
    image: { type: String },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderSchema: Schema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: { type: [OrderItemSchema], required: true, default: [] },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ARS" },

    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String },
    },

    paymentMethod: {
      type: String,
      enum: ["mercadopago", "paypal", "transfer", "prex", "whatsapp"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "awaiting_review",
        "approved",
        "rejected",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: ["pending", "preparing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    gatewayPreferenceId: { type: String, index: true },
    gatewayPaymentId: { type: String, index: true },
    gatewayOrderId: { type: String, index: true },
    gatewayPayerEmail: { type: String },

    transferReferenceNumber: { type: String, trim: true },
    transferReceiptUrl: { type: String, trim: true },

    prexReferenceNumber: { type: String, trim: true },
    prexReceiptUrl: { type: String, trim: true },

    adminNotes: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },

    communityBonusGrantedAt: { type: Date },
    communityBonusExpirationDate: { type: Date },

    paidAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });

export const OrderModel = mongoose.model<IOrder>("Order", OrderSchema);