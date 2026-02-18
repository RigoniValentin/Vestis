import express from "express";
import type { ErrorRequestHandler } from "express";
import {
  getTshirtConfigs,
  getTshirtConfigById,
  findMatchingConfig,
  getTshirtConfigStats,
  createTshirtConfig,
  updateTshirtConfig,
  deleteTshirtConfig,
  toggleTshirtConfigActive,
} from "../controllers/tshirtConfigController";
import { verifyToken } from "../middlewares/auth";
import { verifyRole } from "../middlewares/roles";
import {
  uploadTshirtConfigImage,
  compressAndSaveConfigImage,
  handleConfigUploadError,
} from "../middlewares/uploadTshirtConfig";

const router = express.Router();

// Rutas públicas
router.get("/", getTshirtConfigs);
router.get("/match", findMatchingConfig);

// Rutas protegidas (Admin) - antes de /:id para evitar conflicto
router.get("/stats/overview", verifyToken, verifyRole(["admin"]), getTshirtConfigStats);

// Ruta pública por ID
router.get("/:id", getTshirtConfigById);

// Rutas protegidas (Admin) con upload de imagen
router.post(
  "/",
  verifyToken,
  verifyRole(["admin"]),
  uploadTshirtConfigImage,
  handleConfigUploadError as ErrorRequestHandler,
  compressAndSaveConfigImage,
  createTshirtConfig
);
router.put(
  "/:id",
  verifyToken,
  verifyRole(["admin"]),
  uploadTshirtConfigImage,
  handleConfigUploadError as ErrorRequestHandler,
  compressAndSaveConfigImage,
  updateTshirtConfig
);
router.delete("/:id", verifyToken, verifyRole(["admin"]), deleteTshirtConfig);
router.patch("/:id/toggle-active", verifyToken, verifyRole(["admin"]), toggleTshirtConfigActive);

export default router;
