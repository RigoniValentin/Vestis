"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteChatHistory = exports.getChatHistory = void 0;
const ChatMessage_1 = require("../models/ChatMessage");
const getChatHistory = async (req, res) => {
    try {
        const messages = await ChatMessage_1.ChatMessage.find()
            .sort({ createdAt: 1 })
            .exec();
        console.log("Historial enviado:", messages); // Log de los mensajes a enviar
        // Deshabilitar caché para forzar siempre una respuesta completa
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set("Pragma", "no-cache");
        res.json(messages);
    }
    catch (error) {
        console.error("Error al obtener el historial:", error);
        res.status(500).json({ message: "Error al obtener el historial", error });
    }
};
exports.getChatHistory = getChatHistory;
const deleteChatHistory = async (req, res) => {
    try {
        await ChatMessage_1.ChatMessage.deleteMany({});
        console.log("Historial eliminado exitosamente"); // Log de eliminación
        res.json({ message: "Historial eliminado exitosamente" });
    }
    catch (error) {
        console.error("Error al eliminar el historial:", error);
        res.status(500).json({ message: "Error al eliminar el historial", error });
    }
};
exports.deleteChatHistory = deleteChatHistory;
