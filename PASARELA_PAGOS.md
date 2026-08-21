# Pasarela de Pagos — Vestis

Sistema integral de pagos para Tienda, Documental y Suscripciones, con:

- **MercadoPago** (ARS)
- **PayPal** (USD)
- **Transferencia bancaria** (canal "bank", con subida de comprobante y aprobación manual)
- **PREX** (canal "prex", billetera virtual con el mismo flujo que la
  transferencia bancaria)
- **WhatsApp** (coordinación directa, exclusivo de la Tienda)

> Los canales de transferencia (`bank` y `prex`) comparten el flujo:
> el cliente ve los datos del canal, sube el comprobante, y el admin lo
> aprueba o lo rechaza desde el panel. La arquitectura es extensible: para
> agregar un nuevo canal basta con declararlo en
> `paymentSettingsController.ts` (`TRANSFER_CHANNELS`) y agregarlo a la
> config del front (`TransferChannelKey`).

---

## 🔧 Variables de entorno (Backend — `VestisBack/.env`)

```ini
# Mongo / Auth (ya existentes)
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...

# Servidor
PORT=3016
HOST=https://api.vestisevolucion.com   # base pública para callbacks (sin barra final)
                                       # En dev: http://localhost:3016

# MercadoPago (https://www.mercadopago.com.ar/developers)
MP_ACCESS_TOKEN=APP_USR-...prod...
MP_ACCESS_TOKENtest=TEST-...sandbox...

# PayPal (https://developer.paypal.com)
PAYPAL_API=https://api-m.sandbox.paypal.com    # o https://api-m.paypal.com
PAYPAL_API_CLIENT=...
PAYPAL_API_SECRET=...

# Webhook de PayPal (opcional, recomendado)
# Id del webhook creado en https://developer.paypal.com (My Apps & Credentials
# → Webhooks). Una vez configurado, el backend rechaza peticiones sin firma válida.
PAYPAL_WEBHOOK_ID=...

# Solo para DEV (curl/Postman): si vale "true", NO valida firma del webhook.
# NUNCA activar esto en producción.
PAYPAL_WEBHOOK_SKIP_VERIFY=false
```

> En `NODE_ENV=production` se usa `MP_ACCESS_TOKEN`, en otros entornos
> `MP_ACCESS_TOKENtest`.

## 🔧 Variables de entorno (Frontend — `VestisFront/.env`)

```ini
VITE_MP_PUBLIC_KEY=APP_USR-public-key
```

---

## 🗄️ Configuración inicial desde admin

1. Inicia sesión con un usuario con rol `admin` o `superadmin`.
2. Entra a **`/admin/pagos`** → tab **Configuración**.
3. Carga los datos de cada canal de transferencia:
   - **Transferencia bancaria**: Banco, Titular, CUIT/DNI, Nº de Cuenta,
     CBU, Alias, etc.
   - **PREX**: Titular, CVU, Alias, Nº de Cuenta Prex, etc. (usar los
     campos "extra" si necesitás un campo específico como "Cuenta Prex").
4. Activa/desactiva cada método (`MercadoPago`, `PayPal`, "Transferencia
   bancaria", `PREX`) según estén disponibles.
5. Indica el número de WhatsApp (formato internacional sin `+`, ej:
   `5493512657790`).
6. Pulsa **Guardar cambios**.

> El backend crea automáticamente un singleton de `PaymentSettings` en la
> primera consulta. En la primera lectura migra los datos legacy del campo
> `bank` al nuevo `transferChannels.bank` para no perder la configuración
> existente. Los datos de cada canal quedan visibles en el front cuando el
> cliente elige ese medio de pago en cualquier flujo.

---

## 📂 Endpoints (Backend)

### Configuración de pagos

| Método | Ruta                          | Auth        | Descripción                       |
| ------ | ----------------------------- | ----------- | --------------------------------- |
| GET    | `/api/v1/payment-settings`    | público     | Datos bancarios y toggles         |
| GET    | `/api/v1/payment-settings/admin` | admin    | Settings completas                |
| PUT    | `/api/v1/payment-settings`    | admin       | Actualiza datos / toggles         |

### Webhooks

| Método | Ruta                          | Auth        | Descripción                       |
| ------ | ----------------------------- | ----------- | --------------------------------- |
| POST   | `/api/v1/webhooks/paypal`     | público     | Reconciliación asíncrona de pagos PayPal |

### Admin — Reconciliación de pagos PayPal

| Método | Ruta                                   | Auth  | Descripción                                |
| ------ | -------------------------------------- | ----- | ------------------------------------------ |
| POST   | `/api/v1/admin/paypal/reconcile`       | admin | Aplica manualmente un pago PayPal perdido (capture no llegó al return_url) |

### Tienda — Pedidos

| Método | Ruta                                                       | Auth   |
| ------ | ---------------------------------------------------------- | ------ |
| POST   | `/api/v1/orders`                                           | user   |
| GET    | `/api/v1/orders/my`                                        | user   |
| GET    | `/api/v1/orders/:id`                                       | user   |
| PATCH  | `/api/v1/orders/:id/cancel`                                | user   |
| POST   | `/api/v1/orders/:id/payment/mp/create-preference`          | user   |
| POST   | `/api/v1/orders/:id/payment/paypal/create-order`           | user   |
| POST   | `/api/v1/orders/:id/payment/transfer`                      | user (multipart con `receipt` + `referenceNumber`) |
| POST   | `/api/v1/orders/:id/payment/prex`                          | user (multipart con `receipt` + `referenceNumber`) |
| GET    | `/api/v1/orders/payment/mp/capture`                        | público (callback) |
| GET    | `/api/v1/orders/payment/paypal/capture`                    | público (callback) |
| GET    | `/api/v1/orders`                                           | admin  |
| PATCH  | `/api/v1/orders/:id/admin/approve`                         | admin  |
| PATCH  | `/api/v1/orders/:id/admin/reject`                          | admin  |
| PATCH  | `/api/v1/orders/:id/admin/fulfillment`                     | admin  |

> El campo `paymentMethod` del pedido puede valer `"transfer"` (banco) o
> `"prex"` (billetera virtual). Los comprobantes y referencias se guardan
> en `transferReceiptUrl`/`transferReferenceNumber` o en
> `prexReceiptUrl`/`prexReferenceNumber` según corresponda.

### Documentales — Pago por transferencia

| Método | Ruta                                                  | Auth  |
| ------ | ----------------------------------------------------- | ----- |
| POST   | `/api/v1/documentaries/:slug/payment/transfer`        | user (multipart) |
| POST   | `/api/v1/documentaries/:slug/payment/prex`            | user (multipart) |
| GET    | `/api/v1/documentaries/my-purchases`                  | user  |
| GET    | `/api/v1/documentaries/admin/purchases`               | admin |
| PATCH  | `/api/v1/documentaries/purchases/:id/approve`         | admin |
| PATCH  | `/api/v1/documentaries/purchases/:id/reject`          | admin |

> El campo `method` de la compra admite `"transfer"` o `"prex"`. El
> admin puede filtrar por método y canal desde el panel.

### Suscripciones — Pago por transferencia

| Método | Ruta                                              | Auth  |
| ------ | ------------------------------------------------- | ----- |
| POST   | `/api/v1/subscription/transfer`                   | user (multipart con `receipt` + `referenceNumber` + `amount?` + `method=bank|prex?`) |
| GET    | `/api/v1/subscription/transfer/my`                | user  |
| GET    | `/api/v1/subscription/transfer`                   | admin (acepta `?status=` y `?method=`) |
| PATCH  | `/api/v1/subscription/transfer/:id/approve`       | admin |
| PATCH  | `/api/v1/subscription/transfer/:id/reject`        | admin |

> El multer config en `middlewares/uploadReceipt.ts` acepta JPG/PNG/WEBP/GIF/PDF
> y guarda en `uploads/receipts/`. El backend expone `/uploads/...` como
> estático, por eso el front resuelve `transferReceiptUrl` /
> `prexReceiptUrl` directo.

---

## 💸 Datos sugeridos para PREX (carga inicial)

Al activar el canal PREX, completá la pestaña **Configuración → PREX** con
los datos de la billetera:

| Campo frontend     | Ejemplo                          |
| ------------------ | -------------------------------- |
| Titular            | Marina Rovera                    |
| CBU / CVU          | 0000013000032399654629           |
| Alias              | vestisevolucion.PREX             |
| Nº de Cuenta       | (vacío)                          |
| Campo extra (label)| Cuenta Prex                      |
| Campo extra (valor)| 39965462                         |

> El "campo extra" se muestra tal como lo cargues (etiqueta + valor), por
> eso sirve para exponer campos específicos del canal (en este caso el
> número de cuenta de la billetera PREX).

---

## 🛒 Flujos de uso

### Tienda (carrito)

1. Usuario añade productos al carrito y pulsa **Realizar pedido**.
2. Selecciona:
   - **Pagar online** → se crea el pedido y se abre el `PaymentModal`:
     - MercadoPago → SDK + preferencia.
     - PayPal → redirect.
     - Transferencia → muestra datos bancarios → sube comprobante (queda en
       `awaiting_review`).
   - **Coordinar por WhatsApp** → se crea el pedido con
     `paymentMethod=whatsapp` y se abre WhatsApp pre-rellenado.

### Documental

1. Modal "Adquirir documental" presenta MP / PayPal / Transferencia.
2. Transferencia → muestra datos bancarios → sube comprobante → queda en
   `awaiting_review`. El admin lo aprueba y el usuario obtiene acceso.

### Suscripciones

1. Botones "Suscribirse" abren el `PaymentModal`.
2. Transferencia → sube comprobante → al aprobarse desde admin, el sistema crea
   automáticamente la suscripción (30 días) y eleva el rol del usuario.

### Mi Cuenta (`/mi-cuenta`)

- Tab **Información**: datos del usuario y estado de su suscripción.
- Tab **Mis compras**: pedidos de tienda, compras de documentales y
  solicitudes de suscripción por transferencia, todas con su badge de estado y
  enlace al comprobante.

### Admin (`/admin/pagos`)

- Tab Pedidos / Documentales / Suscripciones con filtros por estado y, en
  el caso de Documentales y Suscripciones, por método / canal.
- Aprobar / Rechazar (motivo requerido en rechazo).
- Ver comprobantes adjuntos (se muestran correctamente tanto si el pago
  fue por transferencia bancaria como por PREX).
- Cambiar estado de envío de pedidos.
- Tab Configuración: editar datos de cada canal (`bank`, `prex`), toggles
  individuales y WhatsApp. Cada canal se puede activar/desactivar por
  separado sin afectar al resto.

---

## ✅ Modelos de datos clave (Backend)

- `Order` — pedido de tienda con `paymentMethod` (`"mercadopago"`,
  `"paypal"`, `"transfer"`, `"prex"` o `"whatsapp"`), `paymentStatus`,
  `fulfillmentStatus`, datos de gateway o comprobante. Para los pagos por
  transferencia/PREX guarda `transferReceiptUrl`/`transferReferenceNumber`
  o `prexReceiptUrl`/`prexReferenceNumber`.
- `DocumentaryPurchase` — extendido con `method` (`"transfer"` o `"prex"`
  además de MP/PayPal/coupon/admin/free), estados `awaiting_review`/
  `rejected`, datos del comprobante.
- `SubscriptionTransfer` — solicitudes de suscripción por transferencia,
  con `method: "bank" | "prex"` para indicar el canal.
- `PaymentSettings` — singleton con `transferChannels: { bank, prex, ... }`
  (escalable), toggles por método, número de WhatsApp y precios del
  abono.

---

## 🔒 Seguridad

- Todos los precios se validan contra la DB al crear el pedido (no se confía en
  precio enviado por el cliente).
- Endpoints admin protegidos con `verifyRole(["admin","superadmin"])`.
- Sólo el dueño del pedido o un admin pueden verlo.
- Multer limita el archivo a 10 MB y valida MIME.
- Webhook de PayPal verifica firma contra `PAYPAL_WEBHOOK_ID` (si está
  configurado). En producción sin ID, rechaza por seguridad.

---

## 🛟 Operación: pagos PayPal no aplicados

Históricamente la plataforma dependía 100% del redirect de PayPal para enterarse
de los pagos. Si el usuario cerraba la pestaña antes del redirect a
`return_url`, el dinero llegaba al admin pero la cuenta del usuario nunca se
actualizaba.

Ahora hay tres mecanismos para cubrir esto:

### 1. Webhook de PayPal (recomendado, automático)

1. Crear webhook en <https://developer.paypal.com> (App → Webhooks → Add webhook).
2. URL: `https://api.vestisevolucion.com/api/v1/webhooks/paypal`.
3. Suscribir a los eventos: `CHECKOUT.ORDER.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED`.
4. Copiar el **Webhook ID** → variable de entorno `PAYPAL_WEBHOOK_ID`.
5. El backend valida la firma y aplica el pago usando el `reference_id` /
   `custom_id` que mandamos en cada `purchase_units`. Si no puede inferir el
   tipo, loggea al admin para que use el endpoint de reconciliación.

### 2. Reconciliación manual admin

`POST /api/v1/admin/paypal/reconcile` con body:

```json
// Suscripción
{
  "kind": "subscription",
  "transactionId": "5AB12345CD678901E",
  "email": "usuario@dominio.com"
}

// Pedido de tienda
{
  "kind": "order",
  "transactionId": "5AB12345CD678901E",
  "orderId": "67abc123..."
}

// Documental
{
  "kind": "documentary",
  "transactionId": "5AB12345CD678901E",
  "email": "usuario@dominio.com",
  "slug": "humano-existes"
}
```

El backend valida el pago contra PayPal (status, currency, monto con
tolerancia 5% por fees), aplica el efecto correspondiente y devuelve el
resultado. Es idempotente: si ya estaba aplicado, devuelve `alreadyApplied: true`.

### 3. Script one-shot (emergencia)

Para casos urgentes se incluye `scripts/reconcile-paypal-subscription.ts`.
Ejecutar con:

```bash
npm run reconcile:paypal -- --email=dfreyes10@gmail.com --transactionId=1233321412
```

(también puede invocarse con `npx ts-node-dev --transpile-only -r tsconfig-paths/register scripts/reconcile-paypal-subscription.ts --email=... --transactionId=...`)

El script:
- Valida el pago contra la API de PayPal (no confiar en sólo el id).
- Compara el monto capturado contra `PaymentSettings.subscription.paypalUsd`
  (tolera 5% por fees).
- Asigna el rol `user` **sin pisar roles existentes** (admin/superadmin).
- Es idempotente: aborta si el `transactionId` ya está asignado a otro usuario.

---

## 🐛 Bugs colaterales arreglados

| # | Archivo | Bug | Fix |
|---|---------|-----|-----|
| 1 | `paymentController.ts:captureOrder` | `user.roles = [paidUserRole]` machacaba roles | `applySubscriptionCapture` agrega con `push`, no pisa |
| 2 | `paymentController.ts:applyCoupon` | mismo bug de roles | mismo fix |
| 3 | `paymentController.ts:capturePreference` | mismo bug + hardcode `pilatestransmissionsarah.com` | fix roles + `successUrl = HOST` |
| 4 | `paymentController.ts:createPreference` | hardcode `pilatestransmissionsarah.com` en prod | `successUrl = HOST` |
| 5 | `paymentController.ts:captureOrder` | no revalidaba `hasActiveSubscription` | helper shared es idempotente |

## 🧱 Helpers compartidos

Toda la lógica de "aplicar un pago PayPal" vive en
`src/services/paypalCaptureService.ts`. Tanto el redirect `return_url` como
el webhook y la reconciliación admin usan los mismos helpers. Esto evita
duplicación y comportamiento divergente entre los caminos.

Funciones exportadas:
- `fetchPayPalOrder(transactionId)` — consulta cruda.
- `assertPaypalSubscriptionCompleted(transactionId)` — valida estado y monto.
- `applySubscriptionCapture({ userId, transactionId, paymentDate })`
- `applyOrderCapture({ orderId, transactionId, payerEmail, grantCommunityBonusFn })`
- `applyDocumentaryCapture({ userId, slug, transactionId })`

