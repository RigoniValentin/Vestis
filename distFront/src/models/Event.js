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
const eventSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, "El título es requerido"],
        trim: true,
        maxlength: [100, "El título no puede exceder 100 caracteres"],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, "La descripción no puede exceder 500 caracteres"],
    },
    startDate: {
        type: Date,
        required: [true, "La fecha de inicio es requerida"],
    },
    endDate: {
        type: Date,
        // Eliminamos la validación custom aquí ya que se maneja en el servicio
    },
    type: {
        type: String,
        enum: {
            values: ["class", "workshop", "special", "capacitation"],
            message: "El tipo debe ser: class, workshop, special o capacitation",
        },
        required: [true, "El tipo de evento es requerido"],
    },
    category: {
        type: String,
        trim: true,
    },
    color: {
        type: String,
        default: "#3B82F6",
        validate: {
            validator: function (value) {
                // Validar formato hexadecimal
                return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
            },
            message: "El color debe estar en formato hexadecimal válido (ej: #3B82F6)",
        },
    },
    isRecurring: {
        type: Boolean,
        default: false,
    },
    recurringDays: {
        type: [Number],
        validate: {
            validator: function (value) {
                // Si es recurrente, debe tener al menos un día
                if (this.isRecurring && (!value || value.length === 0)) {
                    return false;
                }
                // Todos los días deben estar entre 0-6
                return value.every((day) => day >= 0 && day <= 6);
            },
            message: "Los días recurrentes deben estar entre 0-6 (Domingo-Sábado) y al menos uno si es recurrente",
        },
    },
    location: {
        type: String,
        trim: true,
    },
    maxParticipants: {
        type: Number,
        min: [1, "El máximo de participantes debe ser al menos 1"],
    },
    instructor: {
        type: String,
        trim: true,
    },
    price: {
        type: Number,
        min: [0, "El precio no puede ser negativo"],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, {
    timestamps: true, // Esto agrega automáticamente createdAt y updatedAt
});
// Índices para mejorar performance en consultas
eventSchema.index({ startDate: 1, isActive: 1 });
eventSchema.index({ type: 1, isActive: 1 });
eventSchema.index({ isRecurring: 1, isActive: 1 });
eventSchema.index({ createdBy: 1 });
// Middleware pre-save para actualizar updatedAt
eventSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});
const Event = mongoose_1.default.model("Event", eventSchema);
exports.default = Event;
