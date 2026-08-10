import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { LensContentService } from "@services/lensContentService";
import { LensContentRepository } from "@repositories/lensContentRepository";
import { QnaTopic, QNA_TOPICS } from "@models/CommunityPost";
import { LensContentCreatePayload, LensContentUpdatePayload } from "types/LensContentTypes";
import { buildLensContentImageUrl } from "@middlewares/uploadCommunity";
import {
  emitLensContentCreated,
  emitLensContentDeleted,
  emitLensContentUpdated,
} from "@services/communityRealtimeService";

const lensContentService = new LensContentService(new LensContentRepository());

const isAdminUser = (req: Request): boolean => {
  const user: any = (req as any).currentUser;
  return !!user?.roles?.some((role: any) =>
    ["admin", "superadmin"].includes(role?.name)
  );
};

const cleanFile = async (filename?: string) => {
  if (!filename) return;
  try {
    const full = path.join(process.cwd(), "uploads", "lens-content", filename);
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
};

const cleanFileByUrl = async (url?: string | null) => {
  if (!url) return;
  try {
    const relative = url.replace(/^\//, "");
    const full = path.join(process.cwd(), relative);
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
};

const parseTopic = (value: unknown): QnaTopic | undefined => {
  if (typeof value !== "string") return undefined;
  return QNA_TOPICS.includes(value as QnaTopic)
    ? (value as QnaTopic)
    : undefined;
};

const populateAuthor = async (item: any) => {
  if (!item) return item;
  const { LensContentModel } = await import("@models/LensContent");
  const populated = await LensContentModel.findById(item._id).populate(
    "author",
    "name username avatarUrl"
  );
  return populated || item;
};

export const listLensContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const topic = parseTopic(req.query.topic);
    const includeInactive =
      req.query.includeInactive === "true" && isAdminUser(req);
    const items = await lensContentService.listContent(topic, { includeInactive });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("listLensContent error:", error);
    res.status(500).json({ message: "Error listando contenido de lentes" });
  }
};

export const adminListLensContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const items = await lensContentService.listContent(undefined, {
      includeInactive: true,
    });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const createLensContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      if (req.file) await cleanFile(req.file.filename);
      res.status(403).json({ message: "Solo Liz puede crear contenido de lentes" });
      return;
    }

    const userId = (req as any).currentUser?.id;
    const topic = parseTopic(req.body?.topic);
    const title = String(req.body?.title || "").trim();

    if (!topic) {
      if (req.file) await cleanFile(req.file.filename);
      res.status(400).json({ message: "Eje del lente obligatorio" });
      return;
    }
    if (!title) {
      if (req.file) await cleanFile(req.file.filename);
      res.status(400).json({ message: "Título obligatorio" });
      return;
    }

    let linkPayload: { label?: string; url: string } | undefined;
    if (req.body?.linkUrl) {
      linkPayload = {
        url: String(req.body.linkUrl),
        label: req.body.linkLabel ? String(req.body.linkLabel) : undefined,
      };
    }

    const payload: LensContentCreatePayload = {
      topic,
      title,
      body: req.body?.body ? String(req.body.body) : undefined,
      imageUrl: req.file ? buildLensContentImageUrl(req.file.filename) : undefined,
      videoUrl: req.body?.videoUrl ? String(req.body.videoUrl) : undefined,
      link: linkPayload,
      isPinned: req.body?.isPinned === "true" || req.body?.isPinned === true,
      isActive:
        req.body?.isActive === undefined
          ? true
          : req.body?.isActive === "true" || req.body?.isActive === true,
      author: userId,
    };

    const created = await lensContentService.createContent(payload);
    const populated = await populateAuthor(created);
    emitLensContentCreated(populated);
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    console.error("createLensContent error:", error);
    if (req.file) await cleanFile(req.file.filename);
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error creando contenido",
    });
  }
};

export const updateLensContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      if (req.file) await cleanFile(req.file.filename);
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const id = req.params.id as string;
    const existing = await lensContentService.findById(id);
    if (!existing) {
      if (req.file) await cleanFile(req.file.filename);
      res.status(404).json({ message: "Contenido no encontrado" });
      return;
    }

    const payload: LensContentUpdatePayload = {};

    const topic = parseTopic(req.body?.topic);
    if (topic) payload.topic = topic;
    if (req.body?.title !== undefined) payload.title = String(req.body.title);
    if (req.body?.body !== undefined)
      payload.body = req.body.body === "" ? null : String(req.body.body);

    if (req.body?.videoUrl !== undefined) {
      payload.videoUrl =
        req.body.videoUrl === "" ? null : String(req.body.videoUrl);
    }

    if (req.body?.linkUrl !== undefined) {
      if (req.body.linkUrl === "") {
        payload.link = null;
      } else {
        payload.link = {
          url: String(req.body.linkUrl),
          label: req.body.linkLabel
            ? String(req.body.linkLabel)
            : "Ver más",
        };
      }
    }

    if (req.body?.removeImage === "true") payload.imageUrl = null;

    if (req.body?.isPinned !== undefined) {
      payload.isPinned =
        req.body.isPinned === "true" || req.body.isPinned === true;
    }
    if (req.body?.isActive !== undefined) {
      payload.isActive =
        req.body.isActive === "true" || req.body.isActive === true;
    }

    const updated = await lensContentService.updateContent(id, payload);

    let finalDoc = updated;
    if (req.file) {
      await cleanFileByUrl(existing.imageUrl);
      finalDoc = await lensContentService.updateContent(id, {
        imageUrl: buildLensContentImageUrl(req.file.filename),
      });
    }

    const populated = await populateAuthor(finalDoc || updated);
    emitLensContentUpdated(populated || updated);
    res.json({ success: true, data: populated || updated });
  } catch (error: any) {
    console.error("updateLensContent error:", error);
    if (req.file) await cleanFile(req.file.filename);
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error actualizando",
    });
  }
};

export const deleteLensContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const id = req.params.id as string;
    const existing = await lensContentService.findById(id);
    if (!existing) {
      res.status(404).json({ message: "Contenido no encontrado" });
      return;
    }
    await cleanFileByUrl(existing.imageUrl);
    const ok = await lensContentService.deleteContent(id);
    if (ok) emitLensContentDeleted(id);
    res.json({ success: ok });
  } catch (error) {
    console.error("deleteLensContent error:", error);
    res.status(500).json({ message: "Error eliminando" });
  }
};

export const toggleLensContentPin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const existing = await lensContentService.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: "Contenido no encontrado" });
      return;
    }
    const updated = await lensContentService.updateContent(req.params.id, {
      isPinned: !existing.isPinned,
    });
    const populated = await populateAuthor(updated);
    emitLensContentUpdated(populated || updated, "pin");
    res.json({ success: true, data: populated || updated });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const toggleLensContentActive = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminUser(req)) {
      res.status(403).json({ message: "Solo admin" });
      return;
    }
    const existing = await lensContentService.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: "Contenido no encontrado" });
      return;
    }
    const updated = await lensContentService.updateContent(req.params.id, {
      isActive: !existing.isActive,
    });
    const populated = await populateAuthor(updated);
    emitLensContentUpdated(populated || updated, "active");
    res.json({ success: true, data: populated || updated });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};
