import mongoose, { Document, Schema } from "mongoose";

export interface IDesign extends Document {
  name: string;
  description?: string;
  imageUrl: string; // URL del PNG del diseño
  year: number; // Año del diseño para filtrado
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
      required: [true, "La imagen del diseño es requerida"],
    },
    year: {
      type: Number,
      required: [true, "El año del diseño es requerido"],
      min: [2020, "Año inválido"],
      max: [2100, "Año inválido"],
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
  }
);

// Índices para optimizar búsquedas
DesignSchema.index({ year: 1 });
DesignSchema.index({ name: 1 });
DesignSchema.index({ isActive: 1 });
DesignSchema.index({ tags: 1 });

export default mongoose.model<IDesign>("Design", DesignSchema);
