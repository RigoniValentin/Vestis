import mongoose, { Document, Schema } from "mongoose";

/**
 * Documento singleton de configuración de pagos.
 * Contiene los datos bancarios para transferencias y flags para
 * habilitar/deshabilitar métodos de pago a nivel global.
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
