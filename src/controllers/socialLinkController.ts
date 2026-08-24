import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { SocialLinkService } from "@services/socialLinkService";
import {
  buildSocialLinkImageUrl,
} from "@middlewares/uploadSocialLink";

const service = new SocialLinkService();

const cleanUpload = async (filename?: string) => {
  if (!filename) return;
  try {
    const full = path.join(process.cwd(), "uploads", "social-links", filename);
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
};

const cleanByUrl = async (url?: string) => {
  if (!url) return;
  try {
    const relative = url.replace(/^\//, "");
    const full = path.join(process.cwd(), relative);
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
};

export class SocialLinkController {
  /**
   * GET /api/v1/social-links (público)
   */
  static async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const items = await service.getActiveSocialLinks();
      res.json({ success: true, data: items });
    } catch (error) {
      console.error("getActiveSocialLinks error:", error);
      res.status(500).json({ success: false, message: "Error al obtener redes sociales" });
    }
  }

  /**
   * GET /api/v1/social-links/admin (admin)
   */
  static async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const items = await service.getAllSocialLinks();
      res.json({ success: true, data: items });
    } catch (error) {
      console.error("getAllSocialLinks error:", error);
      res.status(500).json({ success: false, message: "Error al obtener redes sociales" });
    }
  }

  /**
   * POST /api/v1/social-links (admin)
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser?.id;
      if (!userId) {
        if (req.file) await cleanUpload(req.file.filename);
        res.status(401).json({ success: false, message: "No autenticado" });
        return;
      }

      const { name, url, order, isActive } = req.body || {};
      if (!name || !url) {
        if (req.file) await cleanUpload(req.file.filename);
        res.status(400).json({
          success: false,
          message: "Los campos name y url son requeridos",
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "La imagen del ícono es obligatoria",
        });
        return;
      }

      const item = await service.createSocialLink(
        {
          name: String(name).trim(),
          url: String(url).trim(),
          order: order !== undefined ? Number(order) : 0,
          isActive:
            isActive === undefined
              ? true
              : isActive === true || isActive === "true",
        },
        userId,
        buildSocialLinkImageUrl(req.file.filename)
      );

      res.status(201).json({
        success: true,
        message: "Red social creada exitosamente",
        data: item,
      });
    } catch (error: any) {
      console.error("createSocialLink error:", error);
      if (req.file) await cleanUpload(req.file.filename);
      if (error?.message?.includes("URL")) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Error al crear la red social",
      });
    }
  }

  /**
   * PUT /api/v1/social-links/:id (admin)
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const existing = await service.getSocialLinkById(id);
      if (!existing) {
        if (req.file) await cleanUpload(req.file.filename);
        res.status(404).json({ success: false, message: "No encontrado" });
        return;
      }

      const payload: any = {};
      if (req.body?.name !== undefined) payload.name = String(req.body.name).trim();
      if (req.body?.url !== undefined) payload.url = String(req.body.url).trim();
      if (req.body?.order !== undefined) payload.order = Number(req.body.order);
      if (req.body?.isActive !== undefined) {
        payload.isActive =
          req.body.isActive === true || req.body.isActive === "true";
      }

      let imageUrl: string | undefined;
      if (req.file) {
        imageUrl = buildSocialLinkImageUrl(req.file.filename);
      }

      const updated = await service.updateSocialLink(id, payload, imageUrl);

      if (req.file && updated) {
        await cleanByUrl(existing.imageUrl);
      }

      if (!updated) {
        if (req.file) await cleanUpload(req.file.filename);
        res.status(404).json({ success: false, message: "No encontrado" });
        return;
      }

      res.json({
        success: true,
        message: "Red social actualizada",
        data: updated,
      });
    } catch (error: any) {
      console.error("updateSocialLink error:", error);
      if (req.file) await cleanUpload(req.file.filename);
      if (error?.message?.includes("URL")) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Error al actualizar la red social",
      });
    }
  }

  /**
   * DELETE /api/v1/social-links/:id (admin)
   */
  static async remove(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const existing = await service.getSocialLinkById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: "No encontrado" });
        return;
      }
      await cleanByUrl(existing.imageUrl);
      const ok = await service.deleteSocialLink(id);
      if (!ok) {
        res.status(404).json({ success: false, message: "No encontrado" });
        return;
      }
      res.json({ success: true, message: "Red social eliminada" });
    } catch (error) {
      console.error("deleteSocialLink error:", error);
      res.status(500).json({ success: false, message: "Error al eliminar" });
    }
  }

  /**
   * PATCH /api/v1/social-links/:id/toggle (admin)
   */
  static async toggle(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const updated = await service.toggleSocialLinkStatus(id);
      if (!updated) {
        res.status(404).json({ success: false, message: "No encontrado" });
        return;
      }
      res.json({
        success: true,
        message: `Red social ${updated.isActive ? "activada" : "desactivada"}`,
        data: updated,
      });
    } catch (error) {
      console.error("toggleSocialLink error:", error);
      res.status(500).json({ success: false, message: "Error al cambiar estado" });
    }
  }
}
