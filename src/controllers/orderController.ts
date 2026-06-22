import { Request, Response } from "express";
import axios from "axios";
import mongoose from "mongoose";
import { Preference, Payment, MercadoPagoConfig } from "mercadopago";
import { HOST, PAYPAL_API, PAYPAL_API_CLIENT, PAYPAL_API_SECRET } from "app";
import { OrderModel, IOrder, IOrderItem } from "@models/Order";
import ProductModel from "@models/Product";
import TshirtConfig from "@models/TshirtConfig";
import Accessory from "@models/Accessory";
import { UserModel } from "@models/Users";
import { getPaymentSettings } from "@models/PaymentSettings";
import { RolesRepository } from "@repositories/rolesRepository";
import { RolesService } from "@services/rolesService";
import { buildReceiptUrl } from "@middlewares/uploadReceipt";
import fs from "fs/promises";
import path from "path";

const MP_ACCESS_TOKEN_ENV =
  process.env.NODE_ENV === "production"
    ? process.env.MP_ACCESS_TOKEN
    : process.env.MP_ACCESS_TOKENtest;

const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN_ENV as string,
});

const rolesService = new RolesService(new RolesRepository());
const COMMUNITY_BONUS_DAYS = 30;

const getBaseUrl = () =>
  process.env.NODE_ENV === "production"
    ? HOST
    : `http://localhost:${process.env.PORT || 3016}`;

const isAdminRequest = (req: Request): boolean => {
  const user: any = (req as any).currentUser;
  return !!user?.roles?.some((r: any) =>
    ["admin", "superadmin"].includes(r?.name)
  );
};

const extractObjectId = (rawId: string, prefix?: string): string => {
  const candidate = prefix && rawId.startsWith(prefix) ? rawId.slice(prefix.length) : rawId;
  const match = candidate.match(/[a-f\d]{24}/i);
  return match?.[0] || candidate;
};

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const resolveCatalogItem = async (
  rawProductId: string
): Promise<Pick<IOrderItem, "productId" | "catalogType" | "sourceId" | "name" | "image" | "price"> | null> => {
  const originalId = String(rawProductId || "").trim();
  if (!originalId) return null;

  if (originalId.startsWith("config-")) {
    const configId = extractObjectId(originalId, "config-");
    if (!mongoose.isValidObjectId(configId)) return null;

    const config: any = await TshirtConfig.findById(configId)
      .populate("tshirtType", "description productType")
      .populate("design", "name description");

    if (!config || !config.isActive) return null;

    const productType =
      config.tshirtType?.productType || config.tshirtType?.description || "prenda";
    const designName = config.design?.name || "Diseño Vestis";

    return {
      productId: config._id,
      catalogType: "tshirt-config",
      sourceId: originalId,
      name: `${capitalize(productType)} - ${designName}`,
      image: config.productImage,
      price: Number(config.price),
    };
  }

  if (originalId.startsWith("accessory-")) {
    const accessoryId = extractObjectId(originalId, "accessory-");
    if (!mongoose.isValidObjectId(accessoryId)) return null;

    const accessory: any = await Accessory.findById(accessoryId);
    if (!accessory || !accessory.isActive) return null;

    return {
      productId: accessory._id,
      catalogType: "accessory",
      sourceId: originalId,
      name: accessory.name,
      image: accessory.mainImage || accessory.images?.[0],
      price: Number(accessory.price),
    };
  }

  const productId = extractObjectId(originalId);
  if (!mongoose.isValidObjectId(productId)) return null;

  const product: any = await ProductModel.findById(productId);
  if (!product) return null;

  return {
    productId: product._id,
    catalogType: "product",
    sourceId: originalId,
    name: product.name,
    image: product.image,
    price: Number(product.price),
  };
};

const grantCommunityBonus = async (order: IOrder): Promise<void> => {
  if (order.communityBonusGrantedAt) return;

  try {
    const user = await UserModel.findById(order.userId).populate("roles");
    if (!user) {
      console.warn("Community bonus skipped: user not found", order.userId);
      return;
    }

    const alreadyReceivedBonus =
      !!user.communityBonusGrantedAt ||
      user.subscription?.transactionId?.startsWith("ORDER_BONUS_");
    if (alreadyReceivedBonus) {
      console.info("Community bonus skipped: user already received it", order.userId);
      return;
    }

    const paidRoles = await rolesService.findRoles({ name: "user" });
    const paidRole = paidRoles?.[0];
    if (!paidRole) {
      console.warn("Community bonus skipped: role 'user' not found");
      return;
    }

    const currentRoles = user.roles || [];
    const currentRoleIds = currentRoles.map((role: any) => role?._id || role);
    const hasPaidRole = currentRoles.some(
      (role: any) =>
        role?.name === "user" || String(role?._id || role) === String(paidRole._id)
    );
    if (!hasPaidRole) {
      user.roles = [...currentRoleIds, paidRole._id] as any;
    }

    const paymentDate = new Date();
    const currentExpiration = user.subscription?.expirationDate
      ? new Date(user.subscription.expirationDate)
      : null;
    const baseDate =
      currentExpiration && currentExpiration > paymentDate
        ? currentExpiration
        : paymentDate;
    const expirationDate = new Date(baseDate);
    expirationDate.setDate(expirationDate.getDate() + COMMUNITY_BONUS_DAYS);

    user.subscription = {
      transactionId: `ORDER_BONUS_${order._id}`,
      paymentDate,
      expirationDate,
    };
    user.communityBonusGrantedAt = paymentDate;
    await user.save();

    order.communityBonusGrantedAt = paymentDate;
    order.communityBonusExpirationDate = expirationDate;
  } catch (error) {
    console.error("grantCommunityBonus error:", error);
  }
};

interface CreateOrderItemBody {
  productId: string;
  quantity: number;
}

/**
 * POST /orders
 * Crea un pedido en estado pendiente. El cliente luego elige método de pago.
 *
 * body: {
 *   items: [{ productId, quantity }],
 *   paymentMethod: "mercadopago" | "paypal" | "transfer" | "whatsapp",
 *   customer?: { name, email, phone }
 * }
 *
 * Para MP/PayPal/Transfer el frontend debe llamar después al endpoint
 * correspondiente para iniciar el pago.
 */
export const createOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    if (!userId) {
      res.status(401).json({ message: "No autenticado" });
      return;
    }

    const {
      items,
      paymentMethod,
      customer,
    }: {
      items: CreateOrderItemBody[];
      paymentMethod: IOrder["paymentMethod"];
      customer?: IOrder["customer"];
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: "El pedido debe tener al menos un item" });
      return;
    }

    const allowedMethods = ["mercadopago", "paypal", "transfer", "whatsapp"];
    if (!allowedMethods.includes(paymentMethod)) {
      res.status(400).json({ message: "Método de pago inválido" });
      return;
    }

    // Verificar que los métodos online estén habilitados
    const settings = await getPaymentSettings();
    if (paymentMethod === "mercadopago" && !settings.mercadopagoEnabled) {
      res.status(400).json({ message: "MercadoPago no está habilitado" });
      return;
    }
    if (paymentMethod === "paypal" && !settings.paypalEnabled) {
      res.status(400).json({ message: "PayPal no está habilitado" });
      return;
    }
    if (paymentMethod === "transfer" && !settings.transferEnabled) {
      res.status(400).json({ message: "Transferencia no está habilitada" });
      return;
    }

    const orderItems: IOrderItem[] = [];
    let total = 0;
    for (const itemInput of items) {
      const catalogItem = await resolveCatalogItem(itemInput.productId);
      if (!catalogItem) {
        res
          .status(400)
          .json({ message: `Producto no encontrado o no disponible: ${itemInput.productId}` });
        return;
      }
      const qty = Math.max(1, Math.floor(Number(itemInput.quantity) || 1));
      const subtotal = catalogItem.price * qty;
      total += subtotal;
      orderItems.push({
        ...catalogItem,
        quantity: qty,
        subtotal,
      });
    }

    // Cliente: usar provisto o derivar del usuario autenticado
    const currentUser: any = (req as any).currentUser;
    const finalCustomer = {
      name: customer?.name || currentUser?.name || "Cliente",
      email: customer?.email || currentUser?.email || "",
      phone: customer?.phone,
    };

    const order = await OrderModel.create({
      userId,
      items: orderItems,
      total,
      currency: "ARS",
      customer: finalCustomer,
      paymentMethod,
      paymentStatus: paymentMethod === "whatsapp" ? "pending" : "pending",
      fulfillmentStatus: "pending",
    });

    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    console.error("createOrder error:", error);
    res
      .status(500)
      .json({ message: "Error al crear el pedido", error: error?.message });
  }
};

/**
 * POST /orders/:id/payment/mp/create-preference
 * Crea una preferencia de MercadoPago para un pedido existente.
 */
export const createOrderMpPreference = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const { id } = req.params;

    const order = await OrderModel.findById(id);
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    if (String(order.userId) !== String(userId)) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    if (order.paymentStatus === "approved") {
      res.status(400).json({ message: "El pedido ya está pagado" });
      return;
    }

    const baseUrl = getBaseUrl();
    const successUrl = `${baseUrl}/pagoAprobado?type=order&orderId=${order._id}`;

    const body = {
      items: order.items.map((it) => ({
        id: String(it.productId),
        title: it.name,
        quantity: it.quantity,
        currency_id: "ARS",
        unit_price: Number(it.price),
      })),
      external_reference: `order:${order._id}:${userId}`,
      back_urls: {
        success: successUrl,
        failure: `${HOST}/tienda-v2?paymentStatus=failure`,
        pending: `${HOST}/tienda-v2?paymentStatus=pending`,
      },
      auto_return: "approved",
      metadata: { type: "order", orderId: String(order._id), userId },
    };

    const preference = new Preference(mercadoPagoClient);
    const result = await preference.create({ body });

    order.paymentMethod = "mercadopago";
    order.gatewayPreferenceId = result.id;
    await order.save();

    res.json({ id: result.id, init_point: (result as any).init_point });
  } catch (error: any) {
    console.error("createOrderMpPreference error:", error);
    res
      .status(500)
      .json({ message: "Error creando preferencia MP", error: error?.message });
  }
};

/**
 * GET /orders/payment/mp/capture?orderId=...&payment_id=...&status=approved
 * Llamado por el frontend tras el redirect de MP.
 */
export const captureOrderMpPreference = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId, payment_id, status } = req.query;
    if (!orderId) {
      res.status(400).json({ success: false, message: "orderId requerido" });
      return;
    }
    const order = await OrderModel.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: "Pedido no encontrado" });
      return;
    }

    if (order.paymentStatus === "approved") {
      if (!order.communityBonusGrantedAt) {
        await grantCommunityBonus(order);
        await order.save();
      }
      res.json({ success: true, alreadyPaid: true, data: order });
      return;
    }

    if (status !== "approved") {
      res
        .status(400)
        .json({ success: false, message: "Pago no aprobado por MP" });
      return;
    }

    // Verificar en MP
    let verified = false;
    try {
      const paymentApi = new Payment(mercadoPagoClient);
      const info: any = await paymentApi.get({ id: String(payment_id) });
      if (info && info.status === "approved") {
        verified = true;
        order.gatewayPayerEmail = info.payer?.email;
      }
    } catch (e) {
      console.warn("captureOrderMp verify failed, aceptando query:", e);
      verified = true;
    }

    if (!verified) {
      res
        .status(400)
        .json({ success: false, message: "No se pudo verificar el pago" });
      return;
    }

    order.gatewayPaymentId = String(payment_id);
    order.paymentStatus = "approved";
    order.fulfillmentStatus = "preparing";
    order.paidAt = new Date();
    await grantCommunityBonus(order);
    await order.save();

    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error("captureOrderMpPreference error:", error);
    res.status(500).json({ success: false, message: "Error capturando pago" });
  }
};

/**
 * POST /orders/:id/payment/paypal/create-order
 * Crea una orden en PayPal para un pedido existente.
 */
export const createOrderPaypalOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const { id } = req.params;

    const order = await OrderModel.findById(id);
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    if (String(order.userId) !== String(userId)) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    if (order.paymentStatus === "approved") {
      res.status(400).json({ message: "El pedido ya está pagado" });
      return;
    }

    const baseUrl = getBaseUrl();

    // PayPal en USD: convertimos total a USD usando ratio aproximada.
    // Para producción real conviene tener un cotizador o priceUsd por producto.
    // Por ahora enviamos el total en USD = total en ARS / 1000 (placeholder)
    // Para simplificar, enviamos el total tal cual con currency USD; el admin
    // puede ajustar el ratio en el front. Aquí pedimos valueUsd opcional.
    const valueUsd =
      Number((req.body || {}).valueUsd) || Number((order.total / 1000).toFixed(2));

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `order:${order._id}:${userId}`,
          description: `Pedido Vestis #${String(order._id).slice(-6)}`,
          amount: {
            currency_code: "USD",
            value: valueUsd.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "Vestis Evolución",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${baseUrl}/api/v1/orders/payment/paypal/capture?orderId=${order._id}`,
        cancel_url: `${HOST}/tienda-v2?paymentStatus=cancel`,
      },
    };

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    const {
      data: { access_token },
    } = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, params, {
      auth: { username: PAYPAL_API_CLIENT!, password: PAYPAL_API_SECRET! },
    });

    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      payload,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    order.paymentMethod = "paypal";
    order.gatewayOrderId = response.data?.id;
    await order.save();

    res.json(response.data);
  } catch (error: any) {
    console.error(
      "createOrderPaypalOrder error:",
      error?.response?.data || error
    );
    res.status(500).json({ message: "Error creando orden PayPal" });
  }
};

/**
 * GET /orders/payment/paypal/capture?token=...&orderId=...
 */
export const captureOrderPaypalOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, orderId } = req.query;
    if (!token || !orderId) {
      res.status(400).json({ message: "Parámetros inválidos" });
      return;
    }
    const order = await OrderModel.findById(orderId);
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    if (order.paymentStatus === "approved") {
      if (!order.communityBonusGrantedAt) {
        await grantCommunityBonus(order);
        await order.save();
      }
      res.redirect(`${HOST}/pagoAprobado?type=order&orderId=${order._id}`);
      return;
    }

    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${token}/capture`,
      {},
      {
        auth: { username: PAYPAL_API_CLIENT!, password: PAYPAL_API_SECRET! },
      }
    );

    if (response.data?.status !== "COMPLETED") {
      res.status(400).json({ message: "Pago no completado" });
      return;
    }

    order.gatewayPaymentId = response.data?.id;
    order.gatewayPayerEmail = response.data?.payer?.email_address;
    order.paymentStatus = "approved";
    order.fulfillmentStatus = "preparing";
    order.paidAt = new Date();
    await grantCommunityBonus(order);
    await order.save();

    res.redirect(`${HOST}/pagoAprobado?type=order&orderId=${order._id}`);
  } catch (error: any) {
    console.error(
      "captureOrderPaypalOrder error:",
      error?.response?.data || error
    );
    res.status(500).json({ message: "Error capturando pago PayPal" });
  }
};

/**
 * POST /orders/:id/payment/transfer
 * multipart/form-data:
 *   - receipt: archivo (imagen o PDF, max 10MB)
 *   - referenceNumber: string (N° de operación)
 *
 * Marca el pedido como `awaiting_review` esperando que el admin apruebe.
 */
export const uploadOrderReceipt = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const { id } = req.params;
    const file = req.file;
    const { referenceNumber } = req.body || {};

    if (!file) {
      res.status(400).json({ message: "Comprobante requerido" });
      return;
    }
    if (!referenceNumber || String(referenceNumber).trim().length < 2) {
      // Limpiar archivo subido
      try {
        await fs.unlink(file.path);
      } catch {}
      res.status(400).json({ message: "Número de referencia requerido" });
      return;
    }

    const order = await OrderModel.findById(id);
    if (!order) {
      try {
        await fs.unlink(file.path);
      } catch {}
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    if (String(order.userId) !== String(userId)) {
      try {
        await fs.unlink(file.path);
      } catch {}
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    if (order.paymentStatus === "approved") {
      try {
        await fs.unlink(file.path);
      } catch {}
      res.status(400).json({ message: "El pedido ya está pagado" });
      return;
    }

    // Eliminar comprobante previo si lo había
    if (order.transferReceiptUrl) {
      try {
        const prev = path.join(process.cwd(), order.transferReceiptUrl);
        await fs.unlink(prev);
      } catch {}
    }

    order.paymentMethod = "transfer";
    order.transferReceiptUrl = buildReceiptUrl(file.filename);
    order.transferReferenceNumber = String(referenceNumber).trim();
    order.paymentStatus = "awaiting_review";
    await order.save();

    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error("uploadOrderReceipt error:", error);
    res
      .status(500)
      .json({ message: "Error subiendo comprobante", error: error?.message });
  }
};

/**
 * GET /orders/my
 * Devuelve los pedidos del usuario autenticado.
 */
export const getMyOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const orders = await OrderModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("getMyOrders error:", error);
    res.status(500).json({ message: "Error obteniendo pedidos" });
  }
};

/**
 * GET /orders/:id
 * Detalle de un pedido (solo dueño o admin).
 */
export const getOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    if (String(order.userId) !== String(userId) && !isAdminRequest(req)) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/**
 * GET /orders (admin)
 * Lista todos los pedidos. Soporta ?paymentStatus= y ?paymentMethod=
 */
export const listAllOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { paymentStatus, paymentMethod, fulfillmentStatus } = req.query;
    const filter: any = {};
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (fulfillmentStatus) filter.fulfillmentStatus = fulfillmentStatus;

    const orders = await OrderModel.find(filter)
      .populate("userId", "name email username")
      .sort({ createdAt: -1 })
      .limit(1000);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("listAllOrders error:", error);
    res.status(500).json({ message: "Error" });
  }
};

/**
 * PATCH /orders/:id/admin/approve  (admin)
 * Aprueba manualmente un pago (típicamente transferencia con comprobante).
 * body: { adminNotes?: string }
 */
export const approveOrderPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = (req as any).currentUser?.id;
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    order.paymentStatus = "approved";
    order.fulfillmentStatus =
      order.fulfillmentStatus === "pending"
        ? "preparing"
        : order.fulfillmentStatus;
    order.paidAt = order.paidAt || new Date();
    order.reviewedBy = adminId;
    order.reviewedAt = new Date();
    if (req.body?.adminNotes) order.adminNotes = String(req.body.adminNotes);
    if (!order.communityBonusGrantedAt) {
      await grantCommunityBonus(order);
    }
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    console.error("approveOrderPayment error:", error);
    res.status(500).json({ message: "Error" });
  }
};

/**
 * PATCH /orders/:id/admin/reject  (admin)
 * body: { adminNotes: string }
 */
export const rejectOrderPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = (req as any).currentUser?.id;
    const { adminNotes } = req.body || {};
    if (!adminNotes) {
      res.status(400).json({ message: "Motivo requerido (adminNotes)" });
      return;
    }
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    order.paymentStatus = "rejected";
    order.reviewedBy = adminId;
    order.reviewedAt = new Date();
    order.adminNotes = String(adminNotes);
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    console.error("rejectOrderPayment error:", error);
    res.status(500).json({ message: "Error" });
  }
};

/**
 * PATCH /orders/:id/admin/fulfillment  (admin)
 * body: { fulfillmentStatus }
 */
export const updateFulfillmentStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { fulfillmentStatus } = req.body || {};
    const allowed = ["pending", "preparing", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(fulfillmentStatus)) {
      res.status(400).json({ message: "Estado inválido" });
      return;
    }
    const order = await OrderModel.findByIdAndUpdate(
      req.params.id,
      { $set: { fulfillmentStatus } },
      { new: true }
    );
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

/**
 * PATCH /orders/:id/cancel
 * El usuario dueño puede cancelar un pedido si aún no fue pagado.
 */
export const cancelOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    if (String(order.userId) !== String(userId) && !isAdminRequest(req)) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }
    if (order.paymentStatus === "approved") {
      res.status(400).json({ message: "No se puede cancelar un pedido pagado" });
      return;
    }
    order.paymentStatus = "cancelled";
    order.fulfillmentStatus = "cancelled";
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};
