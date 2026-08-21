import { Request, Response } from "express";
import {
  applySubscriptionCapture,
  applyOrderCapture,
  applyDocumentaryCapture,
  assertPaypalSubscriptionCompleted,
  fetchPayPalOrder,
  FetchedPaypalOrder,
  PaypalCaptureKind,
  PaypalOrderNotCompletedError,
  PaypalOrderNotFoundError,
  AmountMismatchError,
  CurrencyMismatchError,
} from "@services/paypalCaptureService";
import { UserModel } from "@models/Users";
import { OrderModel } from "@models/Order";
import { DocumentaryModel } from "@models/Documentary";

interface ReconcileBody {
  transactionId?: string;
  email?: string;
  userId?: string;
  orderId?: string;
  slug?: string;
  kind?: PaypalCaptureKind;
  /** (opcional) para órdenes de tienda */
  grantCommunityBonus?: boolean;
  /** (opcional) para saltarse la validación de monto (casos especiales) */
  skipAmountValidation?: boolean;
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ success: false, message });
  return;
}

/**
 * Endpoint admin para reconciliar pagos PayPal que no actualizaron la DB
 * (p.ej. el usuario cerró la pestaña antes del redirect a return_url).
 *
 * POST /api/v1/admin/paypal/reconcile
 * Auth: verifyToken + verifyRole(["admin","superadmin"])
 *
 * Body por `kind`:
 *  - "subscription": { transactionId, email }            (ó userId)
 *  - "order":        { transactionId, orderId }
 *  - "documentary":  { transactionId, email, slug }      (ó userId)
 */
export const reconcilePaypalPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      transactionId,
      email,
      userId,
      orderId,
      slug,
      kind,
      grantCommunityBonus,
      skipAmountValidation,
    } = (req.body || {}) as ReconcileBody;

    if (!transactionId || typeof transactionId !== "string") {
      return badRequest(res, "transactionId es requerido");
    }
    if (!kind || !["subscription", "order", "documentary"].includes(kind)) {
      return badRequest(
        res,
        "kind es requerido y debe ser 'subscription' | 'order' | 'documentary'"
      );
    }

    // Validar el pago contra PayPal (defensa anti-fraude).
    let fetched: FetchedPaypalOrder;
    try {
      fetched = await fetchPayPalOrder(transactionId);
    } catch (err) {
      console.warn(
        "[reconcile] fetchPayPalOrder failed; rechazando:",
        err
      );
      res.status(502).json({
        success: false,
        message: "No se pudo consultar la orden en PayPal",
        error: (err as Error).message,
      });
      return;
    }

    if (fetched.status !== "COMPLETED") {
      res.status(400).json({
        success: false,
        message: `La orden en PayPal no está COMPLETED (status=${fetched.status})`,
      });
      return;
    }

    if (kind === "subscription") {
      // Validar monto salvo override explícito
      if (!skipAmountValidation && fetched.value && fetched.currency === "USD") {
        try {
          await assertPaypalSubscriptionCompleted(transactionId);
        } catch (err) {
          if (
            err instanceof AmountMismatchError ||
            err instanceof CurrencyMismatchError
          ) {
            res.status(400).json({
              success: false,
              message: `Monto capturado (${fetched.value} ${fetched.currency}) no coincide con el precio de suscripción configurado`,
              error: (err as Error).message,
            });
            return;
          }
          if (
            err instanceof PaypalOrderNotFoundError ||
            err instanceof PaypalOrderNotCompletedError
          ) {
            res.status(400).json({
              success: false,
              message: (err as Error).message,
            });
            return;
          }
          throw err;
        }
      }

      const targetUser = await resolveTargetUser({ email, userId });
      if (!targetUser) {
        return badRequest(
          res,
          "Debés pasar email o userId del usuario a reconciliar"
        );
      }

      const paymentDate = fetched.capturedAt || new Date();
      if (isNaN(paymentDate.getTime())) {
        return badRequest(res, "create_time de PayPal inválido");
      }

      const result = await applySubscriptionCapture({
        userId: String(targetUser._id),
        transactionId,
        paymentDate,
      });

      console.log("[reconcile] subscription applied", {
        by: req.currentUser,
        userId: targetUser._id,
        transactionId,
        paymentDate,
        alreadyApplied: result.alreadyApplied,
      });

      res.json({
        success: true,
        kind,
        alreadyApplied: result.alreadyApplied,
        user: {
          email: targetUser.email,
          username: targetUser.username,
          name: targetUser.name,
        },
        subscription: {
          transactionId,
          paymentDate,
          expirationDate: targetUser.subscription?.expirationDate,
        },
      });
      return;
    }

    if (kind === "order") {
      if (!orderId || typeof orderId !== "string") {
        return badRequest(res, "orderId es requerido para kind=order");
      }
      const order = await OrderModel.findById(orderId);
      if (!order) {
        res.status(404).json({
          success: false,
          message: `Order ${orderId} no encontrado`,
        });
        return;
      }

      const result = await applyOrderCapture({
        orderId,
        transactionId,
        payerEmail: fetched.payerEmail,
        grantCommunityBonusFn: grantCommunityBonus
          ? async (o) => {
              (o as any).communityBonusGrantedAt = new Date();
            }
          : undefined,
      });

      console.log("[reconcile] order applied", {
        by: req.currentUser,
        orderId,
        transactionId,
        alreadyApplied: result.alreadyApplied,
      });

      res.json({
        success: true,
        kind,
        alreadyApplied: result.alreadyApplied,
        order: {
          id: String(order._id),
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          paidAt: order.paidAt,
          fulfillmentStatus: order.fulfillmentStatus,
        },
      });
      return;
    }

    if (kind === "documentary") {
      if (!slug) {
        return badRequest(res, "slug es requerido para kind=documentary");
      }
      const doc = await DocumentaryModel.findOne({ slug });
      if (!doc) {
        res.status(404).json({
          success: false,
          message: `Documental ${slug} no encontrado`,
        });
        return;
      }

      const targetUser = await resolveTargetUser({ email, userId });
      if (!targetUser) {
        return badRequest(res, "Debés pasar email o userId del usuario");
      }

      const result = await applyDocumentaryCapture({
        userId: String(targetUser._id),
        slug,
        transactionId,
      });

      console.log("[reconcile] documentary applied", {
        by: req.currentUser,
        userId: targetUser._id,
        slug,
        transactionId,
        alreadyApplied: result.alreadyApplied,
      });

      res.json({
        success: true,
        kind,
        alreadyApplied: result.alreadyApplied,
        documentary: {
          slug,
          purchaseId: result.purchaseId,
        },
      });
      return;
    }

    return badRequest(res, "kind inválido");
  } catch (error: any) {
    console.error("[reconcile] error:", error?.response?.data || error);
    res.status(500).json({
      success: false,
      message: "Error reconciliando el pago",
      error: error?.message,
    });
  }
};

async function resolveTargetUser(args: {
  email?: string;
  userId?: string;
}): Promise<any> {
  if (args.userId) {
    return UserModel.findById(args.userId);
  }
  if (args.email) {
    return UserModel.findOne({ email: args.email });
  }
  return null;
}
