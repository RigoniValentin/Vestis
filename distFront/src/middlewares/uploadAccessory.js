"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAccessoryUploadError = exports.deleteAccessoryImages = exports.deleteAccessoryImage = exports.compressAndSaveAccessoryImages = exports.uploadAccessoryImages = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
// Directorio donde se guardarán las imágenes de accesorios
const uploadDir = path_1.default.join(__dirname, "../../uploads/accessories");
// Crear directorio si no existe
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Configuración de Multer para almacenar en memoria
const storage = multer_1.default.memoryStorage();
// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    }
    else {
        cb(new Error("Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)"));
    }
};
// Middleware de Multer para múltiples imágenes (máximo 4)
exports.uploadAccessoryImages = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB por archivo
    },
}).array("images", 4);
/**
 * Middleware para comprimir y guardar las imágenes de accesorios
 */
const compressAndSaveAccessoryImages = async (req, res, next) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return next();
        }
        const savedImages = [];
        for (const file of files) {
            const fileName = `acc-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
            const outputPath = path_1.default.join(uploadDir, fileName);
            // Comprimir y convertir a WebP con Sharp
            await (0, sharp_1.default)(file.buffer)
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
    }
    catch (error) {
        console.error("Error al procesar imágenes de accesorio:", error);
        res.status(500).json({
            success: false,
            message: "Error al procesar las imágenes",
            error: error.message,
        });
    }
};
exports.compressAndSaveAccessoryImages = compressAndSaveAccessoryImages;
/**
 * Eliminar una imagen de accesorio del filesystem
 */
const deleteAccessoryImage = (imagePath) => {
    try {
        if (!imagePath)
            return false;
        // Extraer solo el nombre del archivo de la URL
        const fileName = imagePath.split("/").pop();
        if (!fileName)
            return false;
        const fullPath = path_1.default.join(uploadDir, fileName);
        if (fs_1.default.existsSync(fullPath)) {
            fs_1.default.unlinkSync(fullPath);
            console.log(`Imagen eliminada: ${fullPath}`);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error("Error al eliminar imagen:", error);
        return false;
    }
};
exports.deleteAccessoryImage = deleteAccessoryImage;
/**
 * Eliminar múltiples imágenes de accesorio
 */
const deleteAccessoryImages = (imagePaths) => {
    for (const imagePath of imagePaths) {
        (0, exports.deleteAccessoryImage)(imagePath);
    }
};
exports.deleteAccessoryImages = deleteAccessoryImages;
/**
 * Middleware para manejar errores de upload
 */
const handleAccessoryUploadError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
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
exports.handleAccessoryUploadError = handleAccessoryUploadError;
