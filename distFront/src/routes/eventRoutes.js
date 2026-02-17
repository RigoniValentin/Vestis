"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventController_1 = require("@controllers/eventController");
const auth_1 = require("@middlewares/auth");
const roles_1 = require("@middlewares/roles");
const router = (0, express_1.Router)();
// Rutas públicas (sin autenticación)
router.get("/", eventController_1.EventController.getEvents);
router.get("/month/:year/:month", eventController_1.EventController.getEventsByMonth);
router.get("/:id", eventController_1.EventController.getEventById);
// Rutas protegidas (solo admin/superadmin)
router.post("/", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), eventController_1.EventController.createEvent);
router.put("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), eventController_1.EventController.updateEvent);
router.delete("/:id", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), eventController_1.EventController.deleteEvent);
router.get("/admin/stats", auth_1.verifyToken, (0, roles_1.verifyRole)(["admin", "superadmin"]), eventController_1.EventController.getEventStats);
exports.default = router;
