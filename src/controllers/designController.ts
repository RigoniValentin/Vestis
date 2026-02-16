import { Request, Response } from "express";
import Design from "../models/Design";
import { deleteDesignImage } from "../middlewares/uploadDesign";

// @desc    Obtener todos los diseños
// @route   GET /api/designs
// @access  Public
export const getDesigns = async (req: Request, res: Response) => {
  try {
    const { year, isActive, tags } = req.query;
    
    let query: any = {};
    
    if (year) {
      query.year = parseInt(year as string);
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    
    if (tags) {
      const tagsArray = (tags as string).split(",");
      query.tags = { $in: tagsArray };
    }
    
    const designs = await Design.find(query).sort({ year: -1, createdAt: -1 });
    
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
    const design = await Design.findById(req.params.id);
    
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

// @desc    Obtener diseños por año
// @route   GET /api/designs/year/:year
// @access  Public
export const getDesignsByYear = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year as string);
    
    const designs = await Design.find({ 
      year,
      isActive: true 
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: designs.length,
      data: designs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener diseños por año",
      error: error.message,
    });
  }
};

// @desc    Obtener años disponibles
// @route   GET /api/designs/years/available
// @access  Public
export const getAvailableYears = async (req: Request, res: Response) => {
  try {
    const years = await Design.distinct("year", { isActive: true });
    
    res.status(200).json({
      success: true,
      data: years.sort((a, b) => b - a),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener años disponibles",
      error: error.message,
    });
  }
};

// @desc    Crear un diseño
// @route   POST /api/designs
// @access  Private/Admin
export const createDesign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, imageUrl, year, tags, isActive } = req.body;
    
    // Validar campos requeridos
    if (!name || !year) {
      res.status(400).json({
        success: false,
        message: "Nombre y año son requeridos",
      });
      return;
    }

    // Si no se subió una imagen, verificar que se proporcione una URL
    if (!imageUrl) {
      res.status(400).json({
        success: false,
        message: "Debe subir una imagen del diseño",
      });
      return;
    }
    
    // Procesar tags (puede venir como string separado por comas o array)
    let tagsArray = [];
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
      imageUrl,
      year: parseInt(year),
      tags: tagsArray,
      isActive: isActive !== undefined ? (isActive === "true" || isActive === true) : true,
    });
    
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

    // Si se subió una nueva imagen, eliminar la anterior
    if (req.body.imageUrl && design.imageUrl && req.body.imageUrl !== design.imageUrl) {
      await deleteDesignImage(design.imageUrl);
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

    // Procesar year
    if (req.body.year) {
      req.body.year = parseInt(req.body.year);
    }
    
    const updatedDesign = await Design.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    
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

// @desc    Eliminar un diseño
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
    
    // Soft delete - solo desactivar
    design.isActive = false;
    await design.save();
    
    res.status(200).json({
      success: true,
      message: "Diseño desactivado exitosamente",
      data: design,
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
