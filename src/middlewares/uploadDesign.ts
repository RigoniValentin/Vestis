import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { Request, Response, NextFunction } from "express";

// Tipos permitidos de imágenes
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Tamaño máximo por archivo (10MB para diseños de alta calidad)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configuración de almacenamiento temporal con multer (memory storage para procesar con sharp)
const storage = multer.memoryStorage();

// Filtro de archivos para validar tipo
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  console.log(
    `🔍 Validando archivo Design: ${file.originalname}, tipo: ${file.mimetype}`
  );

  // Validar tipo de archivo
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(
      `Tipo de archivo no permitido: ${
        file.mimetype
      }. Solo se permiten: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
    console.error(`❌ ${error.message}`);
    return cb(error);
  }

  console.log(`✅ Archivo validado correctamente: ${file.originalname}`);
  cb(null, true);
};

// Configuración de multer para dos archivos (claro y oscuro)
export const uploadDesignImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 2, // Hasta 2 imágenes por diseño (claro + oscuro)
  },
}).fields([
  { name: "designImage", maxCount: 1 },
  { name: "designImageDark", maxCount: 1 },
]);

// Middleware para comprimir y guardar las imágenes con sharp
export const compressAndSaveDesignImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const lightFile = files?.["designImage"]?.[0];
    const darkFile = files?.["designImageDark"]?.[0];

    // Si no hay archivos, continuar sin procesar
    if (!lightFile && !darkFile) {
      next();
      return;
    }

    // Crear directorio si no existe
    const uploadDir = path.join(process.cwd(), "uploads", "designs");
    await fs.mkdir(uploadDir, { recursive: true });

    const processFile = async (file: Express.Multer.File, suffix: string): Promise<string> => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const fileName = `design-${suffix}-${uniqueSuffix}.webp`;
      const filePath = path.join(uploadDir, fileName);

      await sharp(file.buffer)
        .resize(1200, 1200, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 90,
          effort: 4,
        })
        .toFile(filePath);

      const stats = await fs.stat(filePath);
      const originalSize = file.size;
      const compressedSize = stats.size;
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(2);

      console.log(`✅ Imagen ${suffix} comprimida:`);
      console.log(`   - Original: ${(originalSize / 1024).toFixed(2)} KB`);
      console.log(`   - Comprimida: ${(compressedSize / 1024).toFixed(2)} KB`);
      console.log(`   - Reducción: ${reduction}%`);

      return `/uploads/designs/${fileName}`;
    };

    if (lightFile) {
      console.log(`🖼️  Procesando imagen de diseño (fondo claro)...`);
      req.body.imageUrl = await processFile(lightFile, "light");
    }

    if (darkFile) {
      console.log(`🖼️  Procesando imagen de diseño (fondo oscuro)...`);
      req.body.imageUrlDark = await processFile(darkFile, "dark");
    }

    next();
  } catch (error: any) {
    console.error(`❌ Error comprimiendo imagen:`, error);
    res.status(500).json({
      success: false,
      message: "Error al procesar la imagen",
      error: error.message,
    });
  }
};

// Función para eliminar imagen de Design
export const deleteDesignImage = async (
  imagePath: string
): Promise<boolean> => {
  try {
    if (!imagePath) return false;

    // Si es una URL completa, extraer solo la ruta del archivo
    let filePath = imagePath;
    if (imagePath.startsWith("/uploads/")) {
      filePath = path.join(process.cwd(), imagePath);
    } else if (imagePath.startsWith("http")) {
      // No eliminar URLs externas
      console.log(`⚠️  URL externa detectada, no se eliminará: ${imagePath}`);
      return false;
    }

    await fs.unlink(filePath);
    console.log(`🗑️  Imagen de Design eliminada: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error eliminando imagen ${imagePath}:`, error);
    return false;
  }
};

// Middleware de manejo de errores
export const handleDesignUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("❌ Error en upload de imagen Design:", error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        res.status(400).json({
          success: false,
          message: `Archivo demasiado grande. Tamaño máximo: ${
            MAX_FILE_SIZE / (1024 * 1024)
          }MB`,
        });
        return;
      case "LIMIT_UNEXPECTED_FILE":
        res.status(400).json({
          success: false,
          message: 'Campo de archivo inesperado. Use "designImage" o "designImageDark"',
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: "Error en la subida del archivo",
        });
        return;
    }
  }

  res.status(400).json({
    success: false,
    message: error.message || "Error en la validación del archivo",
  });
};

export default {
  uploadDesignImage,
  compressAndSaveDesignImage,
  deleteDesignImage,
  handleDesignUploadError,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
};
