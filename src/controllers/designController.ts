import { Request, Response } from "express";
import Design from "../models/Design";
import TshirtConfig from "../models/TshirtConfig";
import { deleteDesignImage } from "../middlewares/uploadDesign";

// @desc    Obtener todos los diseños
// @route   GET /api/designs
// @access  Public
export const getDesigns = async (req: Request, res: Response) => {
  try {
    const { collection, isActive, tags } = req.query;
    
    let query: any = {};
    
    if (collection) {
      query.collection = collection;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    
    if (tags) {
      const tagsArray = (tags as string).split(",");
      query.tags = { $in: tagsArray };
    }
    
    const designs = await Design.find(query)
      .populate("collection", "name description")
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: designs.length,
      data: designs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener diseños",
      error: error.message,
    });
  }
};

// @desc    Obtener un diseño por ID
// @route   GET /api/designs/:id
// @access  Public
export const getDesignById = async (req: Request, res: Response): Promise<void> => {
  try {
    const design = await Design.findById(req.params.id)
      .populate("collection", "name description");
    
    if (!design) {
      res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: design,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener el diseño",
      error: error.message,
    });
  }
};

// @desc    Crear un diseño
// @route   POST /api/designs
// @access  Private/Admin
export const createDesign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, imageUrl, imageUrlDark, collection, tags, isActive } = req.body;
    
    // Validar campos requeridos
    if (!name || !collection) {
      res.status(400).json({
        success: false,
        message: "Nombre y colección son requeridos",
      });
      return;
    }

    // Debe haber al menos una imagen (claro u oscuro)
    if (!imageUrl && !imageUrlDark) {
      res.status(400).json({
        success: false,
        message: "Debe subir al menos una imagen del diseño (claro u oscuro)",
      });
      return;
    }
    
    // Procesar tags (puede venir como string separado por comas o array)
    let tagsArray: string[] = [];
    if (tags) {
      if (typeof tags === 'string') {
        tagsArray = tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    const design = await Design.create({
      name,
      description,
      imageUrl: imageUrl || null,
      imageUrlDark: imageUrlDark || null,
      collection,
      tags: tagsArray,
      isActive: isActive !== undefined ? (isActive === "true" || isActive === true) : true,
    });

    // Poblar la colección antes de devolver
    await design.populate("collection", "name description");
    
    res.status(201).json({
      success: true,
      message: "Diseño creado exitosamente",
      data: design,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al crear el diseño",
      error: error.message,
    });
  }
};

// @desc    Actualizar un diseño
// @route   PUT /api/designs/:id
// @access  Private/Admin
export const updateDesign = async (req: Request, res: Response): Promise<void> => {
  try {
    const design = await Design.findById(req.params.id);
    
    if (!design) {
      res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
      });
      return;
    }

    // Si se subió una nueva imagen (claro), eliminar la anterior
    if (req.body.imageUrl && design.imageUrl && req.body.imageUrl !== design.imageUrl) {
      await deleteDesignImage(design.imageUrl);
    }

    // Si se subió una nueva imagen (oscuro), eliminar la anterior
    if (req.body.imageUrlDark && design.imageUrlDark && req.body.imageUrlDark !== design.imageUrlDark) {
      await deleteDesignImage(design.imageUrlDark);
    }

    // Procesar tags si vienen en el request
    if (req.body.tags) {
      if (typeof req.body.tags === 'string') {
        req.body.tags = req.body.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
      }
    }

    // Procesar isActive
    if (req.body.isActive !== undefined) {
      req.body.isActive = req.body.isActive === "true" || req.body.isActive === true;
    }
    
    const updatedDesign = await Design.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("collection", "name description");
    
    res.status(200).json({
      success: true,
      message: "Diseño actualizado exitosamente",
      data: updatedDesign,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al actualizar el diseño",
      error: error.message,
    });
  }
};

// @desc    Eliminar un diseño (solo si no tiene configuraciones asociadas)
// @route   DELETE /api/designs/:id
// @access  Private/Admin
export const deleteDesign = async (req: Request, res: Response): Promise<void> => {
  try {
    const design = await Design.findById(req.params.id);
    
    if (!design) {
      res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
      });
      return;
    }

    // Verificar si el diseño está asociado a alguna configuración de remera
    const associatedConfigs = await TshirtConfig.countDocuments({ design: design._id });
    if (associatedConfigs > 0) {
      res.status(400).json({
        success: false,
        message: `No se puede eliminar: este diseño está asociado a ${associatedConfigs} configuración${associatedConfigs > 1 ? "es" : ""} de prenda`,
      });
      return;
    }

    // Eliminar imágenes del disco
    if (design.imageUrl) {
      await deleteDesignImage(design.imageUrl);
    }
    if (design.imageUrlDark) {
      await deleteDesignImage(design.imageUrlDark);
    }

    // Eliminar el documento de la base de datos
    await Design.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Diseño eliminado permanentemente",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al eliminar el diseño",
      error: error.message,
    });
  }
};

// @desc    Activar/Desactivar un diseño
// @route   PATCH /api/designs/:id/toggle-active
// @access  Private/Admin
export const toggleDesignActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const design = await Design.findById(req.params.id);
    
    if (!design) {
      res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
      });
      return;
    }
    
    design.isActive = !design.isActive;
    await design.save();
    
    res.status(200).json({
      success: true,
      message: `Diseño ${design.isActive ? "activado" : "desactivado"} exitosamente`,
      data: design,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado del diseño",
      error: error.message,
    });
  }
};
