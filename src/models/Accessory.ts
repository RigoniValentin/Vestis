import mongoose, { Document, Schema } from "mongoose";

// Tipos de accesorios disponibles en Vestis Evolución
export type AccessoryType = 
  | "colchoneta"
  | "banda-elastica"
  | "botella"
  | "bolso"
  | "media"
  | "vincha"
  | "toalla"
  | "equipamiento"
  | "otro";

// Variante de color
export interface IColorVariant {
  color: string;        // Nombre del color (ej: "Negro", "Rosa")
  hexCode?: string;     // Código hex opcional (ej: "#000000")
  image?: string;       // Imagen específica para este color (opcional)
}

// Variante de talle (para medias, vinchas ajustables, etc)
export interface ISizeVariant {
  size: string;         // Talle (XS, S, M, L, XL, Único)
}

export interface IAccessory extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;      // Precio anterior (para mostrar descuento)
  type: AccessoryType;
  images: string[];             // Array de imágenes (máximo 4)
  mainImage?: string;           // Se establece automáticamente
  colors?: IColorVariant[];     // Variantes de color (opcional)
  sizes?: ISizeVariant[];       // Variantes de talle (opcional)
  tags?: string[];              // Tags para búsqueda y filtrado
  isFeatured: boolean;          // Destacar en la tienda
  isActive: boolean;            // Activo/inactivo
  sku?: string;                 // Código de producto
  weight?: number;              // Peso en gramos (para envío)
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ColorVariantSchema = new Schema<IColorVariant>({
  color: {
    type: String,
    required: true,
    trim: true,
  },
  hexCode: {
    type: String,
    trim: true,
  },
  image: {
    type: String,
  },
}, { _id: false });

const SizeVariantSchema = new Schema<ISizeVariant>({
  size: {
    type: String,
    required: true,
    trim: true,
  },
}, { _id: false });

const AccessorySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del accesorio es requerido"],
      trim: true,
      maxlength: [150, "El nombre no puede exceder 150 caracteres"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "La descripción es requerida"],
      trim: true,
      maxlength: [2000, "La descripción no puede exceder 2000 caracteres"],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [200, "La descripción corta no puede exceder 200 caracteres"],
    },
    price: {
      type: Number,
      required: [true, "El precio es requerido"],
      min: [1, "El precio debe ser mayor a 0"],
    },
    compareAtPrice: {
      type: Number,
      min: [0, "El precio de comparación no puede ser negativo"],
    },
    type: {
      type: String,
      required: [true, "El tipo de accesorio es requerido"],
      enum: {
        values: ["colchoneta", "banda-elastica", "botella", "bolso", "media", "vincha", "toalla", "equipamiento", "otro"],
        message: "Tipo de accesorio no válido",
      },
    },
    images: {
      type: [String],
      validate: {
        validator: function (v: string[]) {
          return v && v.length <= 4;
        },
        message: "Máximo 4 imágenes permitidas",
      },
      default: [],
    },
    mainImage: {
      type: String,
    },
    colors: {
      type: [ColorVariantSchema],
      default: [],
    },
    sizes: {
      type: [SizeVariantSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Índices para optimizar búsquedas
AccessorySchema.index({ name: "text", description: "text", tags: "text" });
AccessorySchema.index({ type: 1 });
AccessorySchema.index({ price: 1 });
AccessorySchema.index({ isActive: 1 });
AccessorySchema.index({ isFeatured: 1 });
AccessorySchema.index({ slug: 1 });

// Virtual para verificar si tiene descuento
AccessorySchema.virtual("hasDiscount").get(function (this: IAccessory) {
  return this.compareAtPrice && this.compareAtPrice > this.price;
});

// Virtual para calcular porcentaje de descuento
AccessorySchema.virtual("discountPercentage").get(function (this: IAccessory) {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

// Generar slug antes de guardar
AccessorySchema.pre("save", function (this: IAccessory, next) {
  // Generar slug si no existe
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/[^a-z0-9\s-]/g, "") // Solo letras, números, espacios y guiones
      .replace(/\s+/g, "-") // Espacios a guiones
      .replace(/-+/g, "-") // Múltiples guiones a uno
      .replace(/^-|-$/g, ""); // Quitar guiones al inicio y final
      
    // Agregar timestamp para evitar duplicados
    this.slug = `${this.slug}-${Date.now().toString(36)}`;
  }
  
  // Establecer imagen principal
  if (this.images && this.images.length > 0) {
    this.mainImage = this.images[0];
  }
  
  next();
});

const Accessory = mongoose.model<IAccessory>("Accessory", AccessorySchema);

export default Accessory;
