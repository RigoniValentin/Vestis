import mongoose, { Document, Schema } from "mongoose";

/**
 * Documento singleton de configuración de pagos.
 * Contiene los datos bancarios para transferencias y flags para
 * habilitar/deshabilitar métodos de pago a nivel global,
 * además de los precios configurables del abono/suscripción.
 */
export interface IPaymentSettings extends Document {
  // Datos bancarios para mostrar al usuario que paga por transferencia
  bank: {
    bankName?: string;
    accountHolder?: string;
    cuit?: string;
    accountNumber?: string;
    cbu?: string;
    alias?: string;
    extraInfo?: string;
  };
  // Toggles globales
  mercadopagoEnabled: boolean;
  paypalEnabled: boolean;
  transferEnabled: boolean;

  // Para checkout WhatsApp (también editable desde admin)
  whatsappPhone?: string;

  // Precios del abono (editables desde el panel admin)
  subscription: {
    enabled: boolean;
    monthlyArs: number;          // Precio mensual en ARS (MercadoPago / transferencia)
    monthlyUsd: number;          // Precio mensual en USD (transferencia / referencia)
    paypalUsd: number;           // Precio que se manda a PayPal (puede diferir por fees)
    durationDays: number;        // Duración en días que se asigna al abonarse
    fromPriceArs?: number | null; // Precio "desde" para mostrar en banners (opcional)
  };

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSettingsSchema: Schema = new Schema<IPaymentSettings>(
  {
    bank: {
      bankName: { type: String, trim: true, default: "" },
      accountHolder: { type: String, trim: true, default: "" },
      cuit: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      cbu: { type: String, trim: true, default: "" },
      alias: { type: String, trim: true, default: "" },
      extraInfo: { type: String, trim: true, default: "" },
    },
    mercadopagoEnabled: { type: Boolean, default: true },
    paypalEnabled: { type: Boolean, default: true },
    transferEnabled: { type: Boolean, default: true },
    whatsappPhone: { type: String, default: "5493512657790" },
    subscription: {
      enabled: { type: Boolean, default: true },
      monthlyArs: { type: Number, default: 12000, min: 0 },
      monthlyUsd: { type: Number, default: 10, min: 0 },
      paypalUsd: { type: Number, default: 13, min: 0 },
      durationDays: { type: Number, default: 30, min: 1 },
      fromPriceArs: { type: Number, default: null },
    },
  },
  { timestamps: true, versionKey: false }
);

export const PaymentSettingsModel = mongoose.model<IPaymentSettings>(
  "PaymentSettings",
  PaymentSettingsSchema
);

/**
 * Obtiene (o crea) el documento singleton de configuración.
 */
export const getPaymentSettings = async (): Promise<IPaymentSettings> => {
  let doc = await PaymentSettingsModel.findOne();
  if (!doc) {
    doc = await PaymentSettingsModel.create({});
  }
  return doc;
};

/* ─── Helpers compartidos para los precios del abono ──────────────────────
 * Antes estos valores estaban hardcodeados en distintos controllers
 * (subscriptionTransferController usaba 9900 y +30 días como fallback).
 * Ahora se leen siempre desde PaymentSettings para que el admin pueda
 * cambiarlos desde el panel.
 */

const SUBSCRIPTION_FALLBACK_MONTHLY_ARS = 12000;
const SUBSCRIPTION_FALLBACK_MONTHLY_USD = 10;
const SUBSCRIPTION_FALLBACK_PAYPAL_USD = 13;
const SUBSCRIPTION_FALLBACK_DURATION_DAYS = 30;

/** Precio mensual del abono en ARS (MercadoPago / transferencia). */
export const getSubscriptionPriceArs = async (): Promise<number> => {
  const settings = await getPaymentSettings();
  const value = settings.subscription?.monthlyArs;
  if (typeof value === "number" && !Number.isNaN(value) && value >= 0) {
    return value;
  }
  return SUBSCRIPTION_FALLBACK_MONTHLY_ARS;
};

/** Precio mensual del abono en USD (referencia / WhatsApp). */
export const getSubscriptionPriceUsd = async (): Promise<number> => {
  const settings = await getPaymentSettings();
  const value = settings.subscription?.monthlyUsd;
  if (typeof value === "number" && !Number.isNaN(value) && value >= 0) {
    return value;
  }
  return SUBSCRIPTION_FALLBACK_MONTHLY_USD;
};

/**
 * Precio que se envía a PayPal (puede diferir del USD de referencia
 * para cubrir comisiones). Si la suscripción está deshabilitada devuelve 0.
 */
export const getSubscriptionPriceUsdForPayPal = async (): Promise<number> => {
  const settings = await getPaymentSettings();
  if (settings.subscription?.enabled === false) return 0;
  const value = settings.subscription?.paypalUsd;
  if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
    return value;
  }
  return SUBSCRIPTION_FALLBACK_PAYPAL_USD;
};

/** Duración en días que se asigna al abonarse. */
export const getSubscriptionDurationDays = async (): Promise<number> => {
  const settings = await getPaymentSettings();
  const value = settings.subscription?.durationDays;
  if (typeof value === "number" && !Number.isNaN(value) && value >= 1) {
    return Math.floor(value);
  }
  return SUBSCRIPTION_FALLBACK_DURATION_DAYS;
};
