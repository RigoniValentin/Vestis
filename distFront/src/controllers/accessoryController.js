"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessoryStats = exports.toggleActive = exports.toggleFeatured = exports.deleteAccessory = exports.updateAccessory = exports.createAccessory = exports.getAccessoryTypes = exports.getAccessoryById = exports.getAccessories = exports.ACCESSORY_TYPES = void 0;
const Accessory_1 = __importDefault(require("../models/Accessory"));
const uploadAccessory_1 = require("../middlewares/uploadAccessory");
// Tipos de accesorios con sus labels para el frontend
exports.ACCESSORY_TYPES = [
    { value: "colchoneta", label: "Colchoneta", icon: "🧘" },
    { value: "banda-elastica", label: "Banda Elástica", icon: "🪢" },
    { value: "botella", label: "Botella", icon: "🍶" },
    { value: "bolso", label: "Bolso", icon: "👜" },
    { value: "media", label: "Medias", icon: "🧦" },
    { value: "vincha", label: "Vincha", icon: "🎀" },
    { value: "toalla", label: "Toalla", icon: "🏖️" },
    { value: "equipamiento", label: "Equipamiento", icon: "🏋️" },
    { value: "otro", label: "Otro", icon: "📦" },
];
// @desc    Obtener todos los accesorios
// @route   GET /api/v1/accessories
// @access  Public
const getAccessories = async (req, res) => {
    try {
        const { type, isActive, isFeatured, minPrice, maxPrice, search, sortBy = "createdAt", sortOrder = "desc", page = "1", limit = "20", } = req.query;
        // Construir filtros
        const filter = {};
        if (type)
            filter.type = type;
        if (isActive !== undefined)
            filter.isActive = isActive === "true";
        if (isFeatured !== undefined)
            filter.isFeatured = isFeatured === "true";
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice)
                filter.price.$gte = Number(minPrice);
            if (maxPrice)
                filter.price.$lte = Number(maxPrice);
        }
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { tags: { $regex: search, $options: "i" } },
            ];
        }
        // Paginación
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
        // Ordenamiento
        const sortObj = {};
        sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;
        // Ejecutar consulta
        const [accessories, total] = await Promise.all([
            Accessory_1.default.find(filter).sort(sortObj).skip(skip).limit(limitNum),
            Accessory_1.default.countDocuments(filter),
        ]);
        res.status(200).json({
            success: true,
            count: accessories.length,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            data: accessories,
        });
    }
    catch (error) {
        console.error("Error al obtener accesorios:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener accesorios",
            error: error.message,
        });
    }
};
exports.getAccessories = getAccessories;
// @desc    Obtener un accesorio por ID o slug
// @route   GET /api/v1/accessories/:idOrSlug
// @access  Public
const getAccessoryById = async (req, res) => {
    try {
        const idOrSlug = req.params.idOrSlug;
        // Intentar buscar por ID o por slug
        let accessory = null;
        // Verificar si es un ObjectId válido
        if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
            accessory = await Accessory_1.default.findById(idOrSlug);
        }
        // Si no se encontró por ID, buscar por slug
        if (!accessory) {
            accessory = await Accessory_1.default.findOne({ slug: idOrSlug });
        }
        if (!accessory) {
            res.status(404).json({
                success: false,
                message: "Accesorio no encontrado",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: accessory,
        });
    }
    catch (error) {
        console.error("Error al obtener accesorio:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener el accesorio",
            error: error.message,
        });
    }
};
exports.getAccessoryById = getAccessoryById;
// @desc    Obtener tipos de accesorios disponibles
// @route   GET /api/v1/accessories/types
// @access  Public
const getAccessoryTypes = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: exports.ACCESSORY_TYPES,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener tipos de accesorios",
            error: error.message,
        });
    }
};
exports.getAccessoryTypes = getAccessoryTypes;
// @desc    Crear un nuevo accesorio
// @route   POST /api/v1/accessories
// @access  Private (Admin)
const createAccessory = async (req, res) => {
    try {
        const { name, description, shortDescription, price, compareAtPrice, type, colors, sizes, stock, tags, isFeatured, isActive, sku, weight, dimensions, uploadedImages, } = req.body;
        // Procesar colores y talles si vienen como string (FormData)
        let parsedColors = colors;
        let parsedSizes = sizes;
        let parsedTags = tags;
        let parsedDimensions = dimensions;
        if (typeof colors === "string") {
            try {
                parsedColors = JSON.parse(colors);
            }
            catch {
                parsedColors = [];
            }
        }
        if (typeof sizes === "string") {
            try {
                parsedSizes = JSON.parse(sizes);
            }
            catch {
                parsedSizes = [];
            }
        }
        if (typeof tags === "string") {
            try {
                parsedTags = JSON.parse(tags);
            }
            catch {
                parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
            }
        }
        if (typeof dimensions === "string") {
            try {
                parsedDimensions = JSON.parse(dimensions);
            }
            catch {
                parsedDimensions = undefined;
            }
        }
        const accessoryData = {
            name,
            description,
            shortDescription,
            price: Number(price),
            compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
            type,
            images: uploadedImages || [],
            colors: parsedColors || [],
            sizes: parsedSizes || [],
            stock: Number(stock) || 0,
            tags: parsedTags || [],
            isFeatured: isFeatured === "true" || isFeatured === true,
            isActive: isActive !== "false" && isActive !== false,
            sku,
            weight: weight ? Number(weight) : undefined,
            dimensions: parsedDimensions,
        };
        const accessory = await Accessory_1.default.create(accessoryData);
        res.status(201).json({
            success: true,
            message: "Accesorio creado exitosamente",
            data: accessory,
        });
    }
    catch (error) {
        console.error("Error al crear accesorio:", error);
        res.status(500).json({
            success: false,
            message: "Error al crear el accesorio",
            error: error.message,
        });
    }
};
exports.createAccessory = createAccessory;
// @desc    Actualizar un accesorio
// @route   PUT /api/v1/accessories/:id
// @access  Private (Admin)
const updateAccessory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, shortDescription, price, compareAtPrice, type, colors, sizes, stock, tags, isFeatured, isActive, sku, weight, dimensions, uploadedImages, existingImages, // Imágenes que ya tenía y se mantienen
         } = req.body;
        const existingAccessory = await Accessory_1.default.findById(id);
        if (!existingAccessory) {
            res.status(404).json({
                success: false,
                message: "Accesorio no encontrado",
            });
            return;
        }
        // Procesar campos JSON
        let parsedColors = colors;
        let parsedSizes = sizes;
        let parsedTags = tags;
        let parsedDimensions = dimensions;
        let parsedExistingImages = existingImages;
        if (typeof colors === "string") {
            try {
                parsedColors = JSON.parse(colors);
            }
            catch {
                parsedColors = existingAccessory.colors;
            }
        }
        if (typeof sizes === "string") {
            try {
                parsedSizes = JSON.parse(sizes);
            }
            catch {
                parsedSizes = existingAccessory.sizes;
            }
        }
        if (typeof tags === "string") {
            try {
                parsedTags = JSON.parse(tags);
            }
            catch {
                parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
            }
        }
        if (typeof dimensions === "string") {
            try {
                parsedDimensions = JSON.parse(dimensions);
            }
            catch {
                parsedDimensions = existingAccessory.dimensions;
            }
        }
        if (typeof existingImages === "string") {
            try {
                parsedExistingImages = JSON.parse(existingImages);
            }
            catch {
                parsedExistingImages = [];
            }
        }
        // Combinar imágenes existentes con nuevas
        let finalImages = parsedExistingImages || [];
        if (uploadedImages && uploadedImages.length > 0) {
            finalImages = [...finalImages, ...uploadedImages].slice(0, 4);
        }
        // Eliminar imágenes que ya no se usan
        const imagesToDelete = existingAccessory.images.filter((img) => !finalImages.includes(img));
        if (imagesToDelete.length > 0) {
            (0, uploadAccessory_1.deleteAccessoryImages)(imagesToDelete);
        }
        const updateData = {
            name: name || existingAccessory.name,
            description: description || existingAccessory.description,
            shortDescription: shortDescription !== undefined ? shortDescription : existingAccessory.shortDescription,
            price: price ? Number(price) : existingAccessory.price,
            compareAtPrice: compareAtPrice !== undefined ? (compareAtPrice ? Number(compareAtPrice) : undefined) : existingAccessory.compareAtPrice,
            type: type || existingAccessory.type,
            images: finalImages.length > 0 ? finalImages : existingAccessory.images,
            colors: parsedColors || existingAccessory.colors,
            sizes: parsedSizes || existingAccessory.sizes,
            stock: stock !== undefined ? Number(stock) : existingAccessory.stock,
            tags: parsedTags || existingAccessory.tags,
            isFeatured: isFeatured !== undefined ? (isFeatured === "true" || isFeatured === true) : existingAccessory.isFeatured,
            isActive: isActive !== undefined ? (isActive !== "false" && isActive !== false) : existingAccessory.isActive,
            sku: sku !== undefined ? sku : existingAccessory.sku,
            weight: weight !== undefined ? (weight ? Number(weight) : undefined) : existingAccessory.weight,
            dimensions: parsedDimensions !== undefined ? parsedDimensions : existingAccessory.dimensions,
        };
        // Actualizar imagen principal
        if (updateData.images && updateData.images.length > 0) {
            updateData.mainImage = updateData.images[0];
        }
        const accessory = await Accessory_1.default.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
        res.status(200).json({
            success: true,
            message: "Accesorio actualizado exitosamente",
            data: accessory,
        });
    }
    catch (error) {
        console.error("Error al actualizar accesorio:", error);
        res.status(500).json({
            success: false,
            message: "Error al actualizar el accesorio",
            error: error.message,
        });
    }
};
exports.updateAccessory = updateAccessory;
// @desc    Eliminar un accesorio
// @route   DELETE /api/v1/accessories/:id
// @access  Private (Admin)
const deleteAccessory = async (req, res) => {
    try {
        const { id } = req.params;
        const accessory = await Accessory_1.default.findById(id);
        if (!accessory) {
            res.status(404).json({
                success: false,
                message: "Accesorio no encontrado",
            });
            return;
        }
        // Eliminar imágenes del filesystem
        if (accessory.images && accessory.images.length > 0) {
            (0, uploadAccessory_1.deleteAccessoryImages)(accessory.images);
        }
        await Accessory_1.default.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: "Accesorio eliminado exitosamente",
        });
    }
    catch (error) {
        console.error("Error al eliminar accesorio:", error);
        res.status(500).json({
            success: false,
            message: "Error al eliminar el accesorio",
            error: error.message,
        });
    }
};
exports.deleteAccessory = deleteAccessory;
// @desc    Cambiar estado de destacado
// @route   PATCH /api/v1/accessories/:id/featured
// @access  Private (Admin)
const toggleFeatured = async (req, res) => {
    try {
        const { id } = req.params;
        const accessory = await Accessory_1.default.findById(id);
        if (!accessory) {
            res.status(404).json({
                success: false,
                message: "Accesorio no encontrado",
            });
            return;
        }
        accessory.isFeatured = !accessory.isFeatured;
        await accessory.save();
        res.status(200).json({
            success: true,
            message: `Accesorio ${accessory.isFeatured ? "destacado" : "quitado de destacados"}`,
            data: accessory,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al cambiar estado de destacado",
            error: error.message,
        });
    }
};
exports.toggleFeatured = toggleFeatured;
// @desc    Cambiar estado activo/inactivo
// @route   PATCH /api/v1/accessories/:id/active
// @access  Private (Admin)
const toggleActive = async (req, res) => {
    try {
        const { id } = req.params;
        const accessory = await Accessory_1.default.findById(id);
        if (!accessory) {
            res.status(404).json({
                success: false,
                message: "Accesorio no encontrado",
            });
            return;
        }
        accessory.isActive = !accessory.isActive;
        await accessory.save();
        res.status(200).json({
            success: true,
            message: `Accesorio ${accessory.isActive ? "activado" : "desactivado"}`,
            data: accessory,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al cambiar estado activo",
            error: error.message,
        });
    }
};
exports.toggleActive = toggleActive;
// @desc    Obtener estadísticas de accesorios
// @route   GET /api/v1/accessories/stats
// @access  Private (Admin)
const getAccessoryStats = async (req, res) => {
    try {
        const [total, active, featured, outOfStock, byType,] = await Promise.all([
            Accessory_1.default.countDocuments(),
            Accessory_1.default.countDocuments({ isActive: true }),
            Accessory_1.default.countDocuments({ isFeatured: true }),
            Accessory_1.default.countDocuments({ stock: 0, colors: { $size: 0 } }),
            Accessory_1.default.aggregate([
                { $group: { _id: "$type", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
        ]);
        res.status(200).json({
            success: true,
            data: {
                total,
                active,
                inactive: total - active,
                featured,
                outOfStock,
                byType: byType.map((t) => ({
                    type: t._id,
                    label: exports.ACCESSORY_TYPES.find((at) => at.value === t._id)?.label || t._id,
                    count: t.count,
                })),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener estadísticas",
            error: error.message,
        });
    }
};
exports.getAccessoryStats = getAccessoryStats;
