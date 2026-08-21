import { Router } from "express";
import { verifyToken } from "@middlewares/auth";
import { verifyRole } from "@middlewares/roles";
import { uploadReceipt } from "@middlewares/uploadReceipt";
import {
  getDocumentaryPublic,
  getDocumentaryPlayback,
  getOwnership,
  upsertDocumentary,
  listDocumentaries,
  listPurchases,
  grantAccess,
  revokeAccess,
  uploadDocumentaryImages,
} from "@controllers/documentaryController";
import {
  createDocumentaryMpPreference,
  captureDocumentaryMpPreference,
  createDocumentaryPaypalOrder,
  captureDocumentaryPaypalOrder,
} from "@controllers/documentaryPaymentController";
import {
  uploadDocumentaryReceipt,
  uploadDocumentaryPrexReceipt,
  listAllDocumentaryPurchases,
  approveDocumentaryPurchase,
  rejectDocumentaryPurchase,
  getMyDocumentaryPurchases,
} from "@controllers/documentaryTransferController";

const router = Router();

// Captura de pagos (públicos, los confirma por params)
router.get("/payment/mp/capture", captureDocumentaryMpPreference);
router.get("/payment/paypal/capture", captureDocumentaryPaypalOrder);

// Admin: lista global de compras de documentales (debe ir antes que /:slug)
router.get(
  "/admin/purchases",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  listAllDocumentaryPurchases
);
router.patch(
  "/purchases/:id/approve",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  approveDocumentaryPurchase
);
router.patch(
  "/purchases/:id/reject",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  rejectDocumentaryPurchase
);

// Compras propias del usuario
router.get("/my-purchases", verifyToken, getMyDocumentaryPurchases);

// Información pública del documental
router.get("/", getDocumentaryPublic); // default slug
router.get("/:slug", getDocumentaryPublic);

// Verificación de propiedad / playback (autenticado)
router.get("/:slug/ownership", verifyToken, getOwnership);
router.get("/:slug/playback", verifyToken, getDocumentaryPlayback);

// Crear preferencia/orden de pago (autenticado)
router.post(
  "/:slug/payment/mp/create-preference",
  verifyToken,
  createDocumentaryMpPreference
);
router.get(
  "/:slug/payment/paypal/create-order",
  verifyToken,
  createDocumentaryPaypalOrder
);

// Pago por transferencia (subida de comprobante)
router.post(
  "/:slug/payment/transfer",
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
  uploadDocumentaryReceipt
);
router.post(
  "/:slug/payment/prex",
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
  uploadDocumentaryPrexReceipt
);

// Admin
router.get(
  "/admin/all",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  listDocumentaries
);
router.put(
  "/:slug",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  upsertDocumentary
);
router.post(
  "/:slug/images",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  ...(uploadDocumentaryImages as any[])
);
router.get(
  "/:slug/purchases",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  listPurchases
);
router.post(
  "/:slug/grant",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  grantAccess
);
router.delete(
  "/:slug/purchases/:id",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  revokeAccess
);

export default router;
