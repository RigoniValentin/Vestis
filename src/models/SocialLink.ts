import mongoose, { Schema, Document } from "mongoose";

export interface ISocialLink extends Document {
  name: string;
  url: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const socialLinkSchema = new Schema<ISocialLink>(
  {
    name: {
      type: String,
      required: [true, "El nombre de la red social es requerido"],
      trim: true,
      maxlength: [60, "El nombre no puede exceder 60 caracteres"],
    },
    url: {
      type: String,
      required: [true, "La URL es requerida"],
      trim: true,
      maxlength: [500, "La URL no puede exceder 500 caracteres"],
      validate: {
        validator: function (value: string) {
          if (!value) return false;
          try {
            const parsed = new URL(value);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "La URL debe ser un enlace http(s) válido",
      },
    },
    imageUrl: {
      type: String,
      required: [true, "La imagen del ícono es requerida"],
      trim: true,
      maxlength: [500, "La URL de la imagen no puede exceder 500 caracteres"],
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El creador es requerido"],
    },
  },
  {
    timestamps: true,
  }
);

socialLinkSchema.index({ isActive: 1, order: 1, createdAt: -1 });
socialLinkSchema.index({ createdBy: 1 });

const SocialLink = mongoose.model<ISocialLink>("SocialLink", socialLinkSchema);

export default SocialLink;
