"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResetPasswordEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    service: process.env.SMTP_SERVICE,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true", // true si se usa el puerto 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const sendResetPasswordEmail = async (to, resetUrl) => {
    await transporter.sendMail({
        from: process.env.SMTP_FROM, // remitente configurado en .env
        to,
        subject: "Password Reset",
        text: `Se ha solicitado la recuperación de contraseña.
Utilice el siguiente link para resetear su contraseña: ${resetUrl}
Si no solicitó este cambio, por favor ignore este mensaje.`,
    });
};
exports.sendResetPasswordEmail = sendResetPasswordEmail;
