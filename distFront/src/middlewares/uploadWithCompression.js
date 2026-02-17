"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCompressedImage = exports.uploadProductImageCompressed = exports.uploadTShirtTypeImages = exports.uploadMultipleCompressed = exports.uploadSingleCompressed = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const sharp_1 = __importDefault(require("sharp"));
// Tipos permitidos
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB antes de compresión
// Usar memoryStorage para procesar con sharp antes de guardar
const memoryStorage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        const error = new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten: jpg, png, webp`);
        return cb(error);
    }
    cb(null, true);
};
// Multer configurado con memoryStorage (los archivos quedan en buffer)
const multerUpload = (0, multer_1.default)({
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
async function compressAndSave(buffer, originalName, subfolder = "tshirt-types") {
    const uploadDir = path_1.default.join(process.cwd(), "uploads", subfolder);
    await promises_1.default.mkdir(uploadDir, { recursive: true });
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const baseName = path_1.default.basename(originalName, path_1.default.extname(originalName));
    const fileName = `${baseName}-${uniqueSuffix}.webp`;
    const filePath = path_1.default.join(uploadDir, fileName);
    // Obtener info de la imagen original
    const metadata = await (0, sharp_1.default)(buffer).metadata();
    const originalSize = buffer.length;
    // Comprimir: redimensionar si es muy grande + convertir a WebP
    let sharpInstance = (0, sharp_1.default)(buffer);
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
    await promises_1.default.writeFile(filePath, compressedBuffer);
    const compressedSize = compressedBuffer.length;
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`📸 Imagen comprimida: ${originalName} (${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB, -${savings}%)`);
    return `/uploads/${subfolder}/${fileName}`;
}
/**
 * Middleware para subir una sola imagen con compresión.
 * El campo debe llamarse "image".
 * Guarda la ruta comprimida en req.body.compressedImagePath
 */
const uploadSingleCompressed = (fieldName = "image") => {
    const multerMiddleware = multerUpload.single(fieldName);
    return (req, res, next) => {
        multerMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            try {
                if (!req.file) {
                    return next();
                }
                const subfolder = req.body.subfolder || "tshirt-types";
                const compressedPath = await compressAndSave(req.file.buffer, req.file.originalname, subfolder);
                req.body.compressedImagePath = compressedPath;
                next();
            }
            catch (error) {
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
exports.uploadSingleCompressed = uploadSingleCompressed;
/**
 * Middleware para subir múltiples imágenes con compresión.
 * Los campos deben llamarse "images".
 * Guarda un array de rutas en req.body.compressedImagePaths
 */
const uploadMultipleCompressed = (fieldName = "images", maxCount = 3) => {
    const multerMiddleware = multerUpload.array(fieldName, maxCount);
    return (req, res, next) => {
        multerMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            try {
                const files = req.files;
                if (!files || files.length === 0) {
                    return next();
                }
                const subfolder = req.body.subfolder || "tshirt-types";
                const paths = [];
                for (const file of files) {
                    const compressedPath = await compressAndSave(file.buffer, file.originalname, subfolder);
                    paths.push(compressedPath);
                }
                req.body.compressedImagePaths = paths;
                next();
            }
            catch (error) {
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
exports.uploadMultipleCompressed = uploadMultipleCompressed;
/**
 * Middleware para subir la imagen representativa de un TShirtType.
 * Campo: modelImage
 */
const uploadTShirtTypeImages = () => {
    const multerMiddleware = multerUpload.single("modelImage");
    return (req, res, next) => {
        multerMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            try {
                if (!req.file) {
                    return next();
                }
                const compressedPath = await compressAndSave(req.file.buffer, req.file.originalname, "tshirt-types");
                req.body.modelImage = compressedPath;
                next();
            }
            catch (error) {
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
exports.uploadTShirtTypeImages = uploadTShirtTypeImages;
/**
 * Middleware para subir imagen de producto (TshirtConfig).
 * Campo: "productImage"
 */
const uploadProductImageCompressed = () => {
    const multerMiddleware = multerUpload.single("productImage");
    return (req, res, next) => {
        multerMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            try {
                if (!req.file) {
                    return next();
                }
                const compressedPath = await compressAndSave(req.file.buffer, req.file.originalname, "products");
                req.body.productImage = compressedPath;
                next();
            }
            catch (error) {
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
exports.uploadProductImageCompressed = uploadProductImageCompressed;
/**
 * Elimina un archivo de imagen del servidor
 */
const deleteCompressedImage = async (imagePath) => {
    try {
        if (!imagePath || imagePath.startsWith("http"))
            return false;
        const fullPath = imagePath.startsWith("/uploads/")
            ? path_1.default.join(process.cwd(), imagePath)
            : imagePath;
        await promises_1.default.unlink(fullPath);
        console.log(`🗑️  Imagen eliminada: ${fullPath}`);
        return true;
    }
    catch (error) {
        console.error(`❌ Error eliminando imagen ${imagePath}:`, error);
        return false;
    }
};
exports.deleteCompressedImage = deleteCompressedImage;
exports.default = {
    uploadSingleCompressed: exports.uploadSingleCompressed,
    uploadMultipleCompressed: exports.uploadMultipleCompressed,
    uploadTShirtTypeImages: exports.uploadTShirtTypeImages,
    uploadProductImageCompressed: exports.uploadProductImageCompressed,
    deleteCompressedImage: exports.deleteCompressedImage,
    compressAndSave,
};
