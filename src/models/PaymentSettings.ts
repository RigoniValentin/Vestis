import mongoose, { Document, Schema } from "mongoose";

/**
 * Documento singleton de configuración de pagos.
 *
 * Contiene los datos para los distintos medios de "transferencia" (canales)
 * que el cliente puede usar para pagar: banco tradicional y billetera
 * virtual PREX. La estructura `transferChannels` es un mapa flexible para
 * poder agregar nuevos canales en el futuro sin migrar el schema.
 *
 * También incluye los toggles para habilitar/deshabilitar los métodos de
 * pago a nivel global y los precios configurables del abono/suscripción.
 */

/**
 * Datos que el admin puede cargar para cualquier canal de transferencia.
 * Los campos son todos opcionales: depende del canal cuáles aplican.
 */
export interface ITransferChannelInfo {
  /** Etiqueta humana opcional para identificar el canal (ej: "Banco Galicia"). */
  label?: string;
  /** Titular de la cuenta / wallet. */
  accountHolder?: string;
  /** Identificador CUIT/CUIL/DNI del titular. */
  taxId?: string;
  /** Nro de cuenta tradicional (cuando aplica). */
  accountNumber?: string;
  /** CBU / Alias / CVU. Se conservan como string libre para soportar varios formatos. */
  cbu?: string;
  /** Alias / handle del canal (ej: "vestisevolucion.PREX"). */
  alias?: string;
  /** Campo extra para campos específicos del canal (CVU Pesos, email wallet, etc.). */
  extraFieldLabel?: string;
  extraFieldValue?: string;
  /** Texto libre con instrucciones adicionales para el cliente. */
  extraInfo?: string;
}

export interface IPaymentSettings extends Document {
  /**
   * Canales de transferencia disponibles.
   * - `bank`: cuenta bancaria tradicional (compatibilidad: mantiene la
   *   estructura anterior con `bankName`, `cuit`, `cbu`, etc.).
   * - `prex`: billetera virtual PREX (u otra billetera, la estructura es
   *   la misma).
   *
   * Es un objeto libre (Record) para que el admin pueda agregar más
   * canales sin migrar la base.
   */
  transferChannels: {
    bank: ITransferChannelInfo;
    prex: ITransferChannelInfo;
    [key: string]: ITransferChannelInfo;
  };

  /**
   * @deprecated Mantener por retrocompatibilidad con versiones viejas del
   * front. El nuevo shape vive en `transferChannels.bank`.
   */
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
  /** Habilita el canal de transferencia bancaria. */
  bankEnabled: boolean;
  /** Habilita el canal PREX (billetera virtual). */
  prexEnabled: boolean;
  /**
   * @deprecated Mantener por retrocompatibilidad: `true` si CUALQUIER
   * canal de transferencia está activo.
   */
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

const TransferChannelInfoSchema = new Schema<ITransferChannelInfo>(
  {
    label: { type: String, trim: true, default: "" },
    accountHolder: { type: String, trim: true, default: "" },
    taxId: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    cbu: { type: String, trim: true, default: "" },
    alias: { type: String, trim: true, default: "" },
    extraFieldLabel: { type: String, trim: true, default: "" },
    extraFieldValue: { type: String, trim: true, default: "" },
    extraInfo: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const PaymentSettingsSchema: Schema = new Schema<IPaymentSettings>(
  {
    transferChannels: {
      bank: { type: TransferChannelInfoSchema, default: () => ({}) },
      prex: { type: TransferChannelInfoSchema, default: () => ({}) },
    },
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
    bankEnabled: { type: Boolean, default: true },
    prexEnabled: { type: Boolean, default: true },
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
  { timestamps: true, versionKey: false, strict: false }
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
  // Migración silenciosa: si el documento viejo tiene `bank` con datos pero
  // `transferChannels.bank` está vacío, los copiamos para que el admin no
  // pierda la configuración al actualizar.
  if (doc) {
    await migrateLegacyBank(doc);
  }
  return doc as IPaymentSettings;
};

/**
 * Copia los datos legacy de `bank` al nuevo `transferChannels.bank` si este
 * está vacío. Se ejecuta cada vez que se lee el singleton, así el front
 * siempre ve los datos consistentes.
 */
const migrateLegacyBank = async (
  doc: IPaymentSettings
): Promise<void> => {
  const legacy = doc.bank as any;
  const channel = doc.transferChannels?.bank as any;
  const hasLegacy =
    !!legacy &&
    (legacy.bankName ||
      legacy.accountHolder ||
      legacy.cuit ||
      legacy.accountNumber ||
      legacy.cbu ||
      legacy.alias ||
      legacy.extraInfo);
  const channelEmpty =
    !channel ||
    !(
      channel.accountHolder ||
      channel.taxId ||
      channel.accountNumber ||
      channel.cbu ||
      channel.alias ||
      channel.extraFieldValue
    );

  if (hasLegacy && channelEmpty) {
    doc.transferChannels = doc.transferChannels || ({} as any);
    doc.transferChannels.bank = {
      label: legacy.bankName || "",
      accountHolder: legacy.accountHolder || "",
      taxId: legacy.cuit || "",
      accountNumber: legacy.accountNumber || "",
      cbu: legacy.cbu || "",
      alias: legacy.alias || "",
      extraInfo: legacy.extraInfo || "",
      extraFieldLabel: "",
      extraFieldValue: "",
    };
    await doc.save();
  }
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