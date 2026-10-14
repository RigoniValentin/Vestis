import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { Request } from "express";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;

// Adjuntos del lente: imágenes + PDF
const ATTACHMENT_ALLOWED_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES,
  "application/pdf",
];
const ATTACHMENT_ALLOWED_EXTENSIONS = [...ALLOWED_EXTENSIONS, ".pdf"];
const ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_FILES = 6;

const buildStorage = (subdir: string, prefix: string) =>
  multer.diskStorage({
    destination: async (
      _req: Request,
      _file: Express.Multer.File,
      cb: (error: Error | null, destination: string) => void
    ) => {
      const uploadDir = path.join(process.cwd(), "uploads", subdir);
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, "");
      }
    },
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void
    ) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${prefix}-${unique}${ext}`);
    },
  });

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Tipo de archivo no permitido. Solo imágenes."));
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Extensión no permitida: ${ext}`));
  }
  cb(null, true);
};

export const uploadAvatar = multer({
  storage: buildStorage("avatars", "avatar"),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
}).single("avatar");

export const uploadCommunityImage = multer({
  storage: buildStorage("community", "post"),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
}).single("image");

export const uploadMarketImage = multer({
  storage: buildStorage("market", "market"),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
}).single("image");

export const uploadLensContentImage = multer({
  storage: buildStorage("lens-content", "lens"),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
}).single("image");

const attachmentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `Tipo de archivo no permitido (${file.mimetype}). Permitidos: imágenes y PDF.`
      )
    );
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Extensión no permitida: ${ext}`));
  }
  cb(null, true);
};

/**
 * Maneja en una sola request la imagen de portada (campo "image")
 * y los adjuntos opcionales (campo "attachments", hasta
 * MAX_ATTACHMENT_FILES archivos PDF o imagen).
 */
export const uploadLensContentFiles = multer({
  storage: buildStorage("lens-content", "lens"),
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "image") return fileFilter(_req, file, cb);
    if (file.fieldname === "attachments") {
      return attachmentFileFilter(_req, file, cb);
    }
    return cb(new Error(`Campo de archivo no soportado: ${file.fieldname}`));
  },
  limits: {
    fileSize: Math.max(MAX_FILE_SIZE, ATTACHMENT_MAX_FILE_SIZE),
    files: 1 + MAX_ATTACHMENT_FILES,
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "attachments", maxCount: MAX_ATTACHMENT_FILES },
]);

export const buildAvatarUrl = (filename: string) =>
  `/uploads/avatars/${filename}`;
export const buildCommunityImageUrl = (filename: string) =>
  `/uploads/community/${filename}`;
export const buildMarketImageUrl = (filename: string) =>
  `/uploads/market/${filename}`;
export const buildLensContentImageUrl = (filename: string) =>
  `/uploads/lens-content/${filename}`;
