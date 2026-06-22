import { Router } from "express";
import { verifyToken } from "@middlewares/auth";
import { verifyRole } from "@middlewares/roles";
import { uploadReceipt } from "@middlewares/uploadReceipt";
import {
  uploadSubscriptionReceipt,
  getMySubscriptionTransfers,
  listSubscriptionTransfers,
  approveSubscriptionTransfer,
  rejectSubscriptionTransfer,
} from "@controllers/subscriptionTransferController";

const router = Router();

// Usuario
router.post(
  "/transfer",
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
  uploadSubscriptionReceipt
);
router.get("/transfer/my", verifyToken, getMySubscriptionTransfers);

// Admin
router.get(
  "/transfer",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  listSubscriptionTransfers
);
router.patch(
  "/transfer/:id/approve",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  approveSubscriptionTransfer
);
router.patch(
  "/transfer/:id/reject",
  verifyToken,
  verifyRole(["admin", "superadmin"]),
  rejectSubscriptionTransfer
);

export default router;
