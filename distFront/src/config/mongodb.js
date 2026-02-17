"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoDbUrl = process.env.MONGODB_URL_STRING;
if (!mongoDbUrl) {
    console.error("MONGODB_URL_STRING is not defined in your environment.");
    process.exit(1);
}
exports.default = (async () => {
    try {
        await mongoose_1.default.connect(mongoDbUrl);
        console.log("Conectado a MongoDB");
    }
    catch (error) {
        console.error("Erroral conectar", error);
        process.exit(1);
    }
})();
