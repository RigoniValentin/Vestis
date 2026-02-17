"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const customOrderController_1 = require("../controllers/customOrderController");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const router = express_1.default.Router();
// Todas las rutas requieren autenticación
router.use(auth_1.verifyToken);
// Rutas para usuarios autenticados
router.get("/", customOrderController_1.getCustomOrders);
router.get("/:id", customOrderController_1.getCustomOrderById);
router.post("/", customOrderController_1.createCustomOrder);
router.put("/:id/cancel", customOrderController_1.cancelOrder);
// Rutas solo para admin
router.put("/:id/status", (0, roles_1.verifyRole)(["admin"]), customOrderController_1.updateOrderStatus);
router.delete("/:id", (0, roles_1.verifyRole)(["admin"]), customOrderController_1.deleteCustomOrder);
router.get("/stats/overview", (0, roles_1.verifyRole)(["admin"]), customOrderController_1.getOrderStats);
exports.default = router;
