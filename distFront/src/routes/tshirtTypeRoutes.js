"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tshirtTypeController_1 = require("../controllers/tshirtTypeController");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const uploadTShirtType_1 = require("../middlewares/uploadTShirtType");
const router = express_1.default.Router();
// Rutas públicas
router.get("/", tshirtTypeController_1.getTShirtTypes);
router.get("/category/:productType", tshirtTypeController_1.getTShirtTypesByCategory);
router.get("/:id", tshirtTypeController_1.getTShirtTypeById);
// Rutas protegidas (Admin) - con manejo de imagen
router.post("/", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadTShirtType_1.uploadTShirtTypeImage, uploadTShirtType_1.handleTShirtTypeUploadError, uploadTShirtType_1.compressAndSaveTShirtTypeImage, tshirtTypeController_1.createTShirtType);
router.put("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadTShirtType_1.uploadTShirtTypeImage, uploadTShirtType_1.handleTShirtTypeUploadError, uploadTShirtType_1.compressAndSaveTShirtTypeImage, tshirtTypeController_1.updateTShirtType);
router.delete("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), tshirtTypeController_1.deleteTShirtType);
router.patch("/:id/toggle-active", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), tshirtTypeController_1.toggleTShirtTypeActive);
exports.default = router;
