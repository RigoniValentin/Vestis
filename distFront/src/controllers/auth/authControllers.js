"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.refreshToken = exports.loginUser = exports.registerUser = void 0;
const userRepository_1 = require("@repositories/userRepository");
const userService_1 = require("@services/userService");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const emailService_1 = require("@services/emailService");
const userRepository = new userRepository_1.UserRepository();
const userService = new userService_1.UserService(userRepository);
const registerUser = async (req, res) => {
    try {
        const { email } = req.body;
        const userExists = await userService.findUserByEmail(req.body.email);
        if (userExists) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        const newUser = await userService.createUser({
            ...req.body,
            role: "guest",
        });
        res.status(201).json(newUser);
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(500).json(error);
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    const jwtSecret = process.env.JWT_SECRET;
    try {
        const { email, password } = req.body;
        const user = await userService.findUserByEmail(email);
        if (!user) {
            res.status(404).json({ message: "Invalid user or password..." });
            return;
        }
        const comparePass = await user.comparePassword(password);
        if (!comparePass) {
            res.status(400).json({ message: "Invalid user or password..." });
            return;
        }
        const token = jsonwebtoken_1.default.sign({
            id: user._id,
            email: user.email,
            username: user.username,
            roles: user.roles,
            nationality: user.nationality,
            locality: user.locality,
            age: user.age,
            capSeresArte: user.capSeresArte || false,
            capThr: user.capThr || false,
            capPhr: user.capPhr || false,
            capMat: user.capMat || false,
            capUor: user.capUor || false,
            capReh: user.capReh || false,
            capViv: user.capViv || false,
            capTELA: user.capTELA || false,
            capNO_CONVENCIONAL: user.capNO_CONVENCIONAL || false,
            capDANZA_DRAGON: user.capDANZA_DRAGON || false,
            capPARADA_MANOS: user.capPARADA_MANOS || false,
            capDANZA_AEREA_ARNES: user.capDANZA_AEREA_ARNES || false,
            capCUBO: user.capCUBO || false,
            capPOLE_AEREO: user.capPOLE_AEREO || false,
            capRED: user.capRED || false,
            capCONTORSION: user.capCONTORSION || false,
            capARO: user.capARO || false,
            capACRO_TRAINING: user.capACRO_TRAINING || false,
            capANCESTROS_AL_DESCUBIERTO: user.capANCESTROS_AL_DESCUBIERTO || false,
        }, jwtSecret, { expiresIn: "3h" });
        //const decodedPayload = jwt.decode(token);
        //console.log("Payload decodificado:", decodedPayload);
        console.log("MercadoPago Access Token:", process.env.MP_ACCESS_TOKEN);
        res.json(token);
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(500).json(error);
    }
};
exports.loginUser = loginUser;
const refreshToken = async (req, res) => {
    try {
        console.log("refreshToken called, user:", req.currentUser);
        // Verificar que req.currentUser exista
        if (!req.currentUser || !req.currentUser._id) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const updatedUser = await userService.findUserById(req.currentUser._id);
        if (!updatedUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const jwtSecret = process.env.JWT_SECRET;
        const newToken = jsonwebtoken_1.default.sign({
            id: updatedUser._id,
            email: updatedUser.email,
            username: updatedUser.username,
            roles: updatedUser.roles,
            nationality: updatedUser.nationality,
            locality: updatedUser.locality,
            age: updatedUser.age,
        }, jwtSecret, { expiresIn: "3h" });
        console.log("New token:", newToken);
        res.json({ token: newToken });
    }
    catch (error) {
        console.error("Error in refreshToken:", error);
        res.status(500).json({ message: error.message || error });
    }
};
exports.refreshToken = refreshToken;
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userService.findUserByEmail(email);
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }
        // Generar token y asignar fecha de expiración
        const token = crypto_1.default.randomBytes(20).toString("hex");
        user.resetPasswordToken = token;
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // Vigencia 1 hora
        await user.save();
        // URL de recuperación basada en la variable HOST del .env
        const resetUrl = `${process.env.HOST}/reset-password?token=${token}`;
        await (0, emailService_1.sendResetPasswordEmail)(user.email, resetUrl);
        res.json({
            message: "Se envió un email con las instrucciones para recuperar la contraseña",
        });
    }
    catch (error) {
        console.error("Error en forgotPassword:", error);
        res.status(500).json({ message: "Error al procesar la solicitud", error });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        // Buscar usuario a través del token de recuperación
        const user = await userService.findUserByResetToken(token);
        if (!user ||
            !user.resetPasswordExpires ||
            user.resetPasswordExpires < new Date()) {
            res.status(400).json({
                message: "El token de recuperación es inválido o ha expirado",
            });
            return;
        }
        // Actualizar la contraseña (se aplicará el hash en el pre-save)
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.json({ message: "La contraseña se actualizó correctamente" });
    }
    catch (error) {
        console.error("Error en resetPassword:", error);
        res.status(500).json({ message: "Error al resetear la contraseña", error });
    }
};
exports.resetPassword = resetPassword;
