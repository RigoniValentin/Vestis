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
const CustomOrderSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "El usuario es requerido"],
    },
    tshirtType: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "TShirtType",
        required: [true, "El tipo de remera es requerido"],
    },
    design: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
// Índices
CustomOrderSchema.index({ userId: 1 });
CustomOrderSchema.index({ status: 1 });
CustomOrderSchema.index({ orderDate: -1 });
// Populate automático
CustomOrderSchema.pre(/^find/, function (next) {
    this.populate("tshirtType")
        .populate("design")
        .populate("userId", "firstName lastName email");
    next();
});
exports.default = mongoose_1.default.model("CustomOrder", CustomOrderSchema);
