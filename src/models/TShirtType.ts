import mongoose, { Document, Schema } from "mongoose";

// Tipos de productos simplificados
export type ProductType = "remera" | "musculosa";

export interface ITShirtType extends Document {
  description: string; // Descripción del tipo de prenda
  productType: ProductType; // remera o musculosa
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
      enum: {
        values: ["remera", "musculosa"],
        message: "El tipo debe ser: remera o musculosa",
      },
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
