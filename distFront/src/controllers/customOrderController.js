"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStats = exports.deleteCustomOrder = exports.cancelOrder = exports.updateOrderStatus = exports.createCustomOrder = exports.getCustomOrderById = exports.getCustomOrders = void 0;
const CustomOrder_1 = __importDefault(require("../models/CustomOrder"));
const TShirtType_1 = __importDefault(require("../models/TShirtType"));
const Design_1 = __importDefault(require("../models/Design"));
const TshirtConfig_1 = __importDefault(require("../models/TshirtConfig"));
// Helper function to check if user is admin
const isAdmin = (user) => {
    return user?.roles?.some((role) => role.name === "admin") || false;
};
// @desc    Obtener todos los pedidos personalizados
// @route   GET /api/custom-orders
// @access  Private
const getCustomOrders = async (req, res) => {
    try {
        const { status, userId } = req.query;
        let query = {};
        // Si el usuario no es admin, solo ver sus propios pedidos
        if (req.currentUser && !isAdmin(req.currentUser)) {
            query.userId = req.currentUser._id;
        }
        else if (userId) {
            query.userId = userId;
        }
        if (status) {
            query.status = status;
        }
        const orders = await CustomOrder_1.default.find(query).sort({ orderDate: -1 });
        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener pedidos",
            error: error.message,
        });
    }
};
exports.getCustomOrders = getCustomOrders;
// @desc    Obtener un pedido por ID
// @route   GET /api/custom-orders/:id
// @access  Private
const getCustomOrderById = async (req, res) => {
    try {
        const order = await CustomOrder_1.default.findById(req.params.id);
        if (!order) {
            res.status(404).json({
                success: false,
                message: "Pedido no encontrado",
            });
            return;
        }
        // Verificar que el usuario pueda ver este pedido
        if (req.currentUser && !isAdmin(req.currentUser) && order.userId.toString() !== req.currentUser._id.toString()) {
            res.status(403).json({
                success: false,
                message: "No autorizado para ver este pedido",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: order,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener el pedido",
            error: error.message,
        });
    }
};
exports.getCustomOrderById = getCustomOrderById;
// @desc    Crear un pedido personalizado
// @route   POST /api/custom-orders
// @access  Private
const createCustomOrder = async (req, res) => {
    try {
        const { tshirtTypeId, designId, color, size, quantity } = req.body;
        // Validar campos requeridos
        if (!tshirtTypeId || !designId || !color || !size || !quantity) {
            res.status(400).json({
                success: false,
                message: "Todos los campos son requeridos",
            });
            return;
        }
        // Verificar que el tipo de remera existe
        const tshirtType = await TShirtType_1.default.findById(tshirtTypeId);
        if (!tshirtType || !tshirtType.isActive) {
            res.status(404).json({
                success: false,
                message: "Tipo de producto no disponible",
            });
            return;
        }
        // Verificar que el diseño existe
        const design = await Design_1.default.findById(designId);
        if (!design || !design.isActive) {
            res.status(404).json({
                success: false,
                message: "Diseño no disponible",
            });
            return;
        }
        // Nota: Las validaciones de color, talle y stock ahora se manejan en TShirtConfig
        // TShirtType solo define si es remera o musculosa
        // Buscar la configuración que coincide con tipo + diseño + color
        const config = await TshirtConfig_1.default.findOne({
            tshirtType: tshirtTypeId,
            design: designId,
            color: color.toLowerCase(),
            isActive: true,
        });
        if (!config) {
            res.status(404).json({
                success: false,
                message: "No existe una configuración para esta combinación de tipo, diseño y color",
            });
            return;
        }
        // Verificar stock para el talle solicitado
        const stockItem = config.stock.find((s) => s.size === size.toUpperCase());
        if (!stockItem || stockItem.quantity < quantity) {
            res.status(400).json({
                success: false,
                message: `Stock insuficiente. Solo hay ${stockItem?.quantity || 0} unidades disponibles para el talle ${size}.`,
            });
            return;
        }
        // Calcular precio final usando el precio de la config
        const finalPrice = config.price * quantity;
        // Crear el pedido
        const order = await CustomOrder_1.default.create({
            userId: req.currentUser._id,
            tshirtType: tshirtTypeId,
            design: designId,
            color,
            size,
            quantity,
            finalPrice,
            status: "pending",
        });
        // Actualizar stock (restar cantidad)
        stockItem.quantity -= quantity;
        await config.save();
        // Populate para devolver data completa
        const populatedOrder = await CustomOrder_1.default.findById(order._id);
        res.status(201).json({
            success: true,
            message: "Pedido creado exitosamente",
            data: populatedOrder,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al crear el pedido",
            error: error.message,
        });
    }
};
exports.createCustomOrder = createCustomOrder;
// @desc    Actualizar estado de pedido
// @route   PUT /api/custom-orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            res.status(400).json({
                success: false,
                message: "El estado es requerido",
            });
            return;
        }
        const validStatuses = ["pending", "processing", "completed", "cancelled"];
        if (!validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                message: "Estado inválido",
            });
            return;
        }
        const order = await CustomOrder_1.default.findById(req.params.id);
        if (!order) {
            res.status(404).json({
                success: false,
                message: "Pedido no encontrado",
            });
            return;
        }
        order.status = status;
        await order.save();
        res.status(200).json({
            success: true,
            message: "Estado actualizado exitosamente",
            data: order,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al actualizar el estado",
            error: error.message,
        });
    }
};
exports.updateOrderStatus = updateOrderStatus;
// @desc    Cancelar un pedido
// @route   PUT /api/custom-orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
    try {
        const order = await CustomOrder_1.default.findById(req.params.id);
        if (!order) {
            res.status(404).json({
                success: false,
                message: "Pedido no encontrado",
            });
            return;
        }
        // Verificar que el usuario pueda cancelar este pedido
        if (req.currentUser && !isAdmin(req.currentUser) && order.userId.toString() !== req.currentUser._id.toString()) {
            res.status(403).json({
                success: false,
                message: "No autorizado para cancelar este pedido",
            });
            return;
        }
        // Solo se puede cancelar si está pending o processing
        if (order.status === "completed" || order.status === "cancelled") {
            res.status(400).json({
                success: false,
                message: "No se puede cancelar un pedido completado o ya cancelado",
            });
            return;
        }
        // Nota: La gestión de stock ahora se maneja en TShirtConfig, no en TShirtType
        // TODO: Implementar lógica de devolución de stock si es necesario
        order.status = "cancelled";
        await order.save();
        res.status(200).json({
            success: true,
            message: "Pedido cancelado exitosamente",
            data: order,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al cancelar el pedido",
            error: error.message,
        });
    }
};
exports.cancelOrder = cancelOrder;
// @desc    Eliminar un pedido
// @route   DELETE /api/custom-orders/:id
// @access  Private/Admin
const deleteCustomOrder = async (req, res) => {
    try {
        const order = await CustomOrder_1.default.findById(req.params.id);
        if (!order) {
            res.status(404).json({
                success: false,
                message: "Pedido no encontrado",
            });
            return;
        }
        await order.deleteOne();
        res.status(200).json({
            success: true,
            message: "Pedido eliminado exitosamente",
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al eliminar el pedido",
            error: error.message,
        });
    }
};
exports.deleteCustomOrder = deleteCustomOrder;
// @desc    Obtener estadísticas de pedidos
// @route   GET /api/custom-orders/stats
// @access  Private/Admin
const getOrderStats = async (req, res) => {
    try {
        const totalOrders = await CustomOrder_1.default.countDocuments();
        const pendingOrders = await CustomOrder_1.default.countDocuments({ status: "pending" });
        const processingOrders = await CustomOrder_1.default.countDocuments({ status: "processing" });
        const completedOrders = await CustomOrder_1.default.countDocuments({ status: "completed" });
        const cancelledOrders = await CustomOrder_1.default.countDocuments({ status: "cancelled" });
        // Calcular ingresos totales
        const completedOrdersList = await CustomOrder_1.default.find({ status: "completed" });
        const totalRevenue = completedOrdersList.reduce((sum, order) => sum + order.finalPrice, 0);
        res.status(200).json({
            success: true,
            data: {
                totalOrders,
                pendingOrders,
                processingOrders,
                completedOrders,
                cancelledOrders,
                totalRevenue,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener estadísticas",
            error: error.message,
        });
    }
};
exports.getOrderStats = getOrderStats;
