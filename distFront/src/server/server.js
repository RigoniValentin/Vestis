"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const routes_1 = __importDefault(require("@routes/routes"));
const morgan_1 = __importDefault(require("morgan"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const ChatMessage_1 = require("@models/ChatMessage"); // Importar el modelo de mensajes
const app = (0, express_1.default)();
const projectRoot = process.cwd();
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)("dev"));
app.use((0, cors_1.default)());
// Servir archivos de imágenes de productos
app.use("/uploads", express_1.default.static(path_1.default.join(projectRoot, "uploads")));
// Registrar rutas de la API
app.use("/api/v1", (0, routes_1.default)());
// Servir archivos estáticos
if (process.env.NODE_ENV === "production") {
    app.use("/", express_1.default.static(path_1.default.join(projectRoot, "distFront"), { index: "index.html" }));
    app.get("*", (req, res) => {
        return res.sendFile(path_1.default.join(projectRoot, "distFront", "index.html"));
    });
}
else {
    app.use("/", express_1.default.static(path_1.default.join(projectRoot, "distFront"), { index: "index.html" }));
    app.get("*", (req, res) => {
        return res.sendFile(path_1.default.join(projectRoot, "distFront", "index.html"));
    });
}
// ── Agregar Socket.IO ──
const http_1 = require("http");
const socket_io_1 = require("socket.io");
// Crear servidor HTTP usando la app de Express
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Inicializar Socket.IO
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});
// Ejemplo de configuración de eventos
io.on("connection", (socket) => {
    console.log("Socket conectado:", socket.id);
    socket.on("chat message", async (msg) => {
        console.log("Mensaje de chat:", msg);
        io.emit("chat message", msg);
        // Guardar el mensaje en la base de datos
        try {
            // Se asume que el mensaje viene en el formato "username: mensaje"
            const [sender] = msg.split(":");
            await ChatMessage_1.ChatMessage.create({ sender: sender.trim(), message: msg });
        }
        catch (error) {
            console.error("Error al guardar mensaje:", error);
        }
    });
    // Listener para el evento "chat toggled"
    socket.on("chat toggled", (payload) => {
        console.log("Chat toggled:", payload);
        // Retransmitir el evento a todos los demás clientes conectados
        socket.broadcast.emit("chat toggled", payload);
    });
    socket.on("disconnect", () => {
        console.log("Socket desconectado:", socket.id);
    });
});
// Lógica de cierre gracioso en server.ts
const shutdown = () => {
    console.log("Cerrando servidor...");
    httpServer.close(() => {
        console.log("Servidor HTTP cerrado.");
        process.exit(0);
    });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
