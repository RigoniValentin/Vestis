/**
 * Script one-shot para reconciliar un pago PayPal perdido.
 *
 * Caso de uso:
 *  El usuario pagó la suscripción vía PayPal pero el redirect a
 *  /capture-order nunca llegó (cierre de pestaña, red, blocker, etc.)
 *  y por lo tanto nunca se actualizó su suscripción en la DB.
 *
 * Uso:
 *  ts-node-dev --transpile-only -r tsconfig-paths/register \
 *    scripts/reconcile-paypal-subscription.ts \
 *    --email=dfreyes10@gmail.com --transactionId=1233321412
 *
 * Qué hace:
 *  1. Conecta a MongoDB (lee MONGODB_URL_STRING del .env).
 *  2. Consulta la API de PayPal para validar que el pago está COMPLETED.
 *  3. Compara el monto capturado contra el precio configurado en
 *     PaymentSettings.subscription.paypalUsd (admite tolerancia por FX).
 *  4. Aplica la suscripción al usuario:
 *       - subscription.transactionId
 *       - subscription.paymentDate  (de create_time del capture)
 *       - subscription.expirationDate (+durationDays)
 *       - agrega el rol "user" SIN pisar roles existentes (admin, etc.)
 *  5. Idempotente: si el transactionId ya está asociado a otro/subscription,
 *     aborta con error claro para evitar duplicar.
 *
 * Variables de entorno necesarias (.env):
 *   MONGODB_URL_STRING
 *   PAYPAL_API_CLIENT
 *   PAYPAL_API_SECRET
 *   PAYPAL_API   (opcional; default https://api-m.paypal.com)
 */

import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { argv, exit } from "process";

import { UserModel } from "../src/models/Users";
import { RolesModel } from "../src/models/Roles";
import {
  getPaymentSettings,
  getSubscriptionDurationDays,
} from "../src/models/PaymentSettings";

type CliArgs = { email?: string; transactionId?: string };

function parseArgs(): CliArgs {
  const out: CliArgs = {};
  for (const a of argv.slice(2)) {
    if (a.startsWith("--email=")) out.email = a.split("=")[1]?.trim();
    if (a.startsWith("--transactionId="))
      out.transactionId = a.split("=")[1]?.trim();
  }
  return out;
}

async function getPayPalAccessToken(): Promise<string> {
  const PAYPAL_API =
    process.env.PAYPAL_API ||
    (process.env.NODE_ENV === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com");
  const client = process.env.PAYPAL_API_CLIENT!;
  const secret = process.env.PAYPAL_API_SECRET!;

  if (!client || !secret) {
    throw new Error("Faltan PAYPAL_API_CLIENT / PAYPAL_API_SECRET en .env");
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");

  const { data } = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    params,
    { auth: { username: client, password: secret } }
  );

  return data.access_token as string;
}

async function fetchPayPalOrder(transactionId: string): Promise<any> {
  const PAYPAL_API =
    process.env.PAYPAL_API ||
    (process.env.NODE_ENV === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com");

  const accessToken = await getPayPalAccessToken();
  const { data } = await axios.get(
    `${PAYPAL_API}/v2/checkout/orders/${transactionId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

function extractCapturedAmount(orderData: any): {
  value: number;
  currency: string;
  capturedAt: Date | null;
} {
  const capture =
    orderData?.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) {
    throw new Error(
      "La orden de PayPal no tiene un capture asociado (no fue capturada aún)."
    );
  }
  const value = Number(capture.amount?.value);
  const currency = String(capture.amount?.currency_code || "").toUpperCase();
  const createdAt = capture.create_time ? new Date(capture.create_time) : null;
  return { value, currency, capturedAt: createdAt };
}

async function main(): Promise<void> {
  const { email, transactionId } = parseArgs();

  if (!email || !transactionId) {
    console.error(
      "Uso: ts-node-dev --transpile-only -r tsconfig-paths/register \\\n" +
        "    scripts/reconcile-paypal-subscription.ts \\\n" +
        "    --email=<email> --transactionId=<paypalOrderId>"
    );
    exit(1);
  }

  const mongoUrl = process.env.MONGODB_URL_STRING;
  if (!mongoUrl) {
    console.error("Falta MONGODB_URL_STRING en .env");
    exit(1);
  }

  console.log("[reconcile] Conectando a MongoDB...");
  await mongoose.connect(mongoUrl);

  try {
    console.log(`[reconcile] Buscando usuario ${email}...`);
    const user = await UserModel.findOne({ email });
    if (!user) {
      console.error(`[reconcile] ERROR: no existe un usuario con email ${email}`);
      exit(2);
    }
    console.log(
      `[reconcile] Usuario encontrado: ${user.username} (${user._id})`
    );

    if (user.subscription?.transactionId) {
      console.warn(
        `[reconcile] ATENCION: el usuario ya tiene subscription.transactionId=${user.subscription.transactionId}`
      );
      if (user.subscription.transactionId === transactionId) {
        console.log(
          "[reconcile] El transactionId coincide con el que ya tiene guardado. Nada que hacer."
        );
        exit(0);
      }
      console.error(
        "[reconcile] ABORT: si querés sobreescribir, hacelo manualmente con un admin script."
      );
      exit(3);
    }

    const dupCheck = await UserModel.findOne({
      "subscription.transactionId": transactionId,
    });
    if (dupCheck && String(dupCheck._id) !== String(user._id)) {
      console.error(
        `[reconcile] ABORT: el transactionId ${transactionId} ya está asignado a otro usuario (${dupCheck.email}).`
      );
      exit(4);
    }

    console.log(`[reconcile] Validando transacción en PayPal: ${transactionId}`);
    const orderData = await fetchPayPalOrder(transactionId);

    const status = orderData?.status;
    console.log(`[reconcile] Estado de la orden en PayPal: ${status}`);
    if (status !== "COMPLETED") {
      console.error(
        `[reconcile] ABORT: el pago no está COMPLETED (status=${status}).`
      );
      exit(5);
    }

    const { value, currency, capturedAt } = extractCapturedAmount(orderData);
    console.log(
      `[reconcile] Captura: ${value} ${currency} (${capturedAt?.toISOString() || "sin fecha"})`
    );

    const settings = await getPaymentSettings();
    const expectedUsd = settings.subscription?.paypalUsd ?? 13;

    if (currency !== "USD") {
      console.error(
        `[reconcile] ABORT: la captura está en ${currency}, se esperaba USD.`
      );
      exit(6);
    }

    // Tolerancia del 5% para absorber comisiones o diferencias de centavos.
    const tolerance = Math.max(0.5, expectedUsd * 0.05);
    if (Math.abs(value - expectedUsd) > tolerance) {
      console.error(
        `[reconcile] ABORT: el monto capturado (${value} USD) no coincide con el precio configurado (${expectedUsd} USD ± ${tolerance.toFixed(2)}).`
      );
      exit(7);
    }

    const paymentDate = capturedAt || new Date();
    if (isNaN(paymentDate.getTime())) {
      console.error("[reconcile] ABORT: create_time inválido en PayPal.");
      exit(8);
    }

    const durationDays = await getSubscriptionDurationDays();
    const expirationDate = new Date(paymentDate);
    expirationDate.setDate(expirationDate.getDate() + durationDays);

    const paidUserRole = await RolesModel.findOne({ name: "user" });
    if (!paidUserRole) {
      console.error("[reconcile] ABORT: no existe el rol 'user' en la DB.");
      exit(9);
    }

    user.roles = user.roles || [];
    const alreadyHasUserRole = user.roles.some(
      (r) => String(r._id) === String(paidUserRole._id)
    );
    if (!alreadyHasUserRole) {
      user.roles.push(paidUserRole);
    }
    user.subscription = {
      transactionId,
      paymentDate,
      expirationDate,
    };

    await user.save();

    console.log("[reconcile] OK. Suscripción aplicada:");
    console.log({
      email: user.email,
      userId: String(user._id),
      transactionId,
      paymentDate: paymentDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      durationDays,
      capturedAmount: `${value} ${currency}`,
      paypalPayerEmail: orderData?.payer?.email_address,
      roles: user.roles.map((r) => r.name),
    });
  } finally {
    await mongoose.disconnect();
    console.log("[reconcile] Desconectado.");
  }
}

main().catch((err) => {
  console.error("[reconcile] ERROR FATAL:", err?.response?.data || err);
  exit(99);
});
