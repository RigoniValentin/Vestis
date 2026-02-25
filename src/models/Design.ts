import mongoose, { Schema } from "mongoose";

export interface IDesign {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  imageUrl: string; // URL del diseño para fondos claros
  imageUrlDark?: string; // URL del diseño para fondos oscuros
  designCollection: mongoose.Types.ObjectId; // Referencia a la colección (en DB es "collection")
  tags?: string[]; // Etiquetas para búsqueda
  isActive: boolean; // Si está disponible para uso
  createdAt: Date;
  updatedAt: Date;
}

const DesignSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del diseño es requerido"],
      trim: true,
      maxlength: [100, "El nombre no puede exceder 100 caracteres"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "La descripción no puede exceder 500 caracteres"],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imageUrlDark: {
      type: String,
      default: null,
    },
    collection: {
      type: Schema.Types.ObjectId,
      ref: "Collection",
      required: [true, "La colección es requerida"],
    },
    tags: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

// Índices para optimizar búsquedas
DesignSchema.index({ collection: 1 });
DesignSchema.index({ name: 1 });
DesignSchema.index({ isActive: 1 });
DesignSchema.index({ tags: 1 });

export default mongoose.model<IDesign>("Design", DesignSchema);
