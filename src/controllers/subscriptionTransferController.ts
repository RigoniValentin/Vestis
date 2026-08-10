import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { SubscriptionTransferModel } from "@models/SubscriptionTransfer";
import { UserModel } from "@models/Users";
import { RolesRepository } from "@repositories/rolesRepository";
import { RolesService } from "@services/rolesService";
import { buildReceiptUrl } from "@middlewares/uploadReceipt";
import {
  getSubscriptionDurationDays,
  getSubscriptionPriceArs,
} from "@models/PaymentSettings";

const rolesService = new RolesService(new RolesRepository());

/**
 * POST /subscription/transfer
 * multipart/form-data: receipt, referenceNumber, amount?
 * Crea una solicitud de suscripción por transferencia (pendiente de admin).
 */
export const uploadSubscriptionReceipt = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const file = req.file;
    const { referenceNumber, amount } = req.body || {};

    if (!file) {
      res.status(400).json({ success: false, message: "Comprobante requerido" });
      return;
    }
    if (!referenceNumber || String(referenceNumber).trim().length < 2) {
      try { await fs.unlink(file.path); } catch {}
      res
        .status(400)
        .json({ success: false, message: "Número de referencia requerido" });
      return;
    }

    // Precio configurable desde PaymentSettings (lo edita el admin).
    const defaultArs = await getSubscriptionPriceArs();
    const submittedAmount = Number(amount);
    const finalAmount =
      Number.isFinite(submittedAmount) && submittedAmount > 0
        ? submittedAmount
        : defaultArs;

    // Si ya tenía una solicitud awaiting_review/rejected, reemplazar comprobante
    const existing = await SubscriptionTransferModel.findOne({
      userId,
      status: { $in: ["awaiting_review", "rejected"] },
    });

    if (existing) {
      if (existing.receiptUrl) {
        try {
          await fs.unlink(path.join(process.cwd(), existing.receiptUrl));
        } catch {}
      }
      existing.referenceNumber = String(referenceNumber).trim();
      existing.receiptUrl = buildReceiptUrl(file.filename);
      existing.amount = finalAmount;
      existing.status = "awaiting_review";
      existing.adminNotes = undefined;
      await existing.save();
      res.json({ success: true, data: existing });
      return;
    }

    const transfer = await SubscriptionTransferModel.create({
      userId,
      amount: finalAmount,
      currency: "ARS",
      referenceNumber: String(referenceNumber).trim(),
      receiptUrl: buildReceiptUrl(file.filename),
    });
    res.json({ success: true, data: transfer });
  } catch (error: any) {
    console.error("uploadSubscriptionReceipt error:", error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

/**
 * GET /subscription/transfer/my
 * Devuelve solicitudes de transferencia del usuario actual.
 */
export const getMySubscriptionTransfers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const list = await SubscriptionTransferModel.find({ userId }).sort({
      createdAt: -1,
    });
    res.json({ success: true, data: list });
  } catch {
    res.status(500).json({ success: false, message: "Error" });
  }
};

/**
 * GET /subscription/transfer (admin)
 */
export const listSubscriptionTransfers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    const list = await SubscriptionTransferModel.find(filter)
      .populate("userId", "name email username")
      .sort({ createdAt: -1 })
      .limit(1000);
    res.json({ success: true, data: list });
  } catch {
    res.status(500).json({ success: false, message: "Error" });
  }
};

/**
 * PATCH /subscription/transfer/:id/approve (admin)
 * Aprueba la transferencia y crea/extiende la suscripción del usuario
 * por la duración configurada en PaymentSettings.subscription.durationDays.
 */
export const approveSubscriptionTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = (req as any).currentUser?.id;
    const tr = await SubscriptionTransferModel.findById(req.params.id);
    if (!tr) {
      res.status(404).json({ success: false, message: "No encontrada" });
      return;
    }
    const user = await UserModel.findById(tr.userId);
    if (!user) {
      res.status(404).json({ success: false, message: "Usuario no encontrado" });
      return;
    }
    const paidRole = await rolesService.findRoles({ name: "user" });
    if (paidRole && paidRole.length > 0) {
      user.roles = [paidRole[0]];
    }
    const paymentDate = new Date();
    const durationDays = await getSubscriptionDurationDays();
    const expirationDate = new Date(paymentDate);
    expirationDate.setDate(expirationDate.getDate() + durationDays);
    user.subscription = {
      transactionId: `TRANSFER_${tr._id}`,
      paymentDate,
      expirationDate,
    };
    await user.save();

    tr.status = "approved";
    tr.reviewedBy = adminId;
    tr.reviewedAt = new Date();
    if (req.body?.adminNotes) tr.adminNotes = String(req.body.adminNotes);
    await tr.save();

    res.json({ success: true, data: tr });
  } catch (error) {
    console.error("approveSubscriptionTransfer error:", error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

/**
 * PATCH /subscription/transfer/:id/reject (admin)
 */
export const rejectSubscriptionTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = (req as any).currentUser?.id;
    const { adminNotes } = req.body || {};
    if (!adminNotes) {
      res
        .status(400)
        .json({ success: false, message: "Motivo requerido (adminNotes)" });
      return;
    }
    const tr = await SubscriptionTransferModel.findById(req.params.id);
    if (!tr) {
      res.status(404).json({ success: false, message: "No encontrada" });
      return;
    }
    tr.status = "rejected";
    tr.reviewedBy = adminId;
    tr.reviewedAt = new Date();
    tr.adminNotes = String(adminNotes);
    await tr.save();
    res.json({ success: true, data: tr });
  } catch {
    res.status(500).json({ success: false, message: "Error" });
  }
};
