import express from "express";
import {
  getCustomOrders,
  getCustomOrderById,
  createCustomOrder,
  updateOrderStatus,
  cancelOrder,
  deleteCustomOrder,
  getOrderStats,
} from "../controllers/customOrderController";
import { verifyToken } from "../middlewares/auth";
import { verifyRole } from "../middlewares/roles";

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para usuarios autenticados
router.get("/", getCustomOrders);
router.get("/:id", getCustomOrderById);
router.post("/", createCustomOrder);
router.put("/:id/cancel", cancelOrder);

// Rutas solo para admin
router.put("/:id/status", verifyRole(["admin"]), updateOrderStatus);
router.delete("/:id", verifyRole(["admin"]), deleteCustomOrder);
router.get("/stats/overview", verifyRole(["admin"]), getOrderStats);

export default router;
