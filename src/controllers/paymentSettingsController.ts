import { Request, Response } from "express";
import { getPaymentSettings, PaymentSettingsModel } from "@models/PaymentSettings";

/**
 * GET /payment-settings
 * Endpoint público: devuelve los datos visibles para el cliente
 * (datos bancarios, toggles de métodos de pago, whatsapp, precios del abono).
 * No expone metadata sensible adicional.
 */
export const getPublicPaymentSettings = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const settings = await getPaymentSettings();
    res.json({
      success: true,
      data: {
        bank: settings.bank,
        mercadopagoEnabled: settings.mercadopagoEnabled,
        paypalEnabled: settings.paypalEnabled,
        transferEnabled: settings.transferEnabled,
        whatsappPhone: settings.whatsappPhone,
        subscription: settings.subscription,
      },
    });
  } catch (error) {
    console.error("getPublicPaymentSettings error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /payment-settings/subscription
 * Endpoint público específico para que el cliente lea los precios del abono
 * (incluye valores opcionales como fromPriceArs para banners).
 */
export const getPublicSubscriptionPricing = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const settings = await getPaymentSettings();
    res.json({
      success: true,
      data: settings.subscription,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /payment-settings/admin
 * (admin) idéntico al público pero protegido — por simetría.
 */
export const getAdminPaymentSettings = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const settings = await getPaymentSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

const sanitizeNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return undefined;
  return num;
};

/**
 * PUT /payment-settings (admin)
 * Actualiza los datos bancarios, toggles y precios del abono.
 */
export const updatePaymentSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const body = req.body || {};
    const update: any = {};

    if (body.bank && typeof body.bank === "object") {
      update.bank = {
        bankName: body.bank.bankName,
        accountHolder: body.bank.accountHolder,
        cuit: body.bank.cuit,
        accountNumber: body.bank.accountNumber,
        cbu: body.bank.cbu,
        alias: body.bank.alias,
        extraInfo: body.bank.extraInfo,
      };
    }
    if (typeof body.mercadopagoEnabled === "boolean")
      update.mercadopagoEnabled = body.mercadopagoEnabled;
    if (typeof body.paypalEnabled === "boolean")
      update.paypalEnabled = body.paypalEnabled;
    if (typeof body.transferEnabled === "boolean")
      update.transferEnabled = body.transferEnabled;
    if (typeof body.whatsappPhone === "string")
      update.whatsappPhone = body.whatsappPhone;

    if (body.subscription && typeof body.subscription === "object") {
      const sub: any = {};
      if (typeof body.subscription.enabled === "boolean")
        sub.enabled = body.subscription.enabled;
      const monthlyArs = sanitizeNumber(body.subscription.monthlyArs);
      if (monthlyArs !== undefined) sub.monthlyArs = monthlyArs;
      const monthlyUsd = sanitizeNumber(body.subscription.monthlyUsd);
      if (monthlyUsd !== undefined) sub.monthlyUsd = monthlyUsd;
      const paypalUsd = sanitizeNumber(body.subscription.paypalUsd);
      if (paypalUsd !== undefined) sub.paypalUsd = paypalUsd;
      const durationDays = sanitizeNumber(body.subscription.durationDays);
      if (durationDays !== undefined && durationDays >= 1)
        sub.durationDays = Math.floor(durationDays);
      if (body.subscription.fromPriceArs === null) {
        sub.fromPriceArs = null;
      } else {
        const fromPriceArs = sanitizeNumber(body.subscription.fromPriceArs);
        if (fromPriceArs !== undefined) sub.fromPriceArs = fromPriceArs;
      }
      update.subscription = sub;
    }

    const existing = await PaymentSettingsModel.findOne();
    let updated;
    if (!existing) {
      updated = await PaymentSettingsModel.create(update);
    } else {
      updated = await PaymentSettingsModel.findByIdAndUpdate(
        existing._id,
        { $set: update },
        { new: true }
      );
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updatePaymentSettings error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};
