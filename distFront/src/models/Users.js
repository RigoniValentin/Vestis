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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const UserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
        trim: true,
    },
    permissions: {
        type: [String],
        default: [],
    },
    roles: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "Roles",
        },
    ],
    subscription: {
        transactionId: { type: String },
        paymentDate: { type: Date },
        expirationDate: { type: Date },
    },
    couponUsed: { type: Boolean, default: false },
    nationality: {
        type: String,
    },
    locality: {
        type: String,
    },
    age: {
        type: Number,
    },
    // Nuevos campos para capacitaciones:
    capSeresArte: { type: Boolean, default: false },
    capThr: { type: Boolean, default: false },
    capPhr: { type: Boolean, default: false },
    capMat: { type: Boolean, default: false },
    capUor: { type: Boolean, default: false },
    capReh: { type: Boolean, default: false },
    capViv: { type: Boolean, default: false },
    capTELA: { type: Boolean, default: false },
    capNO_CONVENCIONAL: { type: Boolean, default: false },
    capDANZA_DRAGON: { type: Boolean, default: false },
    capPARADA_MANOS: { type: Boolean, default: false },
    capDANZA_AEREA_ARNES: { type: Boolean, default: false },
    capCUBO: { type: Boolean, default: false },
    capPOLE_AEREO: { type: Boolean, default: false },
    capRED: { type: Boolean, default: false },
    capCONTORSION: { type: Boolean, default: false },
    capARO: { type: Boolean, default: false },
    capACRO_TRAINING: { type: Boolean, default: false },
    capANCESTROS_AL_DESCUBIERTO: { type: Boolean, default: false },
    // Nuevos campos para recuperación de contraseña
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
}, { timestamps: true, versionKey: false });
UserSchema.pre("save", async function (next) {
    if (this.isModified("password") || this.isNew) {
        const salt = await bcrypt_1.default.genSalt(12);
        const hash = await bcrypt_1.default.hash(this.password, salt);
        this.password = hash;
    }
    next();
});
UserSchema.method("comparePassword", async function (password) {
    return await bcrypt_1.default.compare(password, this.password);
});
UserSchema.methods.toJSON = function () {
    const userObj = this.toObject();
    delete userObj.password;
    return userObj;
};
exports.UserModel = mongoose_1.default.model("User", UserSchema);
