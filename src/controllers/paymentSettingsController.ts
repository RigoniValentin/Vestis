import { Request, Response } from "express";
import { getPaymentSettings, PaymentSettingsModel } from "@models/PaymentSettings";

/**
 * GET /payment-settings
 * Endpoint público: devuelve los datos visibles para el cliente
 * (datos bancarios, toggles de métodos de pago, whatsapp).
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
      },
    });
  } catch (error) {
    console.error("getPublicPaymentSettings error:", error);
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

/**
 * PUT /payment-settings (admin)
 * Actualiza los datos bancarios y/o toggles.
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
