import mongoose, { Document, Schema } from "mongoose";

export interface ICollection extends Document {
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre de la colección es requerido"],
      trim: true,
      unique: true,
      maxlength: [100, "El nombre no puede exceder 100 caracteres"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "La descripción no puede exceder 500 caracteres"],
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

CollectionSchema.index({ name: 1 });
CollectionSchema.index({ isActive: 1 });

export default mongoose.model<ICollection>("Collection", CollectionSchema);
