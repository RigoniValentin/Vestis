import mongoose, { Document, Schema } from "mongoose";

/**
 * TshirtConfig - Configuración de remera personalizada
 * 
 * Cada documento representa una combinación específica de:
 * tipo de prenda + color + diseño, con su imagen real del producto.
 * 
 * El admin sube estas configuraciones y el usuario al armar su remera
 * busca una que coincida. Si no existe → "no disponible".
 */
export interface ITshirtConfig extends Document {
  tshirtType: mongoose.Types.ObjectId; // Ref a TShirtType
  design: mongoose.Types.ObjectId;     // Ref a Design
  color: string;                       // "blanco" | "negro"
  sizes: string[];                     // Talles disponibles para esta config
  productImage: string;                // Imagen real del producto terminado
  price: number;                       // Precio final de esta configuración
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TshirtConfigSchema: Schema = new Schema(
  {
    tshirtType: {
      type: Schema.Types.ObjectId,
      ref: "TShirtType",
      required: [true, "El tipo de prenda es requerido"],
    },
    design: {
      type: Schema.Types.ObjectId,
      ref: "Design",
      required: [true, "El diseño es requerido"],
    },
    color: {
      type: String,
      required: [true, "El color es requerido"],
      trim: true,
      lowercase: true,
    },
    sizes: {
      type: [String],
      default: ["S", "M", "L", "XL"],
    },
    productImage: {
      type: String,
      required: [true, "La imagen del producto es requerida"],
    },
    price: {
      type: Number,
      required: [true, "El precio es requerido"],
      min: [0, "El precio no puede ser negativo"],
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

// Índice compuesto único: solo una config por combinación tipo+diseño+color
TshirtConfigSchema.index(
  { tshirtType: 1, design: 1, color: 1 },
  { unique: true }
);

// Índices para búsquedas frecuentes
TshirtConfigSchema.index({ isActive: 1 });
TshirtConfigSchema.index({ tshirtType: 1 });
TshirtConfigSchema.index({ design: 1 });
TshirtConfigSchema.index({ color: 1 });

export default mongoose.model<ITshirtConfig>("TshirtConfig", TshirtConfigSchema);
