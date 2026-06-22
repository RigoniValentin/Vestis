import { Router } from "express";
import { verifyToken } from "@middlewares/auth";
import { verifyRole } from "@middlewares/roles";
import { uploadReceipt } from "@middlewares/uploadReceipt";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  listAllOrders,
  createOrderMpPreference,
  captureOrderMpPreference,
  createOrderPaypalOrder,
  captureOrderPaypalOrder,
  uploadOrderReceipt,
  approveOrderPayment,
  rejectOrderPayment,
  updateFulfillmentStatus,
  cancelOrder,
} from "@controllers/orderController";

const router = Router();

// Callbacks de gateway (públicos, identifican el pedido por query)
router.get("/payment/mp/capture", captureOrderMpPreference);
router.get("/payment/paypal/capture", captureOrderPaypalOrder);

// Usuario autenticado
router.post("/", verifyToken, createOrder);
router.get("/my", verifyToken, getMyOrders);
router.get("/:id", verifyToken, getOrderById);
router.patch("/:id/cancel", verifyToken, cancelOrder);

// Iniciar pago para un pedido
router.post(
  "/:id/payment/mp/create-preference",
  verifyToken,
  createOrderMpPreference
);
router.post(
  "/:id/payment/paypal/create-order",
  verifyToken,
  createOrderPaypalOrder
);
router.post(
  "/:id/payment/transfer",
  verifyToken,
  (req, res, next) => {
    uploadReceipt(req, res, (err: any) => {
      if (err) {
        return res
          .status(400)
          .json({ success: false, message: err.message || "Error de subida" });
      }
      next();
    });
  },
  uploadOrderReceipt
);

// Admin
router.get(
  "/",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  listAllOrders
);
router.patch(
  "/:id/admin/approve",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  approveOrderPayment
);
router.patch(
  "/:id/admin/reject",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  rejectOrderPayment
);
router.patch(
  "/:id/admin/fulfillment",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  updateFulfillmentStatus
);

export default router;
