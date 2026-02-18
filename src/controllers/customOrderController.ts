import { Request, Response } from "express";
import CustomOrder from "../models/CustomOrder";
import TShirtType from "../models/TShirtType";
import Design from "../models/Design";
import TshirtConfig from "../models/TshirtConfig";

// Helper function to check if user is admin
const isAdmin = (user: any): boolean => {
  return user?.roles?.some((role: any) => role.name === "admin") || false;
};

// @desc    Obtener todos los pedidos personalizados
// @route   GET /api/custom-orders
// @access  Private
export const getCustomOrders = async (req: Request, res: Response) => {
  try {
    const { status, userId } = req.query;
    
    let query: any = {};
    
    // Si el usuario no es admin, solo ver sus propios pedidos
    if (req.currentUser && !isAdmin(req.currentUser)) {
      query.userId = (req.currentUser as any)._id;
    } else if (userId) {
      query.userId = userId;
    }
    
    if (status) {
      query.status = status;
    }
    
    const orders = await CustomOrder.find(query).sort({ orderDate: -1 });
    
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener pedidos",
      error: error.message,
    });
  }
};

// @desc    Obtener un pedido por ID
// @route   GET /api/custom-orders/:id
// @access  Private
export const getCustomOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await CustomOrder.findById(req.params.id);
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
      return;
    }
    
    // Verificar que el usuario pueda ver este pedido
    if (req.currentUser && !isAdmin(req.currentUser) && order.userId.toString() !== (req.currentUser as any)._id.toString()) {
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener el pedido",
      error: error.message,
    });
  }
};

// @desc    Crear un pedido personalizado
// @route   POST /api/custom-orders
// @access  Private
export const createCustomOrder = async (req: Request, res: Response): Promise<void> => {
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
    const tshirtType = await TShirtType.findById(tshirtTypeId);
    if (!tshirtType || !tshirtType.isActive) {
      res.status(404).json({
        success: false,
        message: "Tipo de producto no disponible",
      });
      return;
    }
    
    // Verificar que el diseño existe
    const design = await Design.findById(designId);
    if (!design || !design.isActive) {
      res.status(404).json({
        success: false,
        message: "Diseño no disponible",
      });
      return;
    }
    
    // Nota: Las validaciones de color y talle ahora se manejan en TShirtConfig
    // TShirtType solo define si es remera o musculosa
    
    // Buscar la configuración que coincide con tipo + diseño + color
    const config = await TshirtConfig.findOne({
      tshirtType: tshirtTypeId,
      design: designId,
      color: (color as string).toLowerCase(),
      isActive: true,
    });

    if (!config) {
      res.status(404).json({
        success: false,
        message: "No existe una configuración para esta combinación de tipo, diseño y color",
      });
      return;
    }

    // Calcular precio final usando el precio de la config
    const finalPrice = config.price * quantity;
    
    // Crear el pedido
    const order = await CustomOrder.create({
      userId: (req.currentUser as any)._id,
      tshirtType: tshirtTypeId,
      design: designId,
      color,
      size,
      quantity,
      finalPrice,
      status: "pending",
    });
    
    // Populate para devolver data completa
    const populatedOrder = await CustomOrder.findById(order._id);
    
    res.status(201).json({
      success: true,
      message: "Pedido creado exitosamente",
      data: populatedOrder,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al crear el pedido",
      error: error.message,
    });
  }
};

// @desc    Actualizar estado de pedido
// @route   PUT /api/custom-orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
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
    
    const order = await CustomOrder.findById(req.params.id);
    
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al actualizar el estado",
      error: error.message,
    });
  }
};

// @desc    Cancelar un pedido
// @route   PUT /api/custom-orders/:id/cancel
// @access  Private
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await CustomOrder.findById(req.params.id);
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
      return;
    }
    
    // Verificar que el usuario pueda cancelar este pedido
    if (req.currentUser && !isAdmin(req.currentUser) && order.userId.toString() !== (req.currentUser as any)._id.toString()) {
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
    
    // Nota: No se gestiona stock
    
    order.status = "cancelled";
    await order.save();
    
    res.status(200).json({
      success: true,
      message: "Pedido cancelado exitosamente",
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al cancelar el pedido",
      error: error.message,
    });
  }
};

// @desc    Eliminar un pedido
// @route   DELETE /api/custom-orders/:id
// @access  Private/Admin
export const deleteCustomOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await CustomOrder.findById(req.params.id);
    
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al eliminar el pedido",
      error: error.message,
    });
  }
};

// @desc    Obtener estadísticas de pedidos
// @route   GET /api/custom-orders/stats
// @access  Private/Admin
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const totalOrders = await CustomOrder.countDocuments();
    const pendingOrders = await CustomOrder.countDocuments({ status: "pending" });
    const processingOrders = await CustomOrder.countDocuments({ status: "processing" });
    const completedOrders = await CustomOrder.countDocuments({ status: "completed" });
    const cancelledOrders = await CustomOrder.countDocuments({ status: "cancelled" });
    
    // Calcular ingresos totales
    const completedOrdersList = await CustomOrder.find({ status: "completed" });
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener estadísticas",
      error: error.message,
    });
  }
};
