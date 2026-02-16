import multer from "multer";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { Request, Response, NextFunction } from "express";

// Tipos permitidos
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB antes de compresión

// Usar memoryStorage para procesar con sharp antes de guardar
const memoryStorage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(
      `Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten: jpg, png, webp`
    );
    return cb(error);
  }
  cb(null, true);
};

// Multer configurado con memoryStorage (los archivos quedan en buffer)
const multerUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 3, // máximo 3 imágenes
  },
});

/**
 * Comprime una imagen usando sharp y la guarda en disco como WebP.
 * Retorna la ruta relativa del archivo guardado.
 */
async function compressAndSave(
  buffer: Buffer,
  originalName: string,
  subfolder: string = "tshirt-types"
): Promise<string> {
  const uploadDir = path.join(process.cwd(), "uploads", subfolder);
  await fs.mkdir(uploadDir, { recursive: true });

  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const baseName = path.basename(originalName, path.extname(originalName));
  const fileName = `${baseName}-${uniqueSuffix}.webp`;
  const filePath = path.join(uploadDir, fileName);

  // Obtener info de la imagen original
  const metadata = await sharp(buffer).metadata();
  const originalSize = buffer.length;

  // Comprimir: redimensionar si es muy grande + convertir a WebP
  let sharpInstance = sharp(buffer);

  // Redimensionar si el ancho supera 1200px (mantiene proporción)
  if (metadata.width && metadata.width > 1200) {
    sharpInstance = sharpInstance.resize(1200, null, {
      withoutEnlargement: true,
      fit: "inside",
    });
  }

  // Convertir a WebP con calidad 80 (buen balance calidad/tamaño)
  const compressedBuffer = await sharpInstance
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  await fs.writeFile(filePath, compressedBuffer);

  const compressedSize = compressedBuffer.length;
  const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  console.log(
    `📸 Imagen comprimida: ${originalName} (${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB, -${savings}%)`
  );

  return `/uploads/${subfolder}/${fileName}`;
}

/**
 * Middleware para subir una sola imagen con compresión.
 * El campo debe llamarse "image".
 * Guarda la ruta comprimida en req.body.compressedImagePath
 */
export const uploadSingleCompressed = (fieldName: string = "image") => {
  const multerMiddleware = multerUpload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      try {
        if (!req.file) {
          return next();
        }

        const subfolder = req.body.subfolder || "tshirt-types";
        const compressedPath = await compressAndSave(
          req.file.buffer,
          req.file.originalname,
          subfolder
        );

        req.body.compressedImagePath = compressedPath;
        next();
      } catch (error: any) {
        console.error("❌ Error comprimiendo imagen:", error);
        return res.status(500).json({
          success: false,
          message: "Error al procesar la imagen",
          error: error.message,
        });
      }
    });
  };
};

/**
 * Middleware para subir múltiples imágenes con compresión.
 * Los campos deben llamarse "images".
 * Guarda un array de rutas en req.body.compressedImagePaths
 */
export const uploadMultipleCompressed = (
  fieldName: string = "images",
  maxCount: number = 3
) => {
  const multerMiddleware = multerUpload.array(fieldName, maxCount);

  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return next();
        }

        const subfolder = req.body.subfolder || "tshirt-types";
        const paths: string[] = [];

        for (const file of files) {
          const compressedPath = await compressAndSave(
            file.buffer,
            file.originalname,
            subfolder
          );
          paths.push(compressedPath);
        }

        req.body.compressedImagePaths = paths;
        next();
      } catch (error: any) {
        console.error("❌ Error comprimiendo imágenes:", error);
        return res.status(500).json({
          success: false,
          message: "Error al procesar las imágenes",
          error: error.message,
        });
      }
    });
  };
};

/**
 * Middleware para subir la imagen representativa de un TShirtType.
 * Campo: modelImage
 */
export const uploadTShirtTypeImages = () => {
  const multerMiddleware = multerUpload.single("modelImage");

  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      try {
        if (!req.file) {
          return next();
        }

        const compressedPath = await compressAndSave(
          req.file.buffer,
          req.file.originalname,
          "tshirt-types"
        );
        req.body.modelImage = compressedPath;

        next();
      } catch (error: any) {
        console.error("❌ Error comprimiendo imagen de TShirtType:", error);
        return res.status(500).json({
          success: false,
          message: "Error al procesar la imagen",
          error: error.message,
        });
      }
    });
  };
};

/**
 * Middleware para subir imagen de producto (TshirtConfig).
 * Campo: "productImage"
 */
export const uploadProductImageCompressed = () => {
  const multerMiddleware = multerUpload.single("productImage");

  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      try {
        if (!req.file) {
          return next();
        }

        const compressedPath = await compressAndSave(
          req.file.buffer,
          req.file.originalname,
          "products"
        );

        req.body.productImage = compressedPath;
        next();
      } catch (error: any) {
        console.error("❌ Error comprimiendo imagen de producto:", error);
        return res.status(500).json({
          success: false,
          message: "Error al procesar la imagen del producto",
          error: error.message,
        });
      }
    });
  };
};

/**
 * Elimina un archivo de imagen del servidor
 */
export const deleteCompressedImage = async (
  imagePath: string
): Promise<boolean> => {
  try {
    if (!imagePath || imagePath.startsWith("http")) return false;

    const fullPath = imagePath.startsWith("/uploads/")
      ? path.join(process.cwd(), imagePath)
      : imagePath;

    await fs.unlink(fullPath);
    console.log(`🗑️  Imagen eliminada: ${fullPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error eliminando imagen ${imagePath}:`, error);
    return false;
  }
};

export default {
  uploadSingleCompressed,
  uploadMultipleCompressed,
  uploadTShirtTypeImages,
  uploadProductImageCompressed,
  deleteCompressedImage,
  compressAndSave,
};
