import express from "express";
import type { ErrorRequestHandler } from "express";
import {
  getTShirtTypes,
  getTShirtTypeById,
  getTShirtTypesByCategory,
  createTShirtType,
  updateTShirtType,
  deleteTShirtType,
  toggleTShirtTypeActive,
} from "../controllers/tshirtTypeController";
import { verifyToken } from "../middlewares/auth";
import { verifyRole } from "../middlewares/roles";
import {
  uploadTShirtTypeImage,
  compressAndSaveTShirtTypeImage,
  handleTShirtTypeUploadError,
} from "../middlewares/uploadTShirtType";

const router = express.Router();

// Rutas públicas
router.get("/", getTShirtTypes);
router.get("/category/:productType", getTShirtTypesByCategory);
router.get("/:id", getTShirtTypeById);

// Rutas protegidas (Admin) - con manejo de imagen
router.post(
  "/",
  verifyToken,
  verifyRole(["admin"]),
  uploadTShirtTypeImage,
  handleTShirtTypeUploadError as ErrorRequestHandler,
  compressAndSaveTShirtTypeImage,
  createTShirtType
);

router.put(
  "/:id",
  verifyToken,
  verifyRole(["admin"]),
  uploadTShirtTypeImage,
  handleTShirtTypeUploadError as ErrorRequestHandler,
  compressAndSaveTShirtTypeImage,
  updateTShirtType
);

router.delete("/:id", verifyToken, verifyRole(["admin"]), deleteTShirtType);
router.patch("/:id/toggle-active", verifyToken, verifyRole(["admin"]), toggleTShirtTypeActive);

export default router;
