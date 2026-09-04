/**
 * Test E2E del flujo de cupones para el documental.
 *
 *   ts-node-dev --transpile-only -r tsconfig-paths/register \
 *     scripts/test-coupon-flow.ts
 *
 * Variables de entorno necesarias:
 *   API_BASE_URL          (default http://localhost:3016/api/v1)
 *   ADMIN_EMAIL           (obligatorio - cuenta admin existente)
 *   ADMIN_PASSWORD        (obligatorio)
 *   TEST_USER_EMAIL       (opcional - se crea si no existe)
 *   TEST_USER_PASSWORD    (opcional - default "CouponTest123!")
 *   TEST_DOCUMENTARY_SLUG (opcional - default "humano-existes")
 *
 * El script:
 *   1. Crea (o reutiliza) un usuario de prueba.
 *   2. Loguea como ese usuario y sube un cupón (imagen PNG generada).
 *   3. Verifica que la compra quedó en estado `awaiting_review`.
 *   4. Loguea como admin y aprueba la compra.
 *   5. Verifica que el usuario ahora posee el documental (ownership true).
 *   6. Limpia: revoca el acceso creado durante el test.
 *
 * Devuelve exit code 0 si todo sale bien, 1 si falla cualquier assertion.
 */

import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exit } from "process";

const API_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:3016/api/v1";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TEST_USER_EMAIL =
  process.env.TEST_USER_EMAIL ||
  `coupon-test-${Date.now()}@vestis-test.local`;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "CouponTest123!";
const TEST_USER_NAME = "Coupon Tester";
const TEST_DOCUMENTARY_SLUG =
  process.env.TEST_DOCUMENTARY_SLUG || "humano-existes";

// ─── Mini logger ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

const ok = (msg: string) => {
  passed += 1;
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
};
const ko = (msg: string) => {
  failed += 1;
  failures.push(msg);
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
};
const step = (msg: string) => {
  console.log(`\n\x1b[36m→\x1b[0m ${msg}`);
};
const info = (msg: string) => console.log(`  ${msg}`);

// ─── HTTP helpers ──────────────────────────────────────────────────────────

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string;
  json?: any;
  formData?: FormData;
}

const apiFetch = async <T = any>(
  path: string,
  options: FetchOptions = {}
): Promise<{ status: number; body: any }> => {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: any = undefined;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.formData) {
    body = options.formData;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body,
  });
  let parsed: any = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
};

const assert = (condition: boolean, msg: string) => {
  if (condition) ok(msg);
  else ko(msg);
};

// ─── Generación de un cupón-imagen sintético ───────────────────────────────

// PNG mínimo 1x1 rojo, hardcodeado, válido para el fileFilter del middleware.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const writeSyntheticCouponPng = async (): Promise<string> => {
  const buf = Buffer.from(TINY_PNG_BASE64, "base64");
  const tmpPath = path.join(
    os.tmpdir(),
    `vestis-coupon-test-${Date.now()}.png`
  );
  await fs.writeFile(tmpPath, buf);
  return tmpPath;
};

// ─── Login helpers ─────────────────────────────────────────────────────────

const login = async (email: string, password: string): Promise<string> => {
  const res = await apiFetch<any>("/auth/login", {
    method: "POST",
    json: { email, password },
  });
  if (res.status !== 200) {
    throw new Error(
      `Login falló para ${email}: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  // El backend devuelve directamente el JWT (string).
  const token = typeof res.body === "string" ? res.body : res.body?.token;
  if (!token || typeof token !== "string") {
    throw new Error(`Login no devolvió token válido: ${JSON.stringify(res.body)}`);
  }
  return token;
};

const registerUser = async (email: string, password: string) => {
  const res = await apiFetch<any>("/auth/register", {
    method: "POST",
    json: {
      name: TEST_USER_NAME,
      username: email.split("@")[0],
      email,
      password,
    },
  });
  // 201 = creado. 400 con mensaje "User already exists" = ya estaba.
  if (res.status === 201) return;
  if (
    res.status === 400 &&
    typeof res.body?.message === "string" &&
    res.body.message.toLowerCase().includes("already exists")
  ) {
    return;
  }
  throw new Error(
    `Registro falló para ${email}: ${res.status} ${JSON.stringify(res.body)}`
  );
};

// ─── Test principal ────────────────────────────────────────────────────────

const main = async () => {
  console.log(`\n\x1b[1mTest E2E · Flujo Cupón Documental\x1b[0m`);
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Slug: ${TEST_DOCUMENTARY_SLUG}`);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    ko(
      "Faltan variables ADMIN_EMAIL / ADMIN_PASSWORD (configurá el .env antes de correr)"
    );
    return 1;
  }

  // ── 1. Healthcheck ──────────────────────────────────────────────────────
  step("Healthcheck de la API");
  try {
    const res = await apiFetch("/health");
    assert(res.status === 200, `GET /health → ${res.status}`);
  } catch (e: any) {
    ko(`No se pudo conectar a ${API_BASE_URL}: ${e.message}`);
    return 1;
  }

  // ── 2. Registrar usuario de prueba ──────────────────────────────────────
  step(`Crear usuario de prueba ${TEST_USER_EMAIL}`);
  try {
    await registerUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    ok("Usuario registrado (o ya existía)");
  } catch (e: any) {
    ko(e.message);
    return 1;
  }

  // ── 3. Login usuario ────────────────────────────────────────────────────
  step("Login usuario de prueba");
  let userToken: string;
  try {
    userToken = await login(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    ok(`Token obtenido (${userToken.slice(0, 16)}…)`);
  } catch (e: any) {
    ko(e.message);
    return 1;
  }

  // ── 4. Confirmar que NO tiene acceso antes del cupón ────────────────────
  step("Ownership inicial del usuario (debe ser owns=false)");
  try {
    const res = await apiFetch(
      `/documentaries/${TEST_DOCUMENTARY_SLUG}/ownership`,
      { token: userToken }
    );
    assert(res.status === 200, `GET /ownership → ${res.status}`);
    assert(res.body?.data?.owns === false, "owns=false antes del cupón");
  } catch (e: any) {
    ko(e.message);
  }

  // ── 5. Subir cupón (con archivo PNG sintético) ──────────────────────────
  step("Subir cupón (POST /payment/coupon)");
  let couponPath: string | null = null;
  let couponPurchase: any = null;
  try {
    couponPath = await writeSyntheticCouponPng();
    const form = new FormData();
    const blob = new Blob([await fs.readFile(couponPath)], {
      type: "image/png",
    });
    form.append("receipt", blob, "coupon.png");
    const res = await apiFetch(
      `/documentaries/${TEST_DOCUMENTARY_SLUG}/payment/coupon`,
      { method: "POST", token: userToken, formData: form }
    );
    assert(res.status === 200, `POST /payment/coupon → ${res.status}`);
    couponPurchase = res.body?.data;
    assert(
      couponPurchase?.method === "coupon",
      `method=coupon (recibido: ${couponPurchase?.method})`
    );
    assert(
      couponPurchase?.status === "awaiting_review",
      `status=awaiting_review (recibido: ${couponPurchase?.status})`
    );
    assert(
      typeof couponPurchase?.couponReceiptUrl === "string" &&
        couponPurchase.couponReceiptUrl.includes("/uploads/receipts/"),
      `couponReceiptUrl presente y bajo /uploads/receipts (recibido: ${couponPurchase?.couponReceiptUrl})`
    );
    assert(
      couponPurchase?.amount === 0,
      `amount=0 (cupón no tiene costo; recibido: ${couponPurchase?.amount})`
    );
  } catch (e: any) {
    ko(`Excepción al subir cupón: ${e.message}`);
  } finally {
    if (couponPath) {
      try {
        await fs.unlink(couponPath);
      } catch {}
    }
  }

  if (!couponPurchase?._id) {
    ko("No se obtuvo purchaseId; abortando el resto del flujo");
    return 1;
  }

  // ── 6. Verificar que el archivo se guardó físicamente ────────────────────
  step("Archivo del cupón quedó persistido en disco");
  try {
    const url = couponPurchase.couponReceiptUrl.replace(/^\//, "");
    const absolute = path.join(process.cwd(), url);
    const stat = await fs.stat(absolute);
    assert(stat.size > 0, `Archivo presente en disco (${absolute}, ${stat.size} bytes)`);
  } catch (e: any) {
    ko(`No se encontró el archivo: ${e.message}`);
  }

  // ── 7. Validar que la API pública del admin liste el cupón ──────────────
  step("Admin puede listar el cupón pendiente");
  let adminToken: string;
  try {
    adminToken = await login(ADMIN_EMAIL!, ADMIN_PASSWORD!);
    ok(`Admin login OK (${adminToken.slice(0, 16)}…)`);
    const res = await apiFetch(
      `/documentaries/admin/purchases?status=awaiting_review&method=coupon`,
      { token: adminToken }
    );
    assert(res.status === 200, `GET /admin/purchases → ${res.status}`);
    const found = Array.isArray(res.body?.data)
      ? res.body.data.find((p: any) => p._id === couponPurchase._id)
      : null;
    assert(!!found, `Compra ${couponPurchase._id} aparece en el listado admin`);
  } catch (e: any) {
    ko(e.message);
    return 1;
  }

  // ── 8. Admin aprueba el cupón ───────────────────────────────────────────
  step("Admin aprueba el cupón");
  try {
    const res = await apiFetch(
      `/documentaries/purchases/${couponPurchase._id}/approve`,
      {
        method: "PATCH",
        token: adminToken,
        json: { adminNotes: "Test E2E auto" },
      }
    );
    assert(res.status === 200, `PATCH /approve → ${res.status}`);
    assert(
      res.body?.data?.status === "approved",
      `status=approved (recibido: ${res.body?.data?.status})`
    );
  } catch (e: any) {
    ko(e.message);
  }

  // ── 9. Verificar que el usuario ahora SÍ tiene acceso ──────────────────
  step("Ownership final del usuario (debe ser owns=true)");
  try {
    const res = await apiFetch(
      `/documentaries/${TEST_DOCUMENTARY_SLUG}/ownership`,
      { token: userToken }
    );
    assert(res.status === 200, `GET /ownership → ${res.status}`);
    assert(res.body?.data?.owns === true, "owns=true después de aprobar");
    assert(
      res.body?.data?.playLimit === 4,
      `playLimit=4 (recibido: ${res.body?.data?.playLimit})`
    );
    assert(
      res.body?.data?.playsRemaining === 4,
      `playsRemaining=4 (counter reseteado; recibido: ${res.body?.data?.playsRemaining})`
    );
  } catch (e: any) {
    ko(e.message);
  }

  // ── 10. Limpieza: revocar el acceso y borrar el archivo ─────────────────
  step("Cleanup: revocar acceso de prueba + borrar archivo");
  try {
    const res = await apiFetch(
      `/documentaries/${TEST_DOCUMENTARY_SLUG}/purchases/${couponPurchase._id}`,
      { method: "DELETE", token: adminToken }
    );
    assert(res.status === 200, `DELETE /purchases/:id → ${res.status}`);
  } catch (e: any) {
    ko(`Cleanup revoke falló: ${e.message}`);
  }
  try {
    const url = couponPurchase.couponReceiptUrl.replace(/^\//, "");
    const absolute = path.join(process.cwd(), url);
    await fs.unlink(absolute);
    ok(`Archivo de cupón eliminado: ${absolute}`);
  } catch (e: any) {
    info(
      `(no se pudo borrar el archivo del cupón — recordá limpiarlo a mano: ${e.message})`
    );
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log(
    `\n\x1b[1mResumen:\x1b[0m \x1b[32m${passed} pasaron\x1b[0m · ${
      failed === 0 ? "\x1b[32m" : "\x1b[31m"
    }${failed} fallaron\x1b[0m`
  );
  if (failures.length) {
    console.log("\nFallos:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  return failed === 0 ? 0 : 1;
};

main()
  .then((code) => exit(code))
  .catch((err) => {
    console.error("\n\x1b[31m✗ Error inesperado:\x1b[0m", err);
    exit(1);
  });