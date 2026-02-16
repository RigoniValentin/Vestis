import express from "express";
import type { ErrorRequestHandler } from "express";
import {
  getDesigns,
  getDesignById,
  getDesignsByYear,
  getAvailableYears,
  createDesign,
  updateDesign,
  deleteDesign,
  toggleDesignActive,
} from "../controllers/designController";
import { verifyToken } from "../middlewares/auth";
import { verifyRole } from "../middlewares/roles";
import {
  uploadDesignImage,
  compressAndSaveDesignImage,
  handleDesignUploadError,
} from "../middlewares/uploadDesign";

const router = express.Router();

// Rutas públicas
router.get("/", getDesigns);
router.get("/years/available", getAvailableYears);
router.get("/year/:year", getDesignsByYear);
router.get("/:id", getDesignById);

// Rutas protegidas (Admin) - con manejo de imagen
router.post(
  "/",
  verifyToken,
  verifyRole(["admin"]),
  uploadDesignImage,
  handleDesignUploadError as ErrorRequestHandler,
  compressAndSaveDesignImage,
  createDesign
);

router.put(
  "/:id",
  verifyToken,
  verifyRole(["admin"]),
  uploadDesignImage,
  handleDesignUploadError as ErrorRequestHandler,
  compressAndSaveDesignImage,
  updateDesign
);

router.delete("/:id", verifyToken, verifyRole(["admin"]), deleteDesign);
router.patch("/:id/toggle-active", verifyToken, verifyRole(["admin"]), toggleDesignActive);

export default router;
