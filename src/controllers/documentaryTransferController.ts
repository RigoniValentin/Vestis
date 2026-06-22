import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { DocumentaryModel } from "@models/Documentary";
import { DocumentaryPurchaseModel } from "@models/DocumentaryPurchase";
import { buildReceiptUrl } from "@middlewares/uploadReceipt";
import { DEFAULT_SLUG, normalizeSlug, userOwnsDocumentary } from "./documentaryController";

/**
 * POST /documentaries/:slug/payment/transfer
 * multipart/form-data: receipt (archivo), referenceNumber (texto)
 * Crea una compra en estado `awaiting_review` esperando que admin apruebe.
 */
export const uploadDocumentaryReceipt = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const slug = normalizeSlug(req.params.slug, DEFAULT_SLUG);
    const file = req.file;
    const { referenceNumber } = req.body || {};

    if (!file) {
      res.status(400).json({ success: false, message: "Comprobante requerido" });
      return;
    }
    if (!referenceNumber || String(referenceNumber).trim().length < 2) {
      try {
        await fs.unlink(file.path);
      } catch {}
      res
        .status(400)
        .json({ success: false, message: "Número de referencia requerido" });
      return;
    }

    const doc = await DocumentaryModel.findOne({ slug }).lean();
    if (!doc) {
      try {
        await fs.unlink(file.path);
      } catch {}
      res
        .status(404)
        .json({ success: false, message: "Documental no encontrado" });
      return;
    }

    if (await userOwnsDocumentary(userId, slug)) {
      try {
        await fs.unlink(file.path);
      } catch {}
      res.status(400).json({ success: false, message: "Ya posees este documental" });
      return;
    }

    // Si ya tiene un awaiting_review previo, actualizar
    const existing = await DocumentaryPurchaseModel.findOne({
      userId,
      documentarySlug: slug,
      status: { $in: ["pending", "awaiting_review", "rejected"] },
    });

    if (existing) {
      // Borrar comprobante previo si lo había
      if (existing.transferReceiptUrl) {
        try {
          await fs.unlink(
            path.join(process.cwd(), existing.transferReceiptUrl)
          );
        } catch {}
      }
      existing.method = "transfer";
      existing.amount = doc.priceArs;
      existing.currency = doc.currency || "ARS";
      existing.status = "awaiting_review";
      existing.transferReferenceNumber = String(referenceNumber).trim();
      existing.transferReceiptUrl = buildReceiptUrl(file.filename);
      existing.adminNotes = undefined;
      await existing.save();
      res.json({ success: true, data: existing });
      return;
    }

    const purchase = await DocumentaryPurchaseModel.create({
      userId,
      documentarySlug: slug,
      method: "transfer",
      amount: doc.priceArs,
      currency: doc.currency || "ARS",
      status: "awaiting_review",
      transferReferenceNumber: String(referenceNumber).trim(),
      transferReceiptUrl: buildReceiptUrl(file.filename),
    });

    res.json({ success: true, data: purchase });
  } catch (error: any) {
    console.error("uploadDocumentaryReceipt error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al subir comprobante" });
  }
};

/**
 * GET /documentaries/admin/purchases?status=awaiting_review
 * Lista compras de TODOS los documentales (admin).
 */
export const listAllDocumentaryPurchases = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, method } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (method) filter.method = method;

    const purchases = await DocumentaryPurchaseModel.find(filter)
      .populate("userId", "name email username")
      .sort({ createdAt: -1 })
      .limit(1000);
    res.json({ success: true, data: purchases });
  } catch (error) {
    console.error("listAllDocumentaryPurchases error:", error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

/**
 * PATCH /documentaries/purchases/:id/approve  (admin)
 * Aprueba una compra (típicamente transfer).
 */
export const approveDocumentaryPurchase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = (req as any).currentUser?.id;
    const purchase = await DocumentaryPurchaseModel.findById(req.params.id);
    if (!purchase) {
      res.status(404).json({ success: false, message: "No encontrada" });
      return;
    }
    purchase.status = "approved";
    purchase.paidAt = purchase.paidAt || new Date();
    purchase.reviewedBy = adminId;
    purchase.reviewedAt = new Date();
    if (req.body?.adminNotes)
      purchase.adminNotes = String(req.body.adminNotes);
    await purchase.save();
    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error("approveDocumentaryPurchase error:", error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

/**
 * PATCH /documentaries/purchases/:id/reject  (admin)
 * body: { adminNotes: string }
 */
export const rejectDocumentaryPurchase = async (
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
    const purchase = await DocumentaryPurchaseModel.findById(req.params.id);
    if (!purchase) {
      res.status(404).json({ success: false, message: "No encontrada" });
      return;
    }
    purchase.status = "rejected";
    purchase.reviewedBy = adminId;
    purchase.reviewedAt = new Date();
    purchase.adminNotes = String(adminNotes);
    await purchase.save();
    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error("rejectDocumentaryPurchase error:", error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

/**
 * GET /documentaries/my-purchases
 * Devuelve las compras del usuario autenticado.
 */
export const getMyDocumentaryPurchases = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).currentUser?.id;
    const purchases = await DocumentaryPurchaseModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};
