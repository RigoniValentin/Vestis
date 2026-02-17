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
const noticeSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, "El título es requerido"],
        trim: true,
        maxlength: [100, "El título no puede exceder 100 caracteres"],
    },
    message: {
        type: String,
        required: [true, "El mensaje es requerido"],
        trim: true,
        maxlength: [500, "El mensaje no puede exceder 500 caracteres"],
    },
    type: {
        type: String,
        enum: {
            values: ["info", "warning", "urgent", "success"],
            message: "El tipo debe ser: info, warning, urgent o success",
        },
        default: "info",
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    startDate: {
        type: Date,
        default: null,
        validate: {
            validator: function (value) {
                // Si hay endDate y startDate, startDate debe ser anterior
                if (value && this.endDate) {
                    return value <= this.endDate;
                }
                return true;
            },
            message: "La fecha de inicio debe ser anterior a la fecha de fin",
        },
    },
    endDate: {
        type: Date,
        default: null,
        validate: {
            validator: function (value) {
                // Si hay startDate y endDate, endDate debe ser posterior
                if (value && this.startDate) {
                    return value >= this.startDate;
                }
                return true;
            },
            message: "La fecha de fin debe ser posterior a la fecha de inicio",
        },
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "El creador es requerido"],
    },
}, {
    timestamps: true,
});
// Índices para mejorar performance
noticeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
noticeSchema.index({ createdBy: 1 });
noticeSchema.index({ type: 1 });
noticeSchema.index({ createdAt: -1 });
// Middleware pre-save para validaciones adicionales
noticeSchema.pre("save", function (next) {
    // Validar fechas si ambas están presentes
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
        const error = new Error("La fecha de inicio debe ser anterior a la fecha de fin");
        return next(error);
    }
    next();
});
const Notice = mongoose_1.default.model("Notice", noticeSchema);
exports.default = Notice;
