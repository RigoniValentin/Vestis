import { Router } from "express";
import { verifyToken } from "@middlewares/auth";
import { verifyRole } from "@middlewares/roles";
import { reconcilePaypalPayment } from "@controllers/paypalReconcileController";

const router = Router();

/**
 * POST /api/v1/admin/paypal/reconcile
 * Auth: admin / superadmin
 *
 * Permite reconciliar manualmente pagos PayPal que no actualizaron la DB
 * (caso clásico: el usuario cerró la pestaña antes del redirect a return_url
 * y la plataforma nunca se enteró del pago).
 *
 * Body ejemplo - suscripcion:
 *   {
 *     "kind": "subscription",
 *     "transactionId": "5AB12345CD678901E",
 *     "email": "usuario@dominio.com"
 *   }
 *
 * Body ejemplo - tienda:
 *   {
 *     "kind": "order",
 *     "transactionId": "5AB12345CD678901E",
 *     "orderId": "67abc123..."
 *   }
 *
 * Body ejemplo - documental:
 *   {
 *     "kind": "documentary",
 *     "transactionId": "5AB12345CD678901E",
 *     "email": "usuario@dominio.com",
 *     "slug": "humano-existes"
 *   }
 */
router.post(
  "/paypal/reconcile",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  reconcilePaypalPayment
);

export default router;
