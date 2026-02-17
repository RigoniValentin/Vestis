"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOST = exports.MP_ACCESS_TOKEN = exports.PAYPAL_API = exports.PAYPAL_API_SECRET = exports.PAYPAL_API_CLIENT = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
require("module-alias/register");
const server_1 = require("@server/server");
require("@config/mongodb");
exports.PAYPAL_API_CLIENT = process.env.PAYPAL_API_CLIENT;
exports.PAYPAL_API_SECRET = process.env.PAYPAL_API_SECRET;
exports.PAYPAL_API = process.env.NODE_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
exports.MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PORT = process.env.PORT || 3016;
exports.HOST = process.env.NODE_ENV === "production"
    ? process.env.HOST || "https://vestisevolucion.com"
    : "http://localhost:" + PORT;
server_1.httpServer.listen(PORT, () => {
    console.log(`Server (with Socket.IO) listening on port ${PORT}`);
});
