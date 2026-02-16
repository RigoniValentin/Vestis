import { HOST, PAYPAL_API, PAYPAL_API_CLIENT, PAYPAL_API_SECRET } from "app";
import { NextFunction, Request, Response } from "express";
import axios from "axios";
import { UserService } from "@services/userService";
import { UserRepository } from "@repositories/userRepository";
import { RolesRepository } from "@repositories/rolesRepository";
import { RolesService } from "@services/rolesService";
import { Preference, MercadoPagoConfig } from "mercadopago";
import {
  SubscriptionInfo,
  UpdateSubscriptionExpirationRequest,
  UpdateSubscriptionExpirationResponse,
} from "../types/SubscriptionTypes";

// Crear una instancia de UserServicev
const userRepository = new UserRepository();
const userService = new UserService(userRepository);

// Crear una instancia de RolesService
const rolesRepository = new RolesRepository();
const rolesService = new RolesService(new RolesRepository());

// Agrega credenciales MP basadas en el entorno (producción o test)
const MP_ACCESS_TOKEN_ENV =
  process.env.NODE_ENV === "production"
    ? process.env.MP_ACCESS_TOKEN
    : process.env.MP_ACCESS_TOKENtest;
const MP_PUBLIC_KEY_ENV =
  process.env.NODE_ENV === "production"
    ? process.env.MP_PUBLIC_KEY
    : process.env.MP_PUBLIC_KEYtest;

const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN_ENV as string,
});

//#region PayPal
export const createOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.currentUser.id;

  // Valida si el usuario ya tiene una suscripción activa
  if (await userService.hasActiveSubscription(userId)) {
    res
      .status(400)
      .json({ message: "El usuario ya tiene una suscripción activa" });
    return;
  }

  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://pilatestransmissionsarah.com"
      : "https://pilatestransmissionsarah.com";

  const order = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: "13.00",
        },
      },
    ],
    application_context: {
      brand_name: "Pilates Transmission Sarah",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: `${baseUrl}/api/v1/capture-order?state=${userId}`, // Ruta del backend para capturar la orden
      cancel_url: `${baseUrl}/cancel-payment`, // Ruta del backend para manejar cancelaciones
    },
  };

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");

  const {
    data: { access_token },
  } = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, params, {
    auth: {
      username: PAYPAL_API_CLIENT!,
      password: PAYPAL_API_SECRET!,
    },
  });

  const response = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, order, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
  console.log(response.data);

  res.json(response.data);
};

export const captureOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { token, state } = req.query;

  try {
    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${token}/capture`,
      {},
      {
        auth: {
          username: PAYPAL_API_CLIENT!,
          password: PAYPAL_API_SECRET!,
        },
      }
    );

    console.log(response.data);

    // Verificar que la respuesta contiene la información esperada
    if (
      !response.data ||
      !response.data.payer ||
      !response.data.payer.email_address
    ) {
      res.status(400).json({ message: "Invalid response from PayPal" });
      return;
    }

    // Obtener el ID del usuario desde el token de sesión
    const userId = state as string;

    // Buscar al usuario en la base de datos
    const user = await userService.findUserById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Buscar el rol "paid_user" en la base de datos utilizando RolesService
    const paidUserRole = await rolesService.findRoles({ name: "user" });
    if (!paidUserRole || paidUserRole.length === 0) {
      res.status(500).json({ message: "Role 'user' not found" });
      return;
    }

    // Actualizar la suscripción del usuario y agregar el rol "paid_user"
    const transactionId = response.data.id;
    const purchaseUnit = response.data.purchase_units?.[0];
    const captureData = purchaseUnit?.payments?.captures?.[0];
    const rawPaymentDate = captureData?.create_time;

    if (!rawPaymentDate) {
      console.error("Payment capture date not found:", rawPaymentDate);
      res
        .status(500)
        .json({ message: "Payment date not found in PayPal response" });
      return;
    }

    const paymentDate = new Date(rawPaymentDate);
    if (isNaN(paymentDate.getTime())) {
      console.error("Invalid payment date from PayPal:", rawPaymentDate);
      res.status(500).json({ message: "Invalid payment date from PayPal" });
      return;
    }
    const expirationDate = new Date(paymentDate);
    expirationDate.setDate(expirationDate.getDate() + 30);

    user.roles = [paidUserRole[0]]; // Agregar el rol "paid_user"
    user.subscription = {
      transactionId,
      paymentDate,
      expirationDate,
    };
    await user.save();

    res.redirect(`${HOST}/pagoAprobado`);
  } catch (error) {
    console.error("Error capturing order:", error);
    res.status(500).json({ message: "Error processing payment", error });
  }
};

export const cancelPayment = (req: Request, res: Response) => {
  res.redirect("/");
};
//#endregion

//#region MercadoPago
// Esta función crea la preferencia y solo devuelve el ID para que el cliente sea redirigido a MP.
export const createPreference = async (req: Request, res: Response) => {
  const userId = req.currentUser.id;

  // Valida si el usuario ya tiene una suscripción activa
  if (await userService.hasActiveSubscription(userId)) {
    res
      .status(400)
      .json({ message: "El usuario ya tiene una suscripción activa" });
    return;
  }

  try {
    const successUrl =
      process.env.NODE_ENV === "production"
        ? `https://pilatestransmissionsarah.com/pagoAprobado?state=${userId}`
        : `http://localhost:3016/pagoAprobado?state=${userId}`;

    const body = {
      items: req.body.map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        currency_id: "ARS",
        unit_price: item.unit_price,
      })),
      back_urls: {
        success: successUrl,
        failure: `https://martin-juncos.github.io/failure/`,
        pending: `https://martin-juncos.github.io/pending/`,
      },
      auto_return: "approved",
    };

    const preference = new Preference(mercadoPagoClient);
    const result = await preference.create({ body });
    console.log("Preference created:", result.id);
    // Always return the access token for production to ensure proper authorization
    console.log("Preference created:", result.id);
    res.json({ id: result.id });
  } catch (error) {
    console.log("Error al procesar el pago (MP) :>>", error);
    res.status(500).json({ message: "Error al procesar el pago", error });
  }
};

// Este nuevo endpoint se ejecuta una vez confirmado el pago en MercadoPago
export const capturePreference = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log(
    "capturePreference: Function called with query params",
    req.query
  );

  // Se asume que MercadoPago redirige con al menos: state (userId), payment_id y status
  const { state, payment_id, status } = req.query;
  console.log(
    "capturePreference: Extracted state =",
    state,
    "payment_id =",
    payment_id,
    "status =",
    status
  );

  if (status !== "approved") {
    console.log("capturePreference: Payment status not approved");
    res.status(400).json({ message: "Payment not approved" });
    return;
  }

  try {
    const userId = state as string;
    const user = await userService.findUserById(userId);
    console.log("capturePreference: User lookup for", userId, "result:", user);
    if (!user) {
      console.log("capturePreference: User not found");
      res.status(404).json({ message: "User not found" });
      return;
    }

    const paidUserRole = await rolesService.findRoles({ name: "user" });
    console.log("capturePreference: Retrieved role 'user':", paidUserRole);
    if (!paidUserRole || paidUserRole.length === 0) {
      console.log("capturePreference: Role 'user' not found");
      res.status(500).json({ message: "Role 'user' not found" });
      return;
    }

    const paymentDate = new Date();
    const expirationDate = new Date(paymentDate);
    expirationDate.setDate(expirationDate.getDate() + 30);
    console.log(
      "capturePreference: Calculated paymentDate =",
      paymentDate,
      "and expirationDate =",
      expirationDate
    );

    user.roles = [paidUserRole[0]];
    user.subscription = {
      transactionId: payment_id as string,
      paymentDate,
      expirationDate,
    };
    await user.save();

    const successUrl =
      process.env.NODE_ENV === "production"
        ? `https://pilatestransmissionsarah.com/pagoAprobado?state=${userId}`
        : `http://localhost:3016/pagoAprobado?state=${userId}`;
    console.log("capturePreference: Redirecting to", successUrl);
    res.redirect(successUrl);
  } catch (error) {
    console.log("capturePreference: Error capturing MP payment:", error);
    res.status(500).json({ message: "Error processing MP payment", error });
  }
};
//#endregion

export const applyCoupon = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Se espera recibir { coupon: string } en el body
    const { coupon } = req.body;
    const userId = req.currentUser.id;

    // Validar el cupón (ejemplo: "INVITECOUPON2025" es el cupón válido)
    if (coupon !== "INVITECOUPON2025") {
      res.status(400).json({ message: "Cupón inválido" });
      return;
    }

    const user = await userService.findUserById(userId);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    // Verificar si el cupón ya fue utilizado
    if (user.couponUsed) {
      res.status(400).json({ message: "El cupón ya fue utilizado" });
      return;
    }

    // Buscar el rol "user" (o el rol deseado) en la base de datos
    const paidUserRole = await rolesService.findRoles({ name: "user" });
    if (!paidUserRole || paidUserRole.length === 0) {
      res.status(500).json({ message: "Rol 'user' no encontrado" });
      return;
    }

    const paymentDate = new Date();
    // Configurar la fecha de expiración hasta el 31 de julio de 2025 (UTC)
    const expirationDate = new Date("2025-07-31T23:59:59Z");

    // Actualizar el rol, la suscripción y marcar que se utilizó el cupón
    user.roles = [paidUserRole[0]];
    user.subscription = {
      transactionId: coupon, // Se puede usar el cupón como identificador de transacción
      paymentDate,
      expirationDate,
    };
    user.couponUsed = true; // Marcar que ya se utilizó el cupón
    await user.save();

    res.json({
      message: "Suscripción actualizada con cupón",
      subscription: user.subscription,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ message: "Error al aplicar el cupón", error });
  }
};

// Nuevo endpoint para obtener información de la suscripción del usuario
export const getSubscriptionInfo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.currentUser.id;

    const user = await userService.findUserById(userId);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    // Verificar si el usuario tiene una suscripción
    if (!user.subscription) {
      res.json({
        hasSubscription: false,
        message: "El usuario no tiene una suscripción activa",
      });
      return;
    }

    const currentDate = new Date();
    const expirationDate = new Date(user.subscription.expirationDate);
    const paymentDate = new Date(user.subscription.paymentDate);

    // Calcular días restantes
    const timeDifference = expirationDate.getTime() - currentDate.getTime();
    const daysRemaining = Math.ceil(timeDifference / (1000 * 3600 * 24));

    // Determinar el estado de la suscripción
    const isActive = daysRemaining > 0;
    const isExpired = daysRemaining <= 0;
    const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

    // Calcular días transcurridos desde el último pago
    const daysSincePayment = Math.floor(
      (currentDate.getTime() - paymentDate.getTime()) / (1000 * 3600 * 24)
    );

    // Determinar el método de pago usado
    const paymentMethod = user.subscription.transactionId.startsWith("PAY-")
      ? "PayPal"
      : user.subscription.transactionId === "INVITECOUPON2025"
      ? "Cupón de Invitación"
      : "MercadoPago";

    const subscriptionInfo: SubscriptionInfo = {
      hasSubscription: true,
      isActive,
      isExpired,
      isExpiringSoon,
      subscription: {
        transactionId: user.subscription.transactionId,
        paymentDate: user.subscription.paymentDate,
        expirationDate: user.subscription.expirationDate,
        daysRemaining: Math.max(0, daysRemaining),
        daysSincePayment,
        paymentMethod,
        status: isExpired
          ? "Expirada"
          : isExpiringSoon
          ? "Por expirar"
          : "Activa",
      },
      user: {
        email: user.email,
        name: user.name,
        roles: user.roles?.map((role) => role.name) || [],
      },
    };

    res.json(subscriptionInfo);
  } catch (error) {
    console.error("Error getting subscription info:", error);
    res.status(500).json({
      message: "Error al obtener información de la suscripción",
      error,
    });
  }
};

// Función para que el admin extienda la suscripción de un usuario por un mes
export const extendUserSubscription = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;
    const adminUserId = req.currentUser.id;

    // Verificar que el email fue proporcionado
    if (!email) {
      res.status(400).json({ message: "El email del usuario es requerido" });
      return;
    }

    // Verificar que el usuario actual es admin
    const adminUser = await userService.findUserById(adminUserId);
    if (!adminUser) {
      res.status(404).json({ message: "Usuario administrador no encontrado" });
      return;
    }

    // Verificar si el usuario tiene rol de admin
    const isAdmin = adminUser.roles?.some(
      (role) => role.name === "admin" || role.name === "superadmin"
    );

    if (!isAdmin) {
      res.status(403).json({
        message:
          "No tienes permisos para realizar esta acción. Solo los administradores pueden extender suscripciones.",
      });
      return;
    }

    // Buscar el usuario por email
    const targetUser = await userService.findUserByEmail(email);
    if (!targetUser) {
      res.status(404).json({
        message: `Usuario con email ${email} no encontrado`,
      });
      return;
    }

    // Verificar si el usuario tiene una suscripción
    if (!targetUser.subscription) {
      res.status(400).json({
        message: `El usuario ${email} no tiene una suscripción para extender`,
      });
      return;
    }

    // Calcular la nueva fecha de expiración (extender 30 días)
    const currentExpirationDate = new Date(
      targetUser.subscription.expirationDate
    );
    const newExpirationDate = new Date(currentExpirationDate);
    newExpirationDate.setDate(newExpirationDate.getDate() + 30);

    // Actualizar la suscripción
    const previousExpiration = new Date(targetUser.subscription.expirationDate);
    targetUser.subscription.expirationDate = newExpirationDate;

    // Guardar los cambios
    await targetUser.save();

    // Calcular días añadidos para confirmar
    const daysAdded = Math.ceil(
      (newExpirationDate.getTime() - previousExpiration.getTime()) /
        (1000 * 3600 * 24)
    );

    // Respuesta exitosa
    res.json({
      message: `Suscripción extendida exitosamente para ${email}`,
      details: {
        userEmail: targetUser.email,
        userName: targetUser.name,
        previousExpirationDate: previousExpiration,
        newExpirationDate: newExpirationDate,
        daysAdded: daysAdded,
        extendedBy: {
          adminEmail: adminUser.email,
          adminName: adminUser.name,
          timestamp: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Error extending user subscription:", error);
    res.status(500).json({
      message: "Error al extender la suscripción del usuario",
      error,
    });
  }
};

// Función para que el admin actualice la fecha de expiración específica de un usuario
export const updateSubscriptionExpiration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, expirationDate }: UpdateSubscriptionExpirationRequest =
      req.body;
    const adminUserId = req.currentUser.id;

    // Validar que los campos requeridos están presentes
    if (!email) {
      res.status(400).json({
        success: false,
        message: "El email del usuario es requerido",
      });
      return;
    }

    if (!expirationDate) {
      res.status(400).json({
        success: false,
        message: "La fecha de expiración es requerida",
      });
      return;
    }

    // Validar formato de fecha (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expirationDate)) {
      res.status(400).json({
        success: false,
        message: "El formato de fecha debe ser YYYY-MM-DD",
      });
      return;
    }

    // Convertir la fecha a objeto Date y validar que sea válida
    const targetDate = new Date(expirationDate + "T23:59:59.000Z");
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({
        success: false,
        message: "La fecha proporcionada no es válida",
      });
      return;
    }

    // Validar que la fecha esté en el futuro
    const currentDate = new Date();
    if (targetDate <= currentDate) {
      res.status(400).json({
        success: false,
        message: "La fecha de expiración debe ser posterior a la fecha actual",
      });
      return;
    }

    // Verificar que el usuario actual es admin
    const adminUser = await userService.findUserById(adminUserId);
    if (!adminUser) {
      res.status(404).json({
        success: false,
        message: "Usuario administrador no encontrado",
      });
      return;
    }

    // Verificar si el usuario tiene rol de admin
    const isAdmin = adminUser.roles?.some(
      (role) => role.name === "admin" || role.name === "superadmin"
    );

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message:
          "No tienes permisos para realizar esta acción. Solo los administradores pueden modificar suscripciones.",
      });
      return;
    }

    // Buscar el usuario por email
    const targetUser = await userService.findUserByEmail(email);
    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: `Usuario con email ${email} no encontrado`,
      });
      return;
    }

    // Obtener la fecha de expiración anterior (si existe)
    const previousExpirationDate =
      targetUser.subscription?.expirationDate || null;

    // Variable para indicar si se creó una nueva suscripción
    let subscriptionCreated = false;

    // Verificar si el usuario tiene una suscripción existente
    if (targetUser.subscription) {
      // Actualizar la fecha de expiración manteniendo los demás campos
      targetUser.subscription = {
        transactionId:
          targetUser.subscription.transactionId ||
          `UPDATE_BY_ADMIN_${new Date().getFullYear()}`,
        paymentDate: targetUser.subscription.paymentDate || new Date(),
        expirationDate: targetDate,
      };
    } else {
      // Crear nuevo objeto subscription completo
      targetUser.subscription = {
        transactionId: `UPDATE_BY_ADMIN_${new Date().getFullYear()}`,
        paymentDate: new Date(),
        expirationDate: targetDate,
      };
      subscriptionCreated = true;
    }

    // Guardar los cambios
    await targetUser.save();

    // Log de auditoría
    console.log(`[AUDIT] Subscription expiration updated by admin:`, {
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      targetUserEmail: email,
      targetUserName: targetUser.name,
      previousExpirationDate,
      newExpirationDate: targetDate,
      subscriptionCreated,
      timestamp: new Date().toISOString(),
    });

    // Respuesta exitosa
    const response: UpdateSubscriptionExpirationResponse = {
      success: true,
      message: "Fecha de expiración actualizada correctamente",
      details: {
        userName: targetUser.name,
        userEmail: targetUser.email,
        previousExpirationDate,
        newExpirationDate: targetDate,
        subscriptionCreated,
        updatedBy: {
          adminName: adminUser.name,
          adminEmail: adminUser.email,
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error updating subscription expiration:", error);
    res.status(500).json({
      success: false,
      message:
        "Error interno del servidor al actualizar la fecha de expiración",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};
