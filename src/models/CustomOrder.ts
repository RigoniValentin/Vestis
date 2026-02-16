import mongoose, { Document, Schema } from "mongoose";

// Pedido personalizado de remera/musculosa
export interface ICustomOrder extends Document {
  userId: mongoose.Types.ObjectId;
  tshirtType: mongoose.Types.ObjectId; // Referencia a TShirtType
  design: mongoose.Types.ObjectId; // Referencia a Design
  color: string; // "blanco" o "negro"
  size: string; // "S", "M", "L", "XL"
  quantity: number;
  finalPrice: number; // Precio calculado (basePrice + designPrice)
  status: "pending" | "processing" | "completed" | "cancelled";
  previewImageUrl?: string; // URL de la preview generada
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomOrderSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El usuario es requerido"],
    },
    tshirtType: {
      type: Schema.Types.ObjectId,
      ref: "TShirtType",
      required: [true, "El tipo de remera es requerido"],
    },
    design: {
      type: Schema.Types.ObjectId,
      ref: "Design",
      required: [true, "El diseño es requerido"],
    },
    color: {
      type: String,
      required: [true, "El color es requerido"],
      enum: {
        values: ["blanco", "negro"],
        message: "El color debe ser blanco o negro",
      },
    },
    size: {
      type: String,
      required: [true, "El talle es requerido"],
      enum: {
        values: ["S", "M", "L", "XL", "XXL"],
        message: "Talle inválido",
      },
    },
    quantity: {
      type: Number,
      required: [true, "La cantidad es requerida"],
      min: [1, "La cantidad mínima es 1"],
    },
    finalPrice: {
      type: Number,
      required: [true, "El precio final es requerido"],
      min: [0, "El precio no puede ser negativo"],
    },
    status: {
      type: String,
      default: "pending",
      enum: {
        values: ["pending", "processing", "completed", "cancelled"],
        message: "Estado inválido",
      },
    },
    previewImageUrl: {
      type: String,
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Índices
CustomOrderSchema.index({ userId: 1 });
CustomOrderSchema.index({ status: 1 });
CustomOrderSchema.index({ orderDate: -1 });

// Populate automático
CustomOrderSchema.pre(/^find/, function (this: any, next) {
  this.populate("tshirtType")
    .populate("design")
    .populate("userId", "firstName lastName email");
  next();
});

export default mongoose.model<ICustomOrder>("CustomOrder", CustomOrderSchema);
