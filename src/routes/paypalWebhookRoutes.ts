import { Router } from "express";
import { paypalWebhook } from "@controllers/paypalWebhookController";

const router = Router();

/**
 * POST /api/v1/webhooks/paypal
 *
 * Endpoint público (sin auth) que recibe notificaciones de PayPal para
 * reconciliar pagos aunque el usuario no haya completado el redirect a
 * return_url de la orden.
 *
 * El rawBody del request es capturado por el `verify` callback de
 * express.json en server.ts y se expone en req.rawBody, lo que permite
 * verificar la firma de PayPal contra el body original.
 *
 * El controller detecta PAYPAL_WEBHOOK_ID para habilitar verificación;
 * si NODE_ENV=production y no hay ID, rechaza por seguridad.
 */
router.post("/paypal", paypalWebhook);

export default router;
