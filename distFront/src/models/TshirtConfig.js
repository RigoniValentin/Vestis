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
const TshirtConfigSchema = new mongoose_1.Schema({
    tshirtType: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "TShirtType",
        required: [true, "El tipo de prenda es requerido"],
    },
    design: {
        type: mongoose_1.Schema.Types.ObjectId,
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
    stock: {
        type: [
            {
                size: { type: String, required: true },
                quantity: { type: Number, required: true, min: 0 },
            },
        ],
        default: [],
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
}, {
    timestamps: true,
});
// Índice compuesto único: solo una config por combinación tipo+diseño+color
TshirtConfigSchema.index({ tshirtType: 1, design: 1, color: 1 }, { unique: true });
// Índices para búsquedas frecuentes
TshirtConfigSchema.index({ isActive: 1 });
TshirtConfigSchema.index({ tshirtType: 1 });
TshirtConfigSchema.index({ design: 1 });
TshirtConfigSchema.index({ color: 1 });
exports.default = mongoose_1.default.model("TshirtConfig", TshirtConfigSchema);
