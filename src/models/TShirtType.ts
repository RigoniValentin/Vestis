import mongoose, { Document, Schema } from "mongoose";

export interface ITShirtType extends Document {
  description: string; // Descripción del tipo de prenda
  productType: string; // Tipo de producto dinámico (ej: remera, musculosa, etc.)
  sampleImage?: string; // Imagen de muestra del tipo de prenda
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TShirtTypeSchema: Schema = new Schema(
  {
    description: {
      type: String,
      required: [true, "La descripción es requerida"],
      trim: true,
      maxlength: [1000, "La descripción no puede exceder 1000 caracteres"],
    },
    productType: {
      type: String,
      required: [true, "El tipo de producto es requerido"],
      trim: true,
      lowercase: true,
    },
    sampleImage: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices
TShirtTypeSchema.index({ productType: 1 });
TShirtTypeSchema.index({ isActive: 1 });

export default mongoose.model<ITShirtType>("TShirtType", TShirtTypeSchema);
