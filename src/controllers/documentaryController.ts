import { Request, Response } from "express";
import multer from "multer";
import { DocumentaryModel, IDocumentary } from "@models/Documentary";
import {
  DocumentaryPurchaseModel,
  IDocumentaryPurchase,
} from "@models/DocumentaryPurchase";
import { UserModel } from "@models/Users";
import { compressAndSave } from "@middlewares/uploadWithCompression";

export const DEFAULT_SLUG = "humano-existes";

export const normalizeSlug = (value: unknown, fallback: string): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return fallback;
  const slug = raw.trim().toLowerCase();
  return slug || fallback;
};

/**
 * Determina si el usuario actual es admin/superadmin
 */
export const isAdminUser = (req: Request): boolean => {
  const user: any = req.currentUser;
  if (!user || !user.roles) return false;
  return user.roles.some((r: any) =>
    ["admin", "superadmin"].includes(r?.name)
  );
};

/**
 * Verifica que el usuario actual ha pagado el documental.
 * También devuelve true si el usuario tiene una suscripción activa,
 * ya que el abono incluye el acceso al documental.
 */
export const userOwnsDocumentary = async (
  userId: string,
  slug: string
): Promise<boolean> => {
  const purchase = await DocumentaryPurchaseModel.findOne({
    userId,
    documentarySlug: slug,
    status: "approved",
  }).lean();
  if (purchase) return true;

  const user = await UserModel.findById(userId).lean();
  if (
    user?.subscription?.expirationDate &&
    new Date(user.subscription.expirationDate) > new Date()
  ) {
    return true;
  }

  return false;
};

/**
 * Serializa el documental para respuesta pública (oculta el youtubeVideoId).
 */
const serializePublic = (doc: IDocumentary) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { youtubeVideoId, ...rest } = obj as any;
  return rest;
};

/**
 * GET /documentaries/:slug?
 * Devuelve datos públicos del documental (sin el videoId).
 */
export const getDocumentaryPublic = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = normalizeSlug(req.params.slug, DEFAULT_SLUG);
    const doc = await DocumentaryModel.findOne({ slug });
    if (!doc) {
      res.status(404).json({ success: false, message: "Documental no encontrado" });
      return;
    }
    res.json({ success: true, data: serializePublic(doc) });
  } catch (error) {
    console.error("getDocumentaryPublic error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /documentaries/:slug/playback
 * Solo accesible si el usuario ha pagado o es admin (o freeAccess está activo).
 * Devuelve el youtubeVideoId para que el reproductor pueda inicializarse.
 */
export const getDocumentaryPlayback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = normalizeSlug(req.params.slug, DEFAULT_SLUG);
    const doc = await DocumentaryModel.findOne({ slug });
    if (!doc) {
      res.status(404).json({ success: false, message: "Documental no encontrado" });
      return;
    }
    if (!doc.isPublished && !isAdminUser(req)) {
      res.status(403).json({ success: false, message: "Documental no disponible" });
      return;
    }

    const isAdmin = isAdminUser(req);
    const userId = (req as any).currentUser?.id;
    const owns = doc.freeAccess || isAdmin || (await userOwnsDocumentary(userId, slug));

    if (!owns) {
      res.status(403).json({
        success: false,
        message: "Acceso no permitido. Debes adquirir el documental.",
      });
      return;
    }

    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      data: {
        slug: doc.slug,
        title: doc.title,
        youtubeVideoId: doc.youtubeVideoId,
        durationSeconds: doc.durationSeconds,
      },
    });
  } catch (error) {
    console.error("getDocumentaryPlayback error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /documentaries/:slug/ownership
 * Devuelve si el usuario tiene acceso (sin exponer el videoId).
 */
export const getOwnership = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = normalizeSlug(req.params.slug, DEFAULT_SLUG);
    const doc = await DocumentaryModel.findOne({ slug }).lean();
    if (!doc) {
      res.status(404).json({ success: false, message: "Documental no encontrado" });
      return;
    }
    const userId = (req as any).currentUser?.id;
    const isAdmin = isAdminUser(req);
    const owns = doc.freeAccess || isAdmin || (await userOwnsDocumentary(userId, slug));
    res.json({ success: true, data: { owns, isAdmin } });
  } catch (error) {
    console.error("getOwnership error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * PUT /documentaries/:slug?
 * Crea o actualiza el documental (solo admin).
 */
export const upsertDocumentary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = normalizeSlug(req.params.slug ?? req.body.slug, DEFAULT_SLUG);
    const allowedFields = [
      "title",
      "subtitle",
      "synopsis",
      "youtubeVideoId",
      "trailerYoutubeId",
      "posterUrl",
      "backdropUrl",
      "backdropDesktopUrl",
      "backdropMobileUrl",
      "priceUsd",
      "priceArs",
      "currency",
      "durationSeconds",
      "releaseYear",
      "director",
      "cast",
      "genres",
      "isPublished",
      "paypalEnabled",
      "mpEnabled",
      "freeAccess",
    ];
    const update: any = {};
    for (const k of allowedFields) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    // Sanitiza youtubeVideoId si vino como URL completa
    if (typeof update.youtubeVideoId === "string") {
      update.youtubeVideoId = extractYoutubeId(update.youtubeVideoId);
    }
    if (typeof update.trailerYoutubeId === "string") {
      update.trailerYoutubeId = extractYoutubeId(update.trailerYoutubeId);
    }
    if (
      update.backdropDesktopUrl === undefined &&
      typeof update.backdropUrl === "string"
    ) {
      update.backdropDesktopUrl = update.backdropUrl;
    }
    if (typeof update.backdropDesktopUrl === "string") {
      update.backdropUrl = update.backdropDesktopUrl;
    }

    const doc = await DocumentaryModel.findOneAndUpdate(
      { slug },
      { $set: { ...update, slug } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("upsertDocumentary error:", error);
    res.status(500).json({ success: false, message: "Error al guardar" });
  }
};

/**
 * GET /documentaries
 * Lista de documentales (admin).
 */
export const listDocumentaries = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const docs = await DocumentaryModel.find().sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /documentaries/:slug/purchases
 * Lista de compras de un documental (admin).
 */
export const listPurchases = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = normalizeSlug(req.params.slug, DEFAULT_SLUG);
    const purchases = await DocumentaryPurchaseModel.find({
      documentarySlug: slug,
    })
      .populate("userId", "name email username")
      .sort({ createdAt: -1 })
      .limit(500);
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * POST /documentaries/:slug/grant
 * Otorga acceso manual a un usuario (admin).
 * body: { userId }
 */
export const grantAccess = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = normalizeSlug(req.params.slug, DEFAULT_SLUG);
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, message: "userId requerido" });
      return;
    }
    const doc = await DocumentaryModel.findOne({ slug });
    if (!doc) {
      res.status(404).json({ success: false, message: "Documental no encontrado" });
      return;
    }
    const purchase: Partial<IDocumentaryPurchase> = {
      userId: userId as any,
      documentarySlug: slug,
      method: "admin",
      amount: 0,
      currency: doc.currency || "ARS",
      status: "approved",
      paidAt: new Date(),
    };
    const created = await DocumentaryPurchaseModel.create(purchase);
    res.json({ success: true, data: created });
  } catch (error) {
    console.error("grantAccess error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * DELETE /documentaries/:slug/purchases/:id
 * Revoca acceso (admin).
 */
export const revokeAccess = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    await DocumentaryPurchaseModel.findByIdAndUpdate(id, {
      status: "refunded",
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * Extrae el ID de un video de YouTube desde una URL o devuelve el string si ya es ID.
 */
export const extractYoutubeId = (input: string): string => {
  if (!input) return input;
  const trimmed = input.trim();
  // Si parece un ID (11 chars, sin protocolo)
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    // Soporta watch?v=, youtu.be/, /embed/, /shorts/
    const watchMatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    const embedMatch = trimmed.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    const shortsMatch = trimmed.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  } catch {}
  return trimmed;
};

// ─── Multer para subida de imágenes del documental ─────────────────────────

const multerMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error(`Tipo no permitido: ${file.mimetype}. Usar jpg, png o webp`));
    }
    cb(null, true);
  },
});

/**
 * POST /documentaries/:slug/images
 * Sube poster y/o banners. Campos multipart:
 * `poster`, `backdrop` (legacy), `backdropDesktop`, `backdropMobile`.
 * Solo admin. Devuelve las URLs guardadas y actualiza el documento.
 */
export const uploadDocumentaryImages = [
  multerMemory.fields([
    { name: "poster", maxCount: 1 },
    { name: "backdrop", maxCount: 1 },
    { name: "backdropDesktop", maxCount: 1 },
    { name: "backdropMobile", maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const slug = normalizeSlug(req.params.slug, "humano-existes");
      const files = req.files as Record<string, Express.Multer.File[]>;

      const update: {
        posterUrl?: string;
        backdropUrl?: string;
        backdropDesktopUrl?: string;
        backdropMobileUrl?: string;
      } = {};

      if (files?.poster?.[0]) {
        update.posterUrl = await compressAndSave(
          files.poster[0].buffer,
          files.poster[0].originalname,
          "documentaries"
        );
      }
      const desktopBackdropFile = files?.backdropDesktop?.[0] || files?.backdrop?.[0];
      if (desktopBackdropFile) {
        update.backdropDesktopUrl = await compressAndSave(
          desktopBackdropFile.buffer,
          desktopBackdropFile.originalname,
          "documentaries"
        );
        update.backdropUrl = update.backdropDesktopUrl;
      }
      if (files?.backdropMobile?.[0]) {
        update.backdropMobileUrl = await compressAndSave(
          files.backdropMobile[0].buffer,
          files.backdropMobile[0].originalname,
          "documentaries"
        );
      }

      if (
        !update.posterUrl &&
        !update.backdropUrl &&
        !update.backdropDesktopUrl &&
        !update.backdropMobileUrl
      ) {
        res.status(400).json({ success: false, message: "No se recibió ninguna imagen" });
        return;
      }

      const doc = await DocumentaryModel.findOneAndUpdate(
        { slug },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      res.json({ success: true, data: update });
    } catch (err: any) {
      console.error("uploadDocumentaryImages error:", err);
      res.status(500).json({ success: false, message: err.message || "Error al subir imagen" });
    }
  },
];
