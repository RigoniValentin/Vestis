import { Request, Response } from "express";
import multer from "multer";
import { DocumentaryModel, IDocumentary } from "@models/Documentary";
import {
  DocumentaryPurchaseModel,
  IDocumentaryPurchase,
} from "@models/DocumentaryPurchase";
import {
  DocumentaryPlayCounterModel,
  IDocumentaryPlayCounter,
} from "@models/DocumentaryPlayCounter";
import { UserModel } from "@models/Users";
import { compressAndSave } from "@middlewares/uploadWithCompression";

export const DEFAULT_SLUG = "humano-existes";

/**
 * Límite de reproducciones concedidas cada vez que el usuario obtiene
 * acceso al documental (compra aprobada, suscripción renovada o admin grant).
 */
export const PLAY_LIMIT_PER_GRANT = 4;

export interface DocumentaryPlayState {
  playsUsed: number;
  playsRemaining: number;
  playLimit: number;
}

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
 *
 * Esta función NO contempla el límite de reproducciones:
 * un usuario puede tener derecho de acceso pero haber agotado sus plays.
 * Para el chequeo completo usar `userCanPlayDocumentary`.
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
 * Lee (o calcula en memoria) el estado del contador de reproducciones
 * para un (userId, slug). No crea registros: devuelve playsUsed = 0 si
 * el contador aún no existe.
 */
export const getDocumentaryPlayState = async (
  userId: string,
  slug: string
): Promise<DocumentaryPlayState> => {
  const counter = await DocumentaryPlayCounterModel.findOne({
    userId,
    documentarySlug: slug,
  }).lean();
  const playsUsed = counter?.playsUsed ?? 0;
  const playsRemaining = Math.max(0, PLAY_LIMIT_PER_GRANT - playsUsed);
  return {
    playsUsed,
    playsRemaining,
    playLimit: PLAY_LIMIT_PER_GRANT,
  };
};

/**
 * Resetea el contador de reproducciones a 0. Se invoca cada vez que el
 * usuario obtiene un nuevo derecho de acceso (compra aprobada, suscripción
 * renovada o admin grant). Idempotente.
 */
export const resetDocumentaryPlayCounter = async (
  userId: string,
  slug: string
): Promise<void> => {
  await DocumentaryPlayCounterModel.findOneAndUpdate(
    { userId, documentarySlug: slug },
    {
      $set: {
        playsUsed: 0,
        lastResetAt: new Date(),
      },
      $setOnInsert: {
        userId,
        documentarySlug: slug,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export type ConsumeDocumentaryPlayResult =
  | { ok: true; playsRemaining: number; playsUsed: number }
  | { ok: false; reason: "limit"; playsUsed: number; playLimit: number };

/**
 * Consume atómicamente una reproducción del contador.
 * Devuelve { ok: false, reason: "limit" } si el usuario ya agotó las
 * PLAY_LIMIT_PER_GRANT reproducciones desde el último reset.
 *
 * Atomicidad: usa findOneAndUpdate con filtro `playsUsed < limit` para
 * evitar carreras con doble click. Si el documento aún no existe, lo crea
 * con playsUsed = 1 (el primer play cuenta como consumido).
 */
export const consumeDocumentaryPlay = async (
  userId: string,
  slug: string
): Promise<ConsumeDocumentaryPlayResult> => {
  // Intento 1: documento nuevo (primer play del usuario para este slug).
  try {
    const created = await DocumentaryPlayCounterModel.create({
      userId,
      documentarySlug: slug,
      playsUsed: 1,
      lastPlayAt: new Date(),
      lastResetAt: new Date(),
    } as unknown as Partial<IDocumentaryPlayCounter>);
    return {
      ok: true,
      playsRemaining: Math.max(0, PLAY_LIMIT_PER_GRANT - created.playsUsed),
      playsUsed: created.playsUsed,
    };
  } catch (err: any) {
    // Si choca el índice único es porque otro request creó el doc primero.
    if (err?.code !== 11000) throw err;
  }

  // Intento 2: documento existente. Incremento solo si aún hay saldo.
  const updated = await DocumentaryPlayCounterModel.findOneAndUpdate(
    { userId, documentarySlug: slug, playsUsed: { $lt: PLAY_LIMIT_PER_GRANT } },
    {
      $inc: { playsUsed: 1 },
      $set: { lastPlayAt: new Date() },
    },
    { new: true }
  );

  if (!updated) {
    const current = await DocumentaryPlayCounterModel
      .findOne({ userId, documentarySlug: slug })
      .lean();
    return {
      ok: false,
      reason: "limit",
      playsUsed: current?.playsUsed ?? PLAY_LIMIT_PER_GRANT,
      playLimit: PLAY_LIMIT_PER_GRANT,
    };
  }

  return {
    ok: true,
    playsRemaining: Math.max(0, PLAY_LIMIT_PER_GRANT - updated.playsUsed),
    playsUsed: updated.playsUsed,
  };
};

/**
 * Determina si el usuario puede reproducir el documental ahora mismo,
 * considerando derecho de acceso Y saldo de reproducciones.
 * - Admin y freeAccess siempre pueden.
 * - Usuarios con compra aprobada o suscripción activa necesitan plays restantes.
 */
export const userCanPlayDocumentary = async (
  userId: string,
  slug: string,
  isAdmin: boolean,
  freeAccess: boolean
): Promise<{
  owns: boolean;
  canPlay: boolean;
  state: DocumentaryPlayState;
}> => {
  if (isAdmin || freeAccess) {
    return {
      owns: true,
      canPlay: true,
      state: {
        playsUsed: 0,
        playsRemaining: PLAY_LIMIT_PER_GRANT,
        playLimit: PLAY_LIMIT_PER_GRANT,
      },
    };
  }

  const owns = await userOwnsDocumentary(userId, slug);
  if (!owns) {
    return {
      owns: false,
      canPlay: false,
      state: {
        playsUsed: 0,
        playsRemaining: 0,
        playLimit: PLAY_LIMIT_PER_GRANT,
      },
    };
  }

  const state = await getDocumentaryPlayState(userId, slug);
  return {
    owns: true,
    canPlay: state.playsRemaining > 0,
    state,
  };
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
 *
 * Por defecto esta llamada CONSUME una reproducción del contador del usuario
 * (siempre que no sea admin ni freeAccess).
 *
 * Soporta el query param `consume=false` para inicializar el reproductor SIN
 * consumir el crédito. Esto permite que el frontend cargue el player cuando
 * el usuario llega a la sala, y registre la reproducción recién cuando el
 * video efectivamente pasa a PLAYING. Si entre la carga y la reproducción el
 * usuario cierra la pestaña, navega afuera o el video falla en arrancar, no
 * se descuenta ninguna reproducción.
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

    // Default: consume=true (compatibilidad hacia atrás). Con consume=false
    // sólo devolvemos el videoId y el estado actual del contador.
    const consumeRaw = req.query.consume;
    const shouldConsume =
      consumeRaw === undefined
        ? true
        : String(consumeRaw).toLowerCase() !== "false";

    // Admin y freeAccess: sin consumir play.
    let playsRemaining = PLAY_LIMIT_PER_GRANT;
    let playsUsed = 0;
    if (!isAdmin && !doc.freeAccess) {
      if (shouldConsume) {
        const result = await consumeDocumentaryPlay(userId, slug);
        if (!result.ok) {
          res.status(403).json({
            success: false,
            code: "PLAY_LIMIT_REACHED",
            message:
              "Alcanzaste el límite de reproducciones incluidas. " +
              "Adquiere nuevamente el documental para volver a verlo.",
            data: {
              playsUsed: result.playsUsed,
              playLimit: result.playLimit,
              playsRemaining: 0,
            },
          });
          return;
        }
        playsRemaining = result.playsRemaining;
        playsUsed = result.playsUsed;
      } else {
        const state = await getDocumentaryPlayState(userId, slug);
        playsRemaining = state.playsRemaining;
        playsUsed = state.playsUsed;
        // Si no quedan reproducciones, bloqueamos acá también para no
        // devolver un videoId que no podría reproducirse.
        if (playsRemaining <= 0) {
          res.status(403).json({
            success: false,
            code: "PLAY_LIMIT_REACHED",
            message:
              "Alcanzaste el límite de reproducciones incluidas. " +
              "Adquiere nuevamente el documental para volver a verlo.",
            data: {
              playsUsed,
              playLimit: PLAY_LIMIT_PER_GRANT,
              playsRemaining: 0,
            },
          });
          return;
        }
      }
    }

    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      data: {
        slug: doc.slug,
        title: doc.title,
        youtubeVideoId: doc.youtubeVideoId,
        durationSeconds: doc.durationSeconds,
        playsUsed,
        playsRemaining,
        playLimit: PLAY_LIMIT_PER_GRANT,
      },
    });
  } catch (error) {
    console.error("getDocumentaryPlayback error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /documentaries/:slug/ownership
 * Devuelve si el usuario tiene acceso (sin exponer el videoId) junto con
 * el estado del contador de reproducciones.
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
    const { owns, canPlay, state } = await userCanPlayDocumentary(
      userId,
      slug,
      isAdmin,
      !!doc.freeAccess
    );
    res.json({
      success: true,
      data: {
        owns,
        isAdmin,
        canPlay,
        playsUsed: state.playsUsed,
        playsRemaining: state.playsRemaining,
        playLimit: state.playLimit,
      },
    });
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
    // Admin grant: resetea contador de reproducciones para que el usuario
    // empiece con 4 plays disponibles.
    await resetDocumentaryPlayCounter(userId, slug);
    res.json({ success: true, data: created });
  } catch (error) {
    console.error("grantAccess error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * DELETE /documentaries/:slug/purchases/:id
 * Revoca acceso (admin).
 * Al revocar también reseteamos el contador para que, si el admin vuelve a
 * habilitar el acceso más tarde, el contador no tenga plays fantasma
 * consumidos.
 */
export const revokeAccess = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const purchase = await DocumentaryPurchaseModel.findByIdAndUpdate(id, {
      status: "refunded",
    });
    if (purchase) {
      await resetDocumentaryPlayCounter(
        String(purchase.userId),
        purchase.documentarySlug
      );
    }
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
