import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { Request, Response, NextFunction } from "express";

// Directorio donde se guardarán las imágenes de configuraciones
const uploadDir = path.join(__dirname, "../../uploads/tshirt-configs");

// Crear directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer para almacenar en memoria
const storage = multer.memoryStorage();

// Filtro para aceptar solo imágenes
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)"));
  }
};

// Middleware de Multer
export const uploadTshirtConfigImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single("configImage");

/**
 * Middleware para comprimir y guardar la imagen de configuración
 */
export const compressAndSaveConfigImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      next();
      return;
    }

    const fileName = `config-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outputPath = path.join(uploadDir, fileName);

    // Comprimir y convertir a WebP con Sharp
    await sharp(req.file.buffer)
      .resize(1200, 1200, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toFile(outputPath);

    // Guardar la URL relativa en req.body
    req.body.productImage = `/uploads/tshirt-configs/${fileName}`;

    next();
  } catch (error: any) {
    console.error("Error al procesar imagen de configuración:", error);
    res.status(500).json({
      success: false,
      message: "Error al procesar la imagen",
      error: error.message,
    });
  }
};

/**
 * Eliminar una imagen de configuración del filesystem
 */
export const deleteConfigImage = (imageUrl: string): void => {
  if (!imageUrl || imageUrl.startsWith("http")) return;

  const fileName = path.basename(imageUrl);
  const filePath = path.join(uploadDir, fileName);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Imagen eliminada: ${filePath}`);
    } catch (error) {
      console.error(`Error al eliminar imagen: ${filePath}`, error);
    }
  }
};

/**
 * Middleware para manejar errores de Multer
 */
export const handleConfigUploadError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        message: "El archivo es demasiado grande. Máximo 10MB.",
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: `Error al subir archivo: ${err.message}`,
    });
    return;
  }

  if (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Error al procesar la imagen",
    });
    return;
  }

  next();
};
