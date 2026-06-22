import { Router } from "express";
import { verifyToken } from "@middlewares/auth";
import { verifyRole } from "@middlewares/roles";
import {
  getPublicPaymentSettings,
  getAdminPaymentSettings,
  updatePaymentSettings,
} from "@controllers/paymentSettingsController";

const router = Router();

// Público: el frontend lo consulta para mostrar datos bancarios y toggles
router.get("/", getPublicPaymentSettings);

// Admin
router.get(
  "/admin",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  getAdminPaymentSettings
);
router.put(
  "/",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  updatePaymentSettings
);

export default router;
