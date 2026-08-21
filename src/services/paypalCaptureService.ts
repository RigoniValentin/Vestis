import axios from "axios";
import { UserModel } from "@models/Users";
import { RolesModel } from "@models/Roles";
import { OrderModel, IOrder } from "@models/Order";
import { DocumentaryModel } from "@models/Documentary";
import { DocumentaryPurchaseModel } from "@models/DocumentaryPurchase";
import { PAYPAL_API, PAYPAL_API_CLIENT, PAYPAL_API_SECRET } from "app";
import {
  getPaymentSettings,
  getSubscriptionDurationDays,
} from "@models/PaymentSettings";

export type PaypalCaptureKind = "subscription" | "order" | "documentary";

export interface FetchedPaypalOrder {
  id: string;
  status: string;
  payerEmail?: string;
  value?: number;
  currency?: string;
  capturedAt?: Date | null;
  raw: any;
}

export class PaypalOrderNotFoundError extends Error {
  constructor(public readonly transactionId: string) {
    super(`PayPal order ${transactionId} not found`);
    this.name = "PaypalOrderNotFoundError";
  }
}

export class PaypalOrderNotCompletedError extends Error {
  constructor(
    public readonly transactionId: string,
    public readonly status: string
  ) {
    super(`PayPal order ${transactionId} is not COMPLETED (status=${status})`);
    this.name = "PaypalOrderNotCompletedError";
  }
}

export class CurrencyMismatchError extends Error {
  constructor(public readonly got: string, public readonly expected: string) {
    super(`Currency mismatch: got ${got}, expected ${expected}`);
    this.name = "CurrencyMismatchError";
  }
}

export class AmountMismatchError extends Error {
  constructor(
    public readonly got: number,
    public readonly expected: number,
    public readonly tolerance: number
  ) {
    super(
      `Amount mismatch: got ${got}, expected ${expected} ± ${tolerance.toFixed(2)}`
    );
    this.name = "AmountMismatchError";
  }
}

async function getPayPalAccessToken(): Promise<string> {
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  const { data } = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, params, {
    auth: {
      username: PAYPAL_API_CLIENT!,
      password: PAYPAL_API_SECRET!,
    },
  });
  return data.access_token as string;
}

/**
 * Trae una orden de PayPal por su id y devuelve los datos normalizados
 * del capture (única fuente de verdad para validar el pago).
 */
export async function fetchPayPalOrder(
  transactionId: string
): Promise<FetchedPaypalOrder> {
  const accessToken = await getPayPalAccessToken();
  const { data } = await axios.get(
    `${PAYPAL_API}/v2/checkout/orders/${transactionId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    id: data?.id || transactionId,
    status: data?.status || "UNKNOWN",
    payerEmail: data?.payer?.email_address,
    value: capture ? Number(capture.amount?.value) : undefined,
    currency: capture
      ? String(capture.amount?.currency_code || "").toUpperCase()
      : undefined,
    capturedAt: capture?.create_time ? new Date(capture.create_time) : null,
    raw: data,
  };
}

/**
 * Verifica contra PayPal que el pago está COMPLETED y el monto capturado
 * coincide con el esperado (admite tolerancia del 5% por fees o redondeos).
 */
export async function assertPaypalSubscriptionCompleted(
  transactionId: string
): Promise<FetchedPaypalOrder> {
  const order = await fetchPayPalOrder(transactionId);
  if (!order.status || order.status === "UNKNOWN") {
    throw new PaypalOrderNotFoundError(transactionId);
  }
  if (order.status !== "COMPLETED") {
    throw new PaypalOrderNotCompletedError(transactionId, order.status);
  }
  if (!order.value || !order.currency) {
    throw new PaypalOrderNotFoundError(transactionId);
  }
  if (order.currency !== "USD") {
    throw new CurrencyMismatchError(order.currency, "USD");
  }

  const settings = await getPaymentSettings();
  const expectedUsd = settings.subscription?.paypalUsd ?? 13;
  const tolerance = Math.max(0.5, expectedUsd * 0.05);
  if (Math.abs(order.value - expectedUsd) > tolerance) {
    throw new AmountMismatchError(order.value, expectedUsd, tolerance);
  }
  return order;
}

export interface ApplySubscriptionCaptureInput {
  userId: string;
  transactionId: string;
  paymentDate: Date;
}

/**
 * Aplica (o reaplica idempotentemente) la suscripción al usuario.
 * Idempotente: si el transactionId ya coincide con el guardado, no duplica.
 *  - subscription.transactionId
 *  - subscription.paymentDate
 *  - subscription.expirationDate (+durationDays desde PaymentSettings)
 *  - rol "user" agregado sin pisar roles existentes (admin, superadmin, etc.)
 */
export async function applySubscriptionCapture(
  input: ApplySubscriptionCaptureInput
): Promise<{ alreadyApplied: boolean; userId: string }> {
  const { userId, transactionId, paymentDate } = input;

  const user = await UserModel.findById(userId);
  if (!user) throw new Error(`User ${userId} not found`);

  if (
    user.subscription &&
    user.subscription.transactionId === transactionId
  ) {
    return { alreadyApplied: true, userId: String(user._id) };
  }

  const paidUserRole = await RolesModel.findOne({ name: "user" });
  if (!paidUserRole) throw new Error("Rol 'user' no encontrado en la DB");

  const durationDays = await getSubscriptionDurationDays();
  const expirationDate = new Date(paymentDate);
  expirationDate.setDate(expirationDate.getDate() + durationDays);

  user.roles = user.roles || [];
  const alreadyHas = user.roles.some(
    (r) => String(r._id) === String(paidUserRole._id)
  );
  if (!alreadyHas) user.roles.push(paidUserRole);

  user.subscription = {
    transactionId,
    paymentDate,
    expirationDate,
  };

  await user.save();
  return { alreadyApplied: false, userId: String(user._id) };
}

export interface ApplyOrderCaptureInput {
  orderId: string;
  transactionId: string;
  payerEmail?: string;
  grantCommunityBonusFn?: (order: IOrder) => Promise<void>;
}

/**
 * Marca una Order de tienda como pagada vía PayPal.
 * Idempotente: si paymentStatus ya es "approved", no duplica.
 *
 * El caller puede pasar `grantCommunityBonusFn` para reutilizar la lógica
 * existente en orderController (mantiene una sola implementación).
 * Si no se pasa, NO se otorga el bonus (útil para casos donde ya se otorgó).
 */
export async function applyOrderCapture(
  input: ApplyOrderCaptureInput
): Promise<{ alreadyApplied: boolean; orderId: string }> {
  const order = await OrderModel.findById(input.orderId);
  if (!order) throw new Error(`Order ${input.orderId} not found`);

  if (order.paymentStatus === "approved") {
    if (!order.communityBonusGrantedAt && input.grantCommunityBonusFn) {
      await input.grantCommunityBonusFn(order);
      await order.save();
    }
    return { alreadyApplied: true, orderId: String(order._id) };
  }

  order.paymentMethod = "paypal";
  order.gatewayOrderId = order.gatewayOrderId || input.transactionId;
  order.gatewayPaymentId = input.transactionId;
  if (input.payerEmail) order.gatewayPayerEmail = input.payerEmail;
  order.paymentStatus = "approved";
  order.fulfillmentStatus = "preparing";
  order.paidAt = new Date();

  if (input.grantCommunityBonusFn) {
    await input.grantCommunityBonusFn(order);
  }
  await order.save();
  return { alreadyApplied: false, orderId: String(order._id) };
}

export interface ApplyDocumentaryCaptureInput {
  userId: string;
  slug: string;
  transactionId: string;
}

/**
 * Aplica la compra de un documental vía PayPal.
 * Idempotente: si ya hay un purchase approved para (userId, slug), no duplica.
 */
export async function applyDocumentaryCapture(
  input: ApplyDocumentaryCaptureInput
): Promise<{ alreadyApplied: boolean; purchaseId: string }> {
  const { userId, slug, transactionId } = input;

  const existing = await DocumentaryPurchaseModel.findOne({
    userId,
    documentarySlug: slug,
    status: "approved",
  });
  if (existing) {
    return { alreadyApplied: true, purchaseId: String(existing._id) };
  }

  const doc = await DocumentaryModel.findOne({ slug }).lean();

  const updated = await DocumentaryPurchaseModel.findOneAndUpdate(
    { userId, documentarySlug: slug, status: "pending" },
    {
      $set: {
        status: "approved",
        transactionId,
        paidAt: new Date(),
      },
    },
    { upsert: true, setDefaultsOnInsert: true, new: true }
  );

  if (updated) {
    return { alreadyApplied: false, purchaseId: String(updated._id) };
  }

  if (doc) {
    const created = await DocumentaryPurchaseModel.create({
      userId,
      documentarySlug: slug,
      method: "paypal",
      amount: doc.priceUsd,
      currency: "USD",
      status: "approved",
      transactionId,
      paidAt: new Date(),
    });
    return { alreadyApplied: false, purchaseId: String(created._id) };
  }

  throw new Error(
    `No se pudo crear/actualizar DocumentaryPurchase para ${slug} (user ${userId})`
  );
}
