import { Router } from "express";
import { verifyToken } from "@middlewares/auth";
import { verifyRole } from "@middlewares/roles";
import {
  listUsers,
  getUser,
  createUserAdmin,
  updateUserAdmin,
  updateUserRolesAdmin,
  resetUserPasswordAdmin,
  setUserSubscriptionAdmin,
  cancelUserSubscriptionAdmin,
  softDeleteUserAdmin,
  restoreUserAdmin,
  getUserDocumentaryAccess,
  grantUserDocumentaryAccessAdmin,
  revokeUserDocumentaryAccessAdmin,
} from "@controllers/adminUsersController";

const router = Router();

router.use(verifyToken, verifyRole(["admin", "superadmin"]));

router.get("/", listUsers);
router.get("/:id", getUser);
router.post("/", createUserAdmin);
router.put("/:id", updateUserAdmin);
router.put("/:id/roles", updateUserRolesAdmin);
router.put("/:id/password", resetUserPasswordAdmin);
router.put("/:id/subscription", setUserSubscriptionAdmin);
router.delete("/:id/subscription", cancelUserSubscriptionAdmin);
router.delete("/:id", softDeleteUserAdmin);
router.post("/:id/restore", restoreUserAdmin);

router.get("/:id/documentary-access", getUserDocumentaryAccess);
router.post("/:id/documentary-access", grantUserDocumentaryAccessAdmin);
router.delete(
  "/:id/documentary-access/:purchaseId",
  revokeUserDocumentaryAccessAdmin
);

export default router;
