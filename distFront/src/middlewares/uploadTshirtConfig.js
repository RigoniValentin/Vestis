"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleConfigUploadError = exports.deleteConfigImage = exports.compressAndSaveConfigImage = exports.uploadTshirtConfigImage = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
// Directorio donde se guardarán las imágenes de configuraciones
const uploadDir = path_1.default.join(__dirname, "../../uploads/tshirt-configs");
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
// Middleware de Multer
exports.uploadTshirtConfigImage = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
}).single("configImage");
/**
 * Middleware para comprimir y guardar la imagen de configuración
 */
const compressAndSaveConfigImage = async (req, res, next) => {
    try {
        if (!req.file) {
            next();
            return;
        }
        const fileName = `config-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
        const outputPath = path_1.default.join(uploadDir, fileName);
        // Comprimir y convertir a WebP con Sharp
        await (0, sharp_1.default)(req.file.buffer)
            .resize(1200, 1200, {
            fit: "inside",
            withoutEnlargement: true,
        })
            .webp({ quality: 90 })
            .toFile(outputPath);
        // Guardar la URL relativa en req.body
        req.body.productImage = `/uploads/tshirt-configs/${fileName}`;
        next();
    }
    catch (error) {
        console.error("Error al procesar imagen de configuración:", error);
        res.status(500).json({
            success: false,
            message: "Error al procesar la imagen",
            error: error.message,
        });
    }
};
exports.compressAndSaveConfigImage = compressAndSaveConfigImage;
/**
 * Eliminar una imagen de configuración del filesystem
 */
const deleteConfigImage = (imageUrl) => {
    if (!imageUrl || imageUrl.startsWith("http"))
        return;
    const fileName = path_1.default.basename(imageUrl);
    const filePath = path_1.default.join(uploadDir, fileName);
    if (fs_1.default.existsSync(filePath)) {
        try {
            fs_1.default.unlinkSync(filePath);
            console.log(`Imagen eliminada: ${filePath}`);
        }
        catch (error) {
            console.error(`Error al eliminar imagen: ${filePath}`, error);
        }
    }
};
exports.deleteConfigImage = deleteConfigImage;
/**
 * Middleware para manejar errores de Multer
 */
const handleConfigUploadError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
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
exports.handleConfigUploadError = handleConfigUploadError;
