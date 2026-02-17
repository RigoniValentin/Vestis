"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const accessoryController_1 = require("../controllers/accessoryController");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const uploadAccessory_1 = require("../middlewares/uploadAccessory");
const router = express_1.default.Router();
// ===== Rutas públicas =====
// Obtener tipos de accesorios (debe ir antes de /:idOrSlug)
router.get("/types", accessoryController_1.getAccessoryTypes);
// Obtener todos los accesorios con filtros
router.get("/", accessoryController_1.getAccessories);
// ===== Rutas protegidas (Admin) - antes de /:idOrSlug para evitar conflicto =====
// Estadísticas de accesorios
router.get("/stats/overview", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), accessoryController_1.getAccessoryStats);
// Crear accesorio con upload de imágenes
router.post("/", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadAccessory_1.uploadAccessoryImages, uploadAccessory_1.handleAccessoryUploadError, uploadAccessory_1.compressAndSaveAccessoryImages, accessoryController_1.createAccessory);
// ===== Ruta pública por ID o Slug =====
router.get("/:idOrSlug", accessoryController_1.getAccessoryById);
// ===== Rutas protegidas (Admin) con parámetro =====
// Actualizar accesorio con upload de imágenes
router.put("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadAccessory_1.uploadAccessoryImages, uploadAccessory_1.handleAccessoryUploadError, uploadAccessory_1.compressAndSaveAccessoryImages, accessoryController_1.updateAccessory);
// Eliminar accesorio
router.delete("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), accessoryController_1.deleteAccessory);
// Toggle destacado
router.patch("/:id/featured", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), accessoryController_1.toggleFeatured);
// Toggle activo
router.patch("/:id/active", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), accessoryController_1.toggleActive);
exports.default = router;
