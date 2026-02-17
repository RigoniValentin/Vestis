"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const noticeController_1 = require("@controllers/noticeController");
const auth_1 = require("@middlewares/auth");
const roles_1 = require("@middlewares/roles");
const router = (0, express_1.Router)();
// Rutas para usuarios autenticados (ver avisos activos)
router.get("/active", auth_1.verifyToken, noticeController_1.NoticeController.getActiveNotices);
router.get("/urgent", auth_1.verifyToken, noticeController_1.NoticeController.getUrgentNotices);
// Rutas protegidas (solo admin/superadmin)
router.get("/", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.getAllNotices);
router.get("/admin/stats", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.getNoticeStats);
router.post("/admin/cleanup", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.cleanupExpiredNotices);
router.get("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.getNoticeById);
router.post("/", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.createNotice);
router.put("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.updateNotice);
router.patch("/:id/toggle", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.toggleNoticeStatus);
router.delete("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), noticeController_1.NoticeController.deleteNotice);
exports.default = router;
