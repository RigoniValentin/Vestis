# Pasarela de Pagos — Vestis

Sistema integral de pagos para Tienda, Documental y Suscripciones, con:

- **MercadoPago** (ARS)
- **PayPal** (USD)
- **Transferencia bancaria** (con subida de comprobante y aprobación manual)
- **WhatsApp** (coordinación directa, exclusivo de la Tienda)

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
3. Carga los datos bancarios (Banco, Titular, CUIT, CBU, Alias, etc.).
4. Activa/desactiva los métodos `MercadoPago`, `PayPal`, `Transferencia` según
   estén disponibles.
5. Indica el número de WhatsApp (formato internacional sin `+`, ej:
   `5493512657790`).
6. Pulsa **Guardar cambios**.

> El backend crea automáticamente un singleton de `PaymentSettings` en la
> primera consulta. Los datos bancarios quedan visibles en el front cuando el
> cliente elige "Transferencia" en cualquier flujo de pago.

---

## 📂 Endpoints (Backend)

### Configuración de pagos

| Método | Ruta                          | Auth        | Descripción                       |
| ------ | ----------------------------- | ----------- | --------------------------------- |
| GET    | `/api/v1/payment-settings`    | público     | Datos bancarios y toggles         |
| GET    | `/api/v1/payment-settings/admin` | admin    | Settings completas                |
| PUT    | `/api/v1/payment-settings`    | admin       | Actualiza datos / toggles         |

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
| GET    | `/api/v1/orders/payment/mp/capture`                        | público (callback) |
| GET    | `/api/v1/orders/payment/paypal/capture`                    | público (callback) |
| GET    | `/api/v1/orders`                                           | admin  |
| PATCH  | `/api/v1/orders/:id/admin/approve`                         | admin  |
| PATCH  | `/api/v1/orders/:id/admin/reject`                          | admin  |
| PATCH  | `/api/v1/orders/:id/admin/fulfillment`                     | admin  |

### Documentales — Pago por transferencia

| Método | Ruta                                                  | Auth  |
| ------ | ----------------------------------------------------- | ----- |
| POST   | `/api/v1/documentaries/:slug/payment/transfer`        | user (multipart) |
| GET    | `/api/v1/documentaries/my-purchases`                  | user  |
| GET    | `/api/v1/documentaries/admin/purchases`               | admin |
| PATCH  | `/api/v1/documentaries/purchases/:id/approve`         | admin |
| PATCH  | `/api/v1/documentaries/purchases/:id/reject`          | admin |

### Suscripciones — Pago por transferencia

| Método | Ruta                                              | Auth  |
| ------ | ------------------------------------------------- | ----- |
| POST   | `/api/v1/subscription/transfer`                   | user (multipart con `receipt` + `referenceNumber` + `amount?`) |
| GET    | `/api/v1/subscription/transfer/my`                | user  |
| GET    | `/api/v1/subscription/transfer`                   | admin |
| PATCH  | `/api/v1/subscription/transfer/:id/approve`       | admin |
| PATCH  | `/api/v1/subscription/transfer/:id/reject`        | admin |

> El multer config en `middlewares/uploadReceipt.ts` acepta JPG/PNG/WEBP/GIF/PDF
> y guarda en `uploads/receipts/`. El backend expone `/uploads/...` como
> estático, por eso el front resuelve `transferReceiptUrl` directo.

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

- Tab Pedidos / Documentales / Suscripciones con filtros por estado.
- Aprobar / Rechazar (motivo requerido en rechazo).
- Ver comprobantes adjuntos.
- Cambiar estado de envío de pedidos.
- Tab Configuración: editar datos bancarios, toggles y WhatsApp.

---

## ✅ Modelos de datos clave (Backend)

- `Order` — pedido de tienda con `paymentMethod`, `paymentStatus`,
  `fulfillmentStatus`, datos de gateway o comprobante.
- `DocumentaryPurchase` — extendido con `method=transfer`, estados
  `awaiting_review`/`rejected`, datos del comprobante.
- `SubscriptionTransfer` — solicitudes de suscripción por transferencia.
- `PaymentSettings` — singleton de configuración (banco, toggles, WhatsApp).

---

## 🔒 Seguridad

- Todos los precios se validan contra la DB al crear el pedido (no se confía en
  precio enviado por el cliente).
- Endpoints admin protegidos con `verifyRole(["admin","superadmin"])`.
- Sólo el dueño del pedido o un admin pueden verlo.
- Multer limita el archivo a 10 MB y valida MIME.
