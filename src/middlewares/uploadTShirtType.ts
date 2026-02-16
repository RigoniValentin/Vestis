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

// Tamaño máximo por archivo (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Configuración de almacenamiento temporal con multer (memory storage para procesar con sharp)
const storage = multer.memoryStorage();

// Filtro de archivos para validar tipo
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  console.log(
    `🔍 Validando archivo TShirtType: ${file.originalname}, tipo: ${file.mimetype}`
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

// Configuración de multer para un solo archivo
export const uploadTShirtTypeImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Solo una imagen por tipo
  },
}).single("sampleImage");

// Middleware para comprimir y guardar la imagen con sharp
export const compressAndSaveTShirtTypeImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Si no hay archivo, continuar sin procesar
    if (!req.file) {
      next();
      return;
    }

    console.log(`🖼️  Iniciando compresión de imagen para TShirtType...`);

    // Crear directorio si no existe
    const uploadDir = path.join(process.cwd(), "uploads", "tshirt-types");
    await fs.mkdir(uploadDir, { recursive: true });

    // Generar nombre único para el archivo
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileName = `tshirt-type-${uniqueSuffix}.webp`; // Guardamos en formato webp para mejor compresión

    const filePath = path.join(uploadDir, fileName);

    // Comprimir la imagen con sharp
    await sharp(req.file.buffer)
      .resize(800, 1000, {
        // Tamaño optimizado para muestras de remeras
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 85, // Buena calidad con compresión
        effort: 4, // Balance entre velocidad y compresión
      })
      .toFile(filePath);

    // Obtener estadísticas del archivo
    const stats = await fs.stat(filePath);
    const originalSize = req.file.size;
    const compressedSize = stats.size;
    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    console.log(`✅ Imagen comprimida exitosamente:`);
    console.log(`   - Tamaño original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(
      `   - Tamaño comprimido: ${(compressedSize / 1024).toFixed(2)} KB`
    );
    console.log(`   - Reducción: ${reduction}%`);
    console.log(`   - Guardada en: ${filePath}`);

    // Guardar la ruta relativa en el request para usarla en el controlador
    req.body.sampleImagePath = `/uploads/tshirt-types/${fileName}`;

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

// Función para eliminar imagen de TShirtType
export const deleteTShirtTypeImage = async (
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
    console.log(`🗑️  Imagen de TShirtType eliminada: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error eliminando imagen ${imagePath}:`, error);
    return false;
  }
};

// Middleware de manejo de errores
export const handleTShirtTypeUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("❌ Error en upload de imagen TShirtType:", error);

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
          message: 'Campo de archivo inesperado. Use "sampleImage"',
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
  uploadTShirtTypeImage,
  compressAndSaveTShirtTypeImage,
  deleteTShirtTypeImage,
  handleTShirtTypeUploadError,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
};
