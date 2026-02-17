"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUploadError = exports.generateImageUrls = exports.validateImageUrl = exports.cleanupTempFiles = exports.deleteImageFile = exports.upload = exports.uploadProductImages = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
// Tipos permitidos de imágenes
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
];
// Tamaño máximo por archivo (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Máximo número de archivos
const MAX_FILES = 4;
// Configuración de almacenamiento
const storage = multer_1.default.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path_1.default.join(process.cwd(), "uploads", "products");
        try {
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            console.log(`📁 Directorio de uploads verificado: ${uploadDir}`);
            cb(null, uploadDir);
        }
        catch (error) {
            console.error("❌ Error creando directorio de uploads:", error);
            cb(error, "");
        }
    },
    filename: (req, file, cb) => {
        // Generar nombre único para evitar conflictos
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const fileExtension = path_1.default.extname(file.originalname).toLowerCase();
        const fileName = `product-${uniqueSuffix}${fileExtension}`;
        console.log(`📸 Procesando archivo: ${file.originalname} -> ${fileName}`);
        cb(null, fileName);
    },
});
// Filtro de archivos para validar tipo y tamaño
const fileFilter = (req, file, cb) => {
    console.log(`🔍 Validando archivo: ${file.originalname}, tipo: ${file.mimetype}, tamaño: ${file.size} bytes`);
    // Validar tipo de archivo
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        const error = new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten: ${ALLOWED_MIME_TYPES.join(", ")}`);
        console.error(`❌ ${error.message}`);
        return cb(error);
    }
    // Validar extensión del archivo
    const fileExtension = path_1.default.extname(file.originalname).toLowerCase();
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    if (!allowedExtensions.includes(fileExtension)) {
        const error = new Error(`Extensión de archivo no permitida: ${fileExtension}. Solo se permiten: ${allowedExtensions.join(", ")}`);
        console.error(`❌ ${error.message}`);
        return cb(error);
    }
    console.log(`✅ Archivo validado correctamente: ${file.originalname}`);
    cb(null, true);
};
// Configuración principal de multer
exports.uploadProductImages = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
        fieldSize: 10 * 1024 * 1024, // 10MB para campos de texto
    },
}).array("images", MAX_FILES);
// Alias para compatibilidad con el controller
exports.upload = exports.uploadProductImages;
// Función auxiliar para eliminar archivos de forma segura
const deleteImageFile = async (imagePath) => {
    try {
        if (!imagePath)
            return false;
        // Si es una URL completa, extraer solo la ruta del archivo
        let filePath = imagePath;
        if (imagePath.startsWith("/uploads/")) {
            filePath = path_1.default.join(process.cwd(), imagePath);
        }
        else if (imagePath.startsWith("http")) {
            // No eliminar URLs externas
            console.log(`⚠️  URL externa detectada, no se eliminará: ${imagePath}`);
            return false;
        }
        await promises_1.default.unlink(filePath);
        console.log(`🗑️  Archivo eliminado exitosamente: ${filePath}`);
        return true;
    }
    catch (error) {
        console.error(`❌ Error eliminando archivo ${imagePath}:`, error);
        return false;
    }
};
exports.deleteImageFile = deleteImageFile;
// Función para limpiar archivos temporales en caso de error
const cleanupTempFiles = async (files) => {
    if (!files || files.length === 0)
        return;
    console.log(`🧹 Limpiando ${files.length} archivos temporales...`);
    const cleanupPromises = files.map(async (file) => {
        try {
            await promises_1.default.unlink(file.path);
            console.log(`🗑️  Archivo temporal eliminado: ${file.filename}`);
        }
        catch (error) {
            console.error(`❌ Error eliminando archivo temporal ${file.filename}:`, error);
        }
    });
    await Promise.all(cleanupPromises);
    console.log(`✅ Limpieza de archivos temporales completada`);
};
exports.cleanupTempFiles = cleanupTempFiles;
// Función para validar URLs de imágenes externas
const validateImageUrl = (url) => {
    try {
        const urlObject = new URL(url);
        const validProtocols = ["http:", "https:"];
        const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
        const isValidProtocol = validProtocols.includes(urlObject.protocol);
        const hasValidExtension = validExtensions.some((ext) => urlObject.pathname.toLowerCase().endsWith(ext));
        return isValidProtocol && hasValidExtension;
    }
    catch {
        return false;
    }
};
exports.validateImageUrl = validateImageUrl;
// Función para generar URLs completas de imágenes
const generateImageUrls = (filenames, baseUrl = "") => {
    return filenames.map((filename) => {
        if (filename.startsWith("http")) {
            return filename; // URL externa
        }
        return `${baseUrl}/uploads/products/${filename}`;
    });
};
exports.generateImageUrls = generateImageUrls;
// Middleware de manejo de errores para multer
const handleUploadError = (error, req, res, next) => {
    console.error("❌ Error en upload de imágenes:", error);
    // Limpiar archivos temporales si los hay
    if (req.files) {
        (0, exports.cleanupTempFiles)(req.files);
    }
    if (error instanceof multer_1.default.MulterError) {
        switch (error.code) {
            case "LIMIT_FILE_SIZE":
                return res.status(400).json({
                    success: false,
                    message: `Archivo demasiado grande. Tamaño máximo permitido: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
                    error: error.message,
                });
            case "LIMIT_FILE_COUNT":
                return res.status(400).json({
                    success: false,
                    message: `Demasiados archivos. Máximo permitido: ${MAX_FILES}`,
                    error: error.message,
                });
            case "LIMIT_UNEXPECTED_FILE":
                return res.status(400).json({
                    success: false,
                    message: 'Campo de archivo inesperado. Use el campo "images"',
                    error: error.message,
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: "Error en la subida de archivos",
                    error: error.message,
                });
        }
    }
    // Error personalizado (tipo de archivo, etc.)
    return res.status(400).json({
        success: false,
        message: error.message || "Error en la validación de archivos",
        error: error.message,
    });
};
exports.handleUploadError = handleUploadError;
// Exportación por defecto con todas las funciones
exports.default = {
    uploadProductImages: exports.uploadProductImages,
    upload: exports.upload, // Alias para compatibilidad
    deleteImageFile: // Alias para compatibilidad
    exports.deleteImageFile,
    cleanupTempFiles: exports.cleanupTempFiles,
    validateImageUrl: exports.validateImageUrl,
    generateImageUrls: exports.generateImageUrls,
    handleUploadError: exports.handleUploadError,
    MAX_FILES,
    MAX_FILE_SIZE,
    ALLOWED_MIME_TYPES,
};
