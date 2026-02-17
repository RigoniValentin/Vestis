"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const designController_1 = require("../controllers/designController");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const uploadDesign_1 = require("../middlewares/uploadDesign");
const router = express_1.default.Router();
// Rutas públicas
router.get("/", designController_1.getDesigns);
router.get("/years/available", designController_1.getAvailableYears);
router.get("/year/:year", designController_1.getDesignsByYear);
router.get("/:id", designController_1.getDesignById);
// Rutas protegidas (Admin) - con manejo de imagen
router.post("/", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadDesign_1.uploadDesignImage, uploadDesign_1.handleDesignUploadError, uploadDesign_1.compressAndSaveDesignImage, designController_1.createDesign);
router.put("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), uploadDesign_1.uploadDesignImage, uploadDesign_1.handleDesignUploadError, uploadDesign_1.compressAndSaveDesignImage, designController_1.updateDesign);
router.delete("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), designController_1.deleteDesign);
router.patch("/:id/toggle-active", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin"]), designController_1.toggleDesignActive);
exports.default = router;
