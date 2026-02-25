import { Request, Response } from "express";
import TshirtConfig from "../models/TshirtConfig";
import { deleteConfigImage } from "../middlewares/uploadTshirtConfig";

// @desc    Obtener todas las configuraciones
// @route   GET /api/v1/tshirt-configs
// @access  Public
export const getTshirtConfigs = async (req: Request, res: Response) => {
  try {
    const { tshirtType, design, color, isActive } = req.query;

    let query: any = {};

    if (tshirtType) query.tshirtType = tshirtType;
    if (design) query.design = design;
    if (color) query.color = (color as string).toLowerCase();
    if (isActive !== undefined) query.isActive = isActive === "true";

    const configs = await TshirtConfig.find(query)
      .populate("tshirtType", "description productType")
      .populate({ path: "design", select: "name description imageUrl imageUrlDark tags", populate: { path: "collection", select: "name description" } })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: configs.length,
      data: configs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener configuraciones",
      error: error.message,
    });
  }
};

// @desc    Obtener una configuración por ID
// @route   GET /api/v1/tshirt-configs/:id
// @access  Public
export const getTshirtConfigById = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await TshirtConfig.findById(req.params.id)
      .populate("tshirtType")
      .populate("design");

    if (!config) {
      res.status(404).json({
        success: false,
        message: "Configuración no encontrada",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener la configuración",
      error: error.message,
    });
  }
};

// @desc    Buscar configuración que coincida con tipo + diseño + color
// @route   GET /api/v1/tshirt-configs/match
// @access  Public
export const findMatchingConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tshirtType, design, color, size } = req.query;

    if (!tshirtType || !design || !color) {
      res.status(400).json({
        success: false,
        message: "Se requieren tshirtType, design y color para buscar",
      });
      return;
    }

    const config = await TshirtConfig.findOne({
      tshirtType,
      design,
      color: (color as string).toLowerCase(),
      isActive: true,
    })
      .populate("tshirtType", "description productType")
      .populate({ path: "design", select: "name description imageUrl imageUrlDark tags", populate: { path: "collection", select: "name description" } });

    if (!config) {
      res.status(404).json({
        success: false,
        available: false,
        message: "No hay disponibilidad para esta combinación",
      });
      return;
    }

    // Si se especificó talle, verificar que el talle exista en sizes
    if (size) {
      const hasSizeAvailable = config.sizes.includes((size as string).toUpperCase());

      res.status(200).json({
        success: true,
        available: hasSizeAvailable,
        data: config,
      });
      return;
    }

    res.status(200).json({
      success: true,
      available: true,
      data: config,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al buscar configuración",
      error: error.message,
    });
  }
};

// @desc    Crear una nueva configuración
// @route   POST /api/v1/tshirt-configs
// @access  Admin
export const createTshirtConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tshirtType, design, color, sizes, productImage, price } = req.body;

    // Parsear sizes si vienen como strings (desde FormData)
    const parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
    const parsedPrice = typeof price === 'string' ? parseFloat(price) : price;

    // Validar que se haya subido una imagen
    if (!productImage) {
      res.status(400).json({
        success: false,
        message: "La imagen del producto es requerida",
      });
      return;
    }

    // Verificar si ya existe una config con esta combinación
    const existing = await TshirtConfig.findOne({
      tshirtType,
      design,
      color: color?.toLowerCase(),
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: "Ya existe una configuración para esta combinación de tipo, diseño y color",
      });
      return;
    }

    const config = await TshirtConfig.create({
      tshirtType,
      design,
      color: color?.toLowerCase(),
      sizes: parsedSizes,
      productImage,
      price: parsedPrice,
    });

    const populatedConfig = await TshirtConfig.findById(config._id)
      .populate("tshirtType", "description productType")
      .populate({ path: "design", select: "name description imageUrl imageUrlDark tags", populate: { path: "collection", select: "name description" } });

    res.status(201).json({
      success: true,
      message: "Configuración creada exitosamente",
      data: populatedConfig,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: "Ya existe una configuración para esta combinación de tipo, diseño y color",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Error al crear la configuración",
      error: error.message,
    });
  }
};

// @desc    Actualizar una configuración
// @route   PUT /api/v1/tshirt-configs/:id
// @access  Admin
export const updateTshirtConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tshirtType, design, color, sizes, productImage, price, isActive } = req.body;

    // Si se subió una nueva imagen, eliminar la anterior
    if (productImage && req.file) {
      const existingConfig = await TshirtConfig.findById(req.params.id);
      if (existingConfig && existingConfig.productImage) {
        deleteConfigImage(existingConfig.productImage);
      }
    }

    // Parsear sizes si vienen como strings (desde FormData)
    const parsedSizes = sizes ? (typeof sizes === 'string' ? JSON.parse(sizes) : sizes) : undefined;
    const parsedPrice = price !== undefined ? (typeof price === 'string' ? parseFloat(price) : price) : undefined;

    const updateData: any = {};
    if (tshirtType) updateData.tshirtType = tshirtType;
    if (design) updateData.design = design;
    if (color) updateData.color = color.toLowerCase();
    if (parsedSizes) updateData.sizes = parsedSizes;
    if (productImage) updateData.productImage = productImage;
    if (parsedPrice !== undefined) updateData.price = parsedPrice;
    if (isActive !== undefined) updateData.isActive = isActive;

    const config = await TshirtConfig.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("tshirtType", "description productType")
      .populate({ path: "design", select: "name description imageUrl imageUrlDark tags", populate: { path: "collection", select: "name description" } });

    if (!config) {
      res.status(404).json({
        success: false,
        message: "Configuración no encontrada",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Configuración actualizada exitosamente",
      data: config,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: "Ya existe otra configuración con esta combinación de tipo, diseño y color",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Error al actualizar la configuración",
      error: error.message,
    });
  }
};

// @desc    Activar/Desactivar una configuración
// @route   PATCH /api/v1/tshirt-configs/:id/toggle-active
// @access  Admin
export const toggleTshirtConfigActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await TshirtConfig.findById(req.params.id);

    if (!config) {
      res.status(404).json({
        success: false,
        message: "Configuración no encontrada",
      });
      return;
    }

    config.isActive = !config.isActive;
    await config.save();

    const populatedConfig = await TshirtConfig.findById(config._id)
      .populate("tshirtType", "description productType")
      .populate({ path: "design", select: "name description imageUrl imageUrlDark tags", populate: { path: "collection", select: "name description" } });

    res.status(200).json({
      success: true,
      message: `Configuración ${config.isActive ? "activada" : "desactivada"} exitosamente`,
      data: populatedConfig,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado de la configuración",
      error: error.message,
    });
  }
};

// @desc    Eliminar una configuración
// @route   DELETE /api/v1/tshirt-configs/:id
// @access  Admin
export const deleteTshirtConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await TshirtConfig.findByIdAndDelete(req.params.id);

    if (!config) {
      res.status(404).json({
        success: false,
        message: "Configuración no encontrada",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Configuración eliminada exitosamente",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al eliminar la configuración",
      error: error.message,
    });
  }
};

// @desc    Obtener estadísticas de configuraciones
// @route   GET /api/v1/tshirt-configs/stats/overview
// @access  Admin
export const getTshirtConfigStats = async (req: Request, res: Response) => {
  try {
    const totalConfigs = await TshirtConfig.countDocuments();
    const activeConfigs = await TshirtConfig.countDocuments({ isActive: true });
    const inactiveConfigs = totalConfigs - activeConfigs;

    res.status(200).json({
      success: true,
      data: {
        totalConfigs,
        activeConfigs,
        inactiveConfigs,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener estadísticas",
      error: error.message,
    });
  }
};
