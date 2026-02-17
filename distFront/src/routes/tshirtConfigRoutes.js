"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tshirtConfigController_1 = require("../controllers/tshirtConfigController");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const uploadTshirtConfig_1 = require("../middlewares/uploadTshirtConfig");
const router = express_1.default.Router();
// Rutas públicas
router.get("/", tshirtConfigController_1.getTshirtConfigs);
router.get("/match", tshirtConfigController_1.findMatchingConfig);
// Rutas protegidas (Admin) - antes de /:id para evitar conflicto
router.get("/stats/overview", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), tshirtConfigController_1.getTshirtConfigStats);
// Ruta pública por ID
router.get("/:id", tshirtConfigController_1.getTshirtConfigById);
// Rutas protegidas (Admin) con upload de imagen
router.post("/", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadTshirtConfig_1.uploadTshirtConfigImage, uploadTshirtConfig_1.handleConfigUploadError, uploadTshirtConfig_1.compressAndSaveConfigImage, tshirtConfigController_1.createTshirtConfig);
router.put("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadTshirtConfig_1.uploadTshirtConfigImage, uploadTshirtConfig_1.handleConfigUploadError, uploadTshirtConfig_1.compressAndSaveConfigImage, tshirtConfigController_1.updateTshirtConfig);
router.put("/:id/stock", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), tshirtConfigController_1.updateTshirtConfigStock);
router.delete("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), tshirtConfigController_1.deleteTshirtConfig);
router.patch("/:id/toggle-active", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), tshirtConfigController_1.toggleTshirtConfigActive);
exports.default = router;
