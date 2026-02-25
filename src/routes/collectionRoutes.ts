import express from "express";
import {
  getCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
} from "../controllers/collectionController";
import { verifyToken } from "../middlewares/auth";
import { verifyRole } from "../middlewares/roles";

const router = express.Router();

// Rutas públicas
router.get("/", getCollections);
router.get("/:id", getCollectionById);

// Rutas protegidas (Admin)
router.post("/", verifyToken, verifyRole(["admin"]), createCollection);
router.put("/:id", verifyToken, verifyRole(["admin"]), updateCollection);
router.delete("/:id", verifyToken, verifyRole(["admin"]), deleteCollection);

export default router;
