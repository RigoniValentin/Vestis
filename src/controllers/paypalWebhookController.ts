import { Request, Response, NextFunction } from "express";
import axios from "axios";
import { PAYPAL_API, PAYPAL_API_CLIENT, PAYPAL_API_SECRET } from "app";
import {
  applySubscriptionCapture,
  applyOrderCapture,
  applyDocumentaryCapture,
  assertPaypalSubscriptionCompleted,
} from "@services/paypalCaptureService";

const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

interface PurchaseUnitRef {
  reference_id?: string;
  custom_id?: string;
  invoice_id?: string;
}

type ParsedRef =
  | { kind: "order"; orderId: string; userId?: string }
  | { kind: "subscription"; userId: string }
  | { kind: "documentary"; slug: string; userId: string }
  | { kind: "unknown" };

/**
 * Parsea el `reference_id` que mandamos en los purchase_units cuando
 * creamos la orden de PayPal. Formato esperado:
 *   - "order:<orderId>:<userId>"
 *   - "documentary:<slug>:<userId>"
 *
 * Para suscripciones NO hay reference_id en la orden, pero usamos el
 * custom_id "subscription:<userId>" o caemos al heurístico del payer email.
 */
function parseReferenceId(ref: string | undefined): ParsedRef {
  if (!ref) return { kind: "unknown" };
  if (ref.startsWith("order:")) {
    const [, orderId, userId] = ref.split(":");
    return { kind: "order", orderId, userId };
  }
  if (ref.startsWith("documentary:")) {
    const [, slug, userId] = ref.split(":");
    return { kind: "documentary", slug, userId };
  }
  return { kind: "unknown" };
}

function parseCustomId(custom: string | undefined): ParsedRef {
  if (!custom) return { kind: "unknown" };
  if (custom.startsWith("subscription:")) {
    const userId = custom.split(":")[1];
    return { kind: "subscription", userId };
  }
  return { kind: "unknown" };
}

/**
 * Verifica la firma del webhook contra el endpoint oficial de PayPal.
 * https://developer.paypal.com/api/rest/webhooks/event-names/#verify-webhook-signature
 *
 * PayPal recomienda usar POST /v1/notifications/verify-webhook-signature
 * en vez de verificar localmente, porque simplifica el manejo de rotación
 * de certificados.
 */
async function verifyWebhookSignature(
  req: Request
): Promise<boolean> {
  if (!WEBHOOK_ID) {
    console.error(
      "[paypalWebhook] PAYPAL_WEBHOOK_ID no está configurado. " +
        "Abortando por seguridad."
    );
    return false;
  }

  const authHeader = req.headers["paypal-auth-algo"];
  const certUrl = req.headers["paypal-cert-url"];
  const transmissionId = req.headers["paypal-transmission-id"];
  const transmissionSig = req.headers["paypal-transmission-sig"];
  const transmissionTime = req.headers["paypal-transmission-time"];

  if (!authHeader || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    console.warn("[paypalWebhook] faltan headers de PayPal para verificar");
    return false;
  }

  // El body crudo lo guardamos en req.rawBody (lo expone el `verify`
  // callback de express.json en server.ts). Si no está, no podemos verificar.
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    console.warn(
      "[paypalWebhook] req.rawBody no está disponible; " +
        "verificar que express.json({ verify }) esté configurado."
    );
    return false;
  }

  try {
    // Obtener access token
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    const tokenResp = await axios.post(
      `${PAYPAL_API}/v1/oauth2/token`,
      params,
      {
        auth: {
          username: PAYPAL_API_CLIENT!,
          password: PAYPAL_API_SECRET!,
        },
      }
    );

    const verifyResp = await axios.post(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: authHeader,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody.toString("utf8")),
      },
      {
        headers: {
          Authorization: `Bearer ${tokenResp.data.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return verifyResp.data?.verification_status === "SUCCESS";
  } catch (err: any) {
    console.error(
      "[paypalWebhook] verify-webhook-signature failed:",
      err?.response?.data || err
    );
    return false;
  }
}

/**
 * Normaliza los datos de un evento CHECKOUT.ORDER.COMPLETED o
 * PAYMENT.CAPTURE.COMPLETED y devuelve la info mínima para aplicar el
 * pago.
 */
function extractOrderFromEvent(event: any): {
  transactionId: string;
  status: string;
  payerEmail?: string;
  value?: number;
  currency?: string;
  capturedAt?: Date | null;
  purchaseUnit?: any;
} | null {
  const resource = event?.resource;
  if (!resource) return null;

  // En CHECKOUT.ORDER.COMPLETED la resource es la orden completa; el capture
  // está en purchase_units[0].payments.captures[0].
  // En PAYMENT.CAPTURE.COMPLETED la resource ES el capture individual.
  let captures = resource?.purchase_units?.[0]?.payments?.captures;
  let purchaseUnit = resource?.purchase_units?.[0];
  if (!captures && resource?.status && resource?.amount) {
    captures = [resource];
  }
  const capture = captures?.[0];
  if (!capture) return null;

  return {
    transactionId: resource?.id || capture?.id || "",
    status: resource?.status || "UNKNOWN",
    payerEmail:
      resource?.payer?.email_address ||
      capture?.payer?.email_address ||
      undefined,
    value: capture?.amount?.value ? Number(capture.amount.value) : undefined,
    currency: capture?.amount?.currency_code
      ? String(capture.amount.currency_code).toUpperCase()
      : undefined,
    capturedAt: capture?.create_time ? new Date(capture.create_time) : null,
    purchaseUnit,
  };
}

/**
 * POST /api/v1/webhooks/paypal
 * Endpoint público. Recibe notificaciones de PayPal para reconciliar pagos
 * aunque el usuario no haya completado el redirect a return_url.
 *
 * Configurar desde PayPal Dashboard:
 *   URL: https://api.vestisevolucion.com/api/v1/webhooks/paypal
 *   Eventos: CHECKOUT.ORDER.COMPLETED, PAYMENT.CAPTURE.COMPLETED
 *
 * Responde 200 OK rápido: PayPal reintenta si la respuesta tarda >5s.
 */
export const paypalWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Modo dev: si no hay WEBHOOK_ID configurado, podemos aceptar
    // encabezados de "test" sin verificar firma. Útil para probar
    // con curl. En PRODUCTION esto aborta.
    const isProduction = process.env.NODE_ENV === "production";
    const skipSignature = process.env.PAYPAL_WEBHOOK_SKIP_VERIFY === "true";

    if (isProduction && !skipSignature) {
      const ok = await verifyWebhookSignature(req);
      if (!ok) {
        console.warn(
          "[paypalWebhook] Firma inválida. Rechazando.",
          { headers: req.headers }
        );
        res.status(401).json({ success: false, message: "Invalid signature" });
        return;
      }
    } else if (!skipSignature) {
      console.warn(
        "[paypalWebhook] DEV: saltando verificación de firma. " +
          "NO usar esto en producción."
      );
    }

    const event = (req as any).body;
    const eventType: string = event?.event_type || "";
    console.log(
      `[paypalWebhook] evento=${eventType} id=${event?.id || "?"}`
    );

    if (
      eventType !== "CHECKOUT.ORDER.COMPLETED" &&
      eventType !== "PAYMENT.CAPTURE.COMPLETED"
    ) {
      // PayPal también manda PENDING, REFUNDED, etc. Los ignoramos pero
      // devolvemos 200 para que no reintente.
      res.json({ received: true, ignored: true, eventType });
      return;
    }

    const extracted = extractOrderFromEvent(event);
    if (!extracted || !extracted.transactionId) {
      console.warn(
        "[paypalWebhook] no se pudo extraer transactionId del evento"
      );
      res.status(400).json({ success: false, message: "Bad event" });
      return;
    }

    if (extracted.status !== "COMPLETED") {
      console.log(
        `[paypalWebhook] status=${extracted.status}, no aplica`
      );
      res.json({ received: true, applied: false, status: extracted.status });
      return;
    }

    // Idempotencia por evento: registrar el id del evento antes de aplicar
    // para no duplicar si PayPal reintenta.
    const eventId: string = event?.id || `${extracted.transactionId}:${eventType}`;
    if (!eventId) {
      res.json({ received: true, applied: false });
      return;
    }
    // Nota: la idempotencia fina la manejan los helpers shared a través de
    // subscription.transactionId / order.paymentStatus / documentary purchases.
    // Acá solo loggeamos el id del evento para tener trazabilidad.

    const purchaseUnit: any = extracted.purchaseUnit;
    const ref: PurchaseUnitRef = purchaseUnit || {};
    const parsedRef =
      parseReferenceId(ref.reference_id) ||
      parseCustomId(ref.custom_id) ||
      parseReferenceId(ref.invoice_id);

    let applied = false;

    if (parsedRef.kind === "order") {
      const result = await applyOrderCapture({
        orderId: parsedRef.orderId,
        transactionId: extracted.transactionId,
        payerEmail: extracted.payerEmail,
        grantCommunityBonusFn: undefined,
      });
      applied = !result.alreadyApplied;
      console.log("[paypalWebhook] order", {
        eventId,
        orderId: parsedRef.orderId,
        result,
      });
    } else if (parsedRef.kind === "documentary") {
      const result = await applyDocumentaryCapture({
        userId: parsedRef.userId,
        slug: parsedRef.slug,
        transactionId: extracted.transactionId,
      });
      applied = !result.alreadyApplied;
      console.log("[paypalWebhook] documentary", {
        eventId,
        slug: parsedRef.slug,
        result,
      });
    } else if (parsedRef.kind === "subscription") {
      // Para suscripciones: validar contra el precio configurado y aplicar.
      try {
        await assertPaypalSubscriptionCompleted(extracted.transactionId);
      } catch (err) {
        console.warn(
          "[paypalWebhook] subscription no pasó validación",
          err
        );
        res.json({ received: true, applied: false, reason: (err as Error).message });
        return;
      }
      const paymentDate = extracted.capturedAt || new Date();
      const result = await applySubscriptionCapture({
        userId: parsedRef.userId,
        transactionId: extracted.transactionId,
        paymentDate,
      });
      applied = !result.alreadyApplied;
      console.log("[paypalWebhook] subscription", {
        eventId,
        userId: parsedRef.userId,
        result,
      });
    } else {
      // No pudimos inferir el tipo por reference_id. NO aplicamos: solo
      // loggeamos para que el admin lo reconcilie manualmente.
      console.warn(
        "[paypalWebhook] evento sin reference_id reconocible. " +
          "Requiere reconciliación manual.",
        {
          eventId,
          transactionId: extracted.transactionId,
          ref,
        }
      );
      res.json({
        received: true,
        applied: false,
        reason: "reference_id_unknown",
      });
      return;
    }

    res.json({ received: true, applied, eventId, transactionId: extracted.transactionId });
  } catch (error: any) {
    console.error(
      "[paypalWebhook] error:",
      error?.response?.data || error
    );
    // Igual respondemos 200 para que PayPal no entre en loop de reintentos
    // si el error fue transitorio. Solo devolvemos 500 si el body no parseó.
    if (!req.body) {
      res.status(400).json({ success: false, message: "Bad webhook body" });
      return;
    }
    res.status(200).json({ received: true, error: error?.message });
  }
};
