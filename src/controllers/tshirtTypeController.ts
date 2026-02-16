import { Request, Response } from "express";
import TShirtType from "../models/TShirtType";
import { deleteTShirtTypeImage } from "../middlewares/uploadTShirtType";

// @desc    Obtener todos los tipos de remeras/musculosas
// @route   GET /api/tshirt-types
// @access  Public
export const getTShirtTypes = async (req: Request, res: Response) => {
  try {
    const { productType, isActive } = req.query;

    let query: any = {};

    if (productType) {
      query.productType = productType;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const types = await TShirtType.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: types.length,
      data: types,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener tipos de productos",
      error: error.message,
    });
  }
};

// @desc    Obtener un tipo por ID
// @route   GET /api/tshirt-types/:id
// @access  Public
export const getTShirtTypeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = await TShirtType.findById(req.params.id);

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener el tipo de producto",
      error: error.message,
    });
  }
};

// @desc    Obtener tipos por categoría (remeras, musculosas)
// @route   GET /api/tshirt-types/category/:productType
// @access  Public
export const getTShirtTypesByCategory = async (req: Request, res: Response) => {
  try {
    const { productType } = req.params;

    const types = await TShirtType.find({
      productType,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: types.length,
      data: types,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener tipos por categoría",
      error: error.message,
    });
  }
};

// @desc    Crear un tipo de remera/musculosa
// @route   POST /api/tshirt-types
// @access  Private/Admin
export const createTShirtType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, productType, isActive, sampleImagePath } = req.body;

    if (!description || !productType) {
      res.status(400).json({
        success: false,
        message: "Descripción y tipo de producto son requeridos",
      });
      return;
    }

    const typeData: any = {
      description,
      productType,
      isActive:
        isActive !== undefined
          ? isActive === "true" || isActive === true
          : true,
    };

    // Si se subió una imagen, agregarla
    if (sampleImagePath) {
      typeData.sampleImage = sampleImagePath;
    }

    const type = await TShirtType.create(typeData);

    res.status(201).json({
      success: true,
      message: "Tipo de producto creado exitosamente",
      data: type,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al crear el tipo de producto",
      error: error.message,
    });
  }
};

// @desc    Actualizar un tipo
// @route   PUT /api/tshirt-types/:id
// @access  Private/Admin
export const updateTShirtType = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = await TShirtType.findById(req.params.id);

    if (!type) {
      res.status(404).json({
        success: false,
        message: "Tipo de producto no encontrado",
      });
      return;
    }

    const updateData: any = { ...req.body };
    if (updateData.isActive !== undefined) {
      updateData.isActive =
        updateData.isActive === "true" || updateData.isActive === true;
    }

    // Si se subió una nueva imagen, eliminar la anterior
    if (req.body.sampleImagePath && type.sampleImage) {
      await deleteTShirtTypeImage(type.sampleImage);
    }

    // Si se subió una nueva imagen, agregarla a los datos de actualización
    if (req.body.sampleImagePath) {
      updateData.sampleImage = req.body.sampleImagePath;
    }

    const updatedType = await TShirtType.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Tipo de producto actualizado exitosamente",
      data: updatedType,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al actualizar el tipo de producto",
      error: error.message,
    });
  }
};

// @desc    Eliminar un tipo (soft delete)
// @route   DELETE /api/tshirt-types/:id
// @access  Private/Admin
export const deleteTShirtType = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = await TShirtType.findById(req.params.id);

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al eliminar el tipo de producto",
      error: error.message,
    });
  }
};

// @desc    Activar/Desactivar un tipo
// @route   PATCH /api/tshirt-types/:id/toggle-active
// @access  Private/Admin
export const toggleTShirtTypeActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = await TShirtType.findById(req.params.id);

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
      message: `Tipo de producto ${
        type.isActive ? "activado" : "desactivado"
      } exitosamente`,
      data: type,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado del tipo de producto",
      error: error.message,
    });
  }
};

