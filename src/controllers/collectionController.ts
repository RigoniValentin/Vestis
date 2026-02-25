import { Request, Response } from "express";
import Collection from "../models/Collection";
import Design from "../models/Design";

// @desc    Obtener todas las colecciones
// @route   GET /api/v1/collections
// @access  Public
export const getCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isActive } = req.query;
    const query: any = {};

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const collections = await Collection.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: collections.length,
      data: collections,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener colecciones",
      error: error.message,
    });
  }
};

// @desc    Obtener una colección por ID
// @route   GET /api/v1/collections/:id
// @access  Public
export const getCollectionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      res.status(404).json({
        success: false,
        message: "Colección no encontrada",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: collection,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener la colección",
      error: error.message,
    });
  }
};

// @desc    Crear una colección
// @route   POST /api/v1/collections
// @access  Private/Admin
export const createCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "El nombre de la colección es requerido",
      });
      return;
    }

    const existing = await Collection.findOne({ name: name.trim() });
    if (existing) {
      res.status(400).json({
        success: false,
        message: "Ya existe una colección con ese nombre",
      });
      return;
    }

    const collection = await Collection.create({
      name: name.trim(),
      description: description?.trim() || "",
    });

    res.status(201).json({
      success: true,
      message: "Colección creada exitosamente",
      data: collection,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al crear la colección",
      error: error.message,
    });
  }
};

// @desc    Actualizar una colección
// @route   PUT /api/v1/collections/:id
// @access  Private/Admin
export const updateCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      res.status(404).json({
        success: false,
        message: "Colección no encontrada",
      });
      return;
    }

    const { name, description, isActive } = req.body;

    if (name !== undefined) collection.name = name.trim();
    if (description !== undefined) collection.description = description.trim();
    if (isActive !== undefined) collection.isActive = isActive === "true" || isActive === true;

    await collection.save();

    res.status(200).json({
      success: true,
      message: "Colección actualizada exitosamente",
      data: collection,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al actualizar la colección",
      error: error.message,
    });
  }
};

// @desc    Eliminar una colección (solo si no tiene diseños asociados)
// @route   DELETE /api/v1/collections/:id
// @access  Private/Admin
export const deleteCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      res.status(404).json({
        success: false,
        message: "Colección no encontrada",
      });
      return;
    }

    const associatedDesigns = await Design.countDocuments({ collection: collection._id });
    if (associatedDesigns > 0) {
      res.status(400).json({
        success: false,
        message: `No se puede eliminar: esta colección tiene ${associatedDesigns} diseño${associatedDesigns > 1 ? "s" : ""} asociado${associatedDesigns > 1 ? "s" : ""}`,
      });
      return;
    }

    await Collection.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Colección eliminada permanentemente",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al eliminar la colección",
      error: error.message,
    });
  }
};
