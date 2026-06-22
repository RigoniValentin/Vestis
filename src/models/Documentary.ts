import mongoose, { Schema, Document } from "mongoose";

export interface IDocumentary extends Document {
  slug: string;
  title: string;
  subtitle?: string;
  synopsis?: string;
  youtubeVideoId: string; // ID privado: NUNCA exponer salvo a usuarios con acceso
  trailerYoutubeId?: string; // ID público del trailer (opcional)
  posterUrl?: string;
  backdropUrl?: string; // compatibilidad legacy / fallback desktop
  backdropDesktopUrl?: string;
  backdropMobileUrl?: string;
  priceUsd: number;
  priceArs: number;
  currency: string; // moneda principal informativa
  durationSeconds?: number;
  releaseYear?: number;
  director?: string;
  cast?: string[];
  genres?: string[];
  isPublished: boolean;
  paypalEnabled: boolean;
  mpEnabled: boolean;
  freeAccess: boolean; // si true, no requiere compra
  createdAt: Date;
  updatedAt: Date;
}

const DocumentarySchema: Schema = new Schema<IDocumentary>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      default: "humano-existes",
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, trim: true, maxlength: 300 },
    synopsis: { type: String, trim: true, maxlength: 4000 },
    youtubeVideoId: { type: String, required: true, trim: true },
    trailerYoutubeId: { type: String, trim: true },
    posterUrl: { type: String, trim: true },
    backdropUrl: { type: String, trim: true },
    backdropDesktopUrl: { type: String, trim: true },
    backdropMobileUrl: { type: String, trim: true },
    priceUsd: { type: Number, required: true, min: 0, default: 9.99 },
    priceArs: { type: Number, required: true, min: 0, default: 9900 },
    currency: { type: String, default: "ARS" },
    durationSeconds: { type: Number, min: 0 },
    releaseYear: { type: Number, min: 1900 },
    director: { type: String, trim: true },
    cast: { type: [String], default: [] },
    genres: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
    paypalEnabled: { type: Boolean, default: true },
    mpEnabled: { type: Boolean, default: true },
    freeAccess: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

// El índice unique ya está declarado en el campo slug con `unique: true`
// no es necesario declararlo de nuevo aquí.

export const DocumentaryModel = mongoose.model<IDocumentary>(
  "Documentary",
  DocumentarySchema
);
