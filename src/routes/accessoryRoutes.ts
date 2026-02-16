import express from "express";
import {
  getAccessories,
  getAccessoryById,
  getAccessoryTypes,
  createAccessory,
  updateAccessory,
  deleteAccessory,
  toggleFeatured,
  toggleActive,
  getAccessoryStats,
} from "../controllers/accessoryController";
import { verifyToken } from "../middlewares/auth";
import { verifyRole } from "../middlewares/roles";
import {
  uploadAccessoryImages,
  compressAndSaveAccessoryImages,
  handleAccessoryUploadError,
} from "../middlewares/uploadAccessory";

const router = express.Router();

// ===== Rutas públicas =====

// Obtener tipos de accesorios (debe ir antes de /:idOrSlug)
router.get("/types", getAccessoryTypes);

// Obtener todos los accesorios con filtros
router.get("/", getAccessories);

// ===== Rutas protegidas (Admin) - antes de /:idOrSlug para evitar conflicto =====

// Estadísticas de accesorios
router.get("/stats/overview", verifyToken, verifyRole(["admin"]), getAccessoryStats);

// Crear accesorio con upload de imágenes
router.post(
  "/",
  verifyToken,
  verifyRole(["admin"]),
  uploadAccessoryImages,
  handleAccessoryUploadError,
  compressAndSaveAccessoryImages,
  createAccessory
);

// ===== Ruta pública por ID o Slug =====
router.get("/:idOrSlug", getAccessoryById);

// ===== Rutas protegidas (Admin) con parámetro =====

// Actualizar accesorio con upload de imágenes
router.put(
  "/:id",
  verifyToken,
  verifyRole(["admin"]),
  uploadAccessoryImages,
  handleAccessoryUploadError,
  compressAndSaveAccessoryImages,
  updateAccessory
);

// Eliminar accesorio
router.delete("/:id", verifyToken, verifyRole(["admin"]), deleteAccessory);

// Toggle destacado
router.patch("/:id/featured", verifyToken, verifyRole(["admin"]), toggleFeatured);

// Toggle activo
router.patch("/:id/active", verifyToken, verifyRole(["admin"]), toggleActive);

export default router;
