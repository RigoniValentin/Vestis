"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleTShirtTypeActive = exports.deleteTShirtType = exports.updateTShirtType = exports.createTShirtType = exports.getTShirtTypesByCategory = exports.getTShirtTypeById = exports.getTShirtTypes = void 0;
const TShirtType_1 = __importDefault(require("../models/TShirtType"));
const uploadTShirtType_1 = require("../middlewares/uploadTShirtType");
// @desc    Obtener todos los tipos de remeras/musculosas
// @route   GET /api/tshirt-types
// @access  Public
const getTShirtTypes = async (req, res) => {
    try {
        const { productType, isActive } = req.query;
        let query = {};
        if (productType) {
            query.productType = productType;
        }
        if (isActive !== undefined) {
            query.isActive = isActive === "true";
        }
        const types = await TShirtType_1.default.find(query).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: types.length,
            data: types,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener tipos de productos",
            error: error.message,
        });
    }
};
exports.getTShirtTypes = getTShirtTypes;
// @desc    Obtener un tipo por ID
// @route   GET /api/tshirt-types/:id
// @access  Public
const getTShirtTypeById = async (req, res) => {
    try {
        const type = await TShirtType_1.default.findById(req.params.id);
        if (!type) {
            res.status(404).json({
                success: false,
                message: "Tipo de producto no encontrado",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: type,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener el tipo de producto",
            error: error.message,
        });
    }
};
exports.getTShirtTypeById = getTShirtTypeById;
// @desc    Obtener tipos por categoría (remeras, musculosas)
// @route   GET /api/tshirt-types/category/:productType
// @access  Public
const getTShirtTypesByCategory = async (req, res) => {
    try {
        const { productType } = req.params;
        const types = await TShirtType_1.default.find({
            productType,
            isActive: true,
        }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: types.length,
            data: types,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al obtener tipos por categoría",
            error: error.message,
        });
    }
};
exports.getTShirtTypesByCategory = getTShirtTypesByCategory;
// @desc    Crear un tipo de remera/musculosa
// @route   POST /api/tshirt-types
// @access  Private/Admin
const createTShirtType = async (req, res) => {
    try {
        const { description, productType, isActive, sampleImagePath } = req.body;
        if (!description || !productType) {
            res.status(400).json({
                success: false,
                message: "Descripción y tipo de producto son requeridos",
            });
            return;
        }
        const typeData = {
            description,
            productType,
            isActive: isActive !== undefined
                ? isActive === "true" || isActive === true
                : true,
        };
        // Si se subió una imagen, agregarla
        if (sampleImagePath) {
            typeData.sampleImage = sampleImagePath;
        }
        const type = await TShirtType_1.default.create(typeData);
        res.status(201).json({
            success: true,
            message: "Tipo de producto creado exitosamente",
            data: type,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al crear el tipo de producto",
            error: error.message,
        });
    }
};
exports.createTShirtType = createTShirtType;
// @desc    Actualizar un tipo
// @route   PUT /api/tshirt-types/:id
// @access  Private/Admin
const updateTShirtType = async (req, res) => {
    try {
        const type = await TShirtType_1.default.findById(req.params.id);
        if (!type) {
            res.status(404).json({
                success: false,
                message: "Tipo de producto no encontrado",
            });
            return;
        }
        const updateData = { ...req.body };
        if (updateData.isActive !== undefined) {
            updateData.isActive =
                updateData.isActive === "true" || updateData.isActive === true;
        }
        // Si se subió una nueva imagen, eliminar la anterior
        if (req.body.sampleImagePath && type.sampleImage) {
            await (0, uploadTShirtType_1.deleteTShirtTypeImage)(type.sampleImage);
        }
        // Si se subió una nueva imagen, agregarla a los datos de actualización
        if (req.body.sampleImagePath) {
            updateData.sampleImage = req.body.sampleImagePath;
        }
        const updatedType = await TShirtType_1.default.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });
        res.status(200).json({
            success: true,
            message: "Tipo de producto actualizado exitosamente",
            data: updatedType,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al actualizar el tipo de producto",
            error: error.message,
        });
    }
};
exports.updateTShirtType = updateTShirtType;
// @desc    Eliminar un tipo (soft delete)
// @route   DELETE /api/tshirt-types/:id
// @access  Private/Admin
const deleteTShirtType = async (req, res) => {
    try {
        const type = await TShirtType_1.default.findById(req.params.id);
        if (!type) {
            res.status(404).json({
                success: false,
                message: "Tipo de producto no encontrado",
            });
            return;
        }
        type.isActive = false;
        await type.save();
        res.status(200).json({
            success: true,
            message: "Tipo de producto desactivado exitosamente",
            data: type,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al eliminar el tipo de producto",
            error: error.message,
        });
    }
};
exports.deleteTShirtType = deleteTShirtType;
// @desc    Activar/Desactivar un tipo
// @route   PATCH /api/tshirt-types/:id/toggle-active
// @access  Private/Admin
const toggleTShirtTypeActive = async (req, res) => {
    try {
        const type = await TShirtType_1.default.findById(req.params.id);
        if (!type) {
            res.status(404).json({
                success: false,
                message: "Tipo de producto no encontrado",
            });
            return;
        }
        type.isActive = !type.isActive;
        await type.save();
        res.status(200).json({
            success: true,
            message: `Tipo de producto ${type.isActive ? "activado" : "desactivado"} exitosamente`,
            data: type,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error al cambiar estado del tipo de producto",
            error: error.message,
        });
    }
};
exports.toggleTShirtTypeActive = toggleTShirtTypeActive;
