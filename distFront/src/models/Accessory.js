"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const ColorVariantSchema = new mongoose_1.Schema({
    color: {
        type: String,
        required: true,
        trim: true,
    },
    hexCode: {
        type: String,
        trim: true,
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    image: {
        type: String,
    },
}, { _id: false });
const SizeVariantSchema = new mongoose_1.Schema({
    size: {
        type: String,
        required: true,
        trim: true,
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
}, { _id: false });
const AccessorySchema = new mongoose_1.Schema({
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
            validator: function (v) {
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
    stock: {
        type: Number,
        min: [0, "El stock no puede ser negativo"],
        default: 0,
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Índices para optimizar búsquedas
AccessorySchema.index({ name: "text", description: "text", tags: "text" });
AccessorySchema.index({ type: 1 });
AccessorySchema.index({ price: 1 });
AccessorySchema.index({ isActive: 1 });
AccessorySchema.index({ isFeatured: 1 });
AccessorySchema.index({ slug: 1 });
// Virtual para calcular stock total (si hay variantes)
AccessorySchema.virtual("totalStock").get(function () {
    if (this.colors && this.colors.length > 0) {
        return this.colors.reduce((acc, c) => acc + c.stock, 0);
    }
    if (this.sizes && this.sizes.length > 0) {
        return this.sizes.reduce((acc, s) => acc + s.stock, 0);
    }
    return this.stock;
});
// Virtual para verificar si tiene descuento
AccessorySchema.virtual("hasDiscount").get(function () {
    return this.compareAtPrice && this.compareAtPrice > this.price;
});
// Virtual para calcular porcentaje de descuento
AccessorySchema.virtual("discountPercentage").get(function () {
    if (this.compareAtPrice && this.compareAtPrice > this.price) {
        return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
    }
    return 0;
});
// Generar slug antes de guardar
AccessorySchema.pre("save", function (next) {
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
const Accessory = mongoose_1.default.model("Accessory", AccessorySchema);
exports.default = Accessory;
