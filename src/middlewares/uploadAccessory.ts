import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import express, { Request, Response, NextFunction } from "express";

// Directorio donde se guardarán las imágenes de accesorios
const uploadDir = path.join(__dirname, "../../uploads/accessories");

// Crear directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer para almacenar en memoria
const storage = multer.memoryStorage();

// Filtro para aceptar solo imágenes
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)"));
  }
};

// Middleware de Multer para múltiples imágenes (máximo 4)
export const uploadAccessoryImages = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por archivo
  },
}).array("images", 4);

/**
 * Middleware para comprimir y guardar las imágenes de accesorios
 */
export const compressAndSaveAccessoryImages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return next();
    }

    const savedImages: string[] = [];

    for (const file of files) {
      const fileName = `acc-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      const outputPath = path.join(uploadDir, fileName);

      // Comprimir y convertir a WebP con Sharp
      await sharp(file.buffer)
        .resize(1200, 1200, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 90 })
        .toFile(outputPath);

      savedImages.push(`/uploads/accessories/${fileName}`);
    }

    // Guardar URLs en req.body
    req.body.uploadedImages = savedImages;

    next();
  } catch (error: any) {
    console.error("Error al procesar imágenes de accesorio:", error);
    res.status(500).json({
      success: false,
      message: "Error al procesar las imágenes",
      error: error.message,
    });
  }
};

/**
 * Eliminar una imagen de accesorio del filesystem
 */
export const deleteAccessoryImage = (imagePath: string): boolean => {
  try {
    if (!imagePath) return false;

    // Extraer solo el nombre del archivo de la URL
    const fileName = imagePath.split("/").pop();
    if (!fileName) return false;

    const fullPath = path.join(uploadDir, fileName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`Imagen eliminada: ${fullPath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    return false;
  }
};

/**
 * Eliminar múltiples imágenes de accesorio
 */
export const deleteAccessoryImages = (imagePaths: string[]): void => {
  for (const imagePath of imagePaths) {
    deleteAccessoryImage(imagePath);
  }
};

/**
 * Middleware para manejar errores de upload
 */
export const handleAccessoryUploadError: express.ErrorRequestHandler = (
  err,
  req,
  res,
  next
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        message: "El archivo es demasiado grande. Máximo 10MB.",
      });
      return;
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        success: false,
        message: "Máximo 4 imágenes permitidas.",
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Error al subir imágenes",
    });
    return;
  }

  next();
};
