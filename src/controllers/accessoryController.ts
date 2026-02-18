import { Request, Response, RequestHandler } from "express";
import Accessory, { IAccessory, AccessoryType } from "../models/Accessory";
import { deleteAccessoryImages, deleteAccessoryImage } from "../middlewares/uploadAccessory";

// Tipos de accesorios con sus labels para el frontend
export const ACCESSORY_TYPES: { value: AccessoryType; label: string; icon: string }[] = [
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

// Helper type for async handlers
type AsyncRequestHandler = (req: Request, res: Response) => Promise<void>;

// @desc    Obtener todos los accesorios
// @route   GET /api/v1/accessories
// @access  Public
export const getAccessories = async (req: Request, res: Response) => {
  try {
    const {
      type,
      isActive,
      isFeatured,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    // Construir filtros
    const filter: any = {};

    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    // Paginación
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Ordenamiento
    const sortObj: any = {};
    sortObj[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Ejecutar consulta
    const [accessories, total] = await Promise.all([
      Accessory.find(filter).sort(sortObj).skip(skip).limit(limitNum),
      Accessory.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: accessories.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: accessories,
    });
  } catch (error: any) {
    console.error("Error al obtener accesorios:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener accesorios",
      error: error.message,
    });
  }
};

// @desc    Obtener un accesorio por ID o slug
// @route   GET /api/v1/accessories/:idOrSlug
// @access  Public
export const getAccessoryById: AsyncRequestHandler = async (req, res) => {
  try {
    const idOrSlug = req.params.idOrSlug as string;

    // Intentar buscar por ID o por slug
    let accessory = null;

    // Verificar si es un ObjectId válido
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      accessory = await Accessory.findById(idOrSlug);
    }

    // Si no se encontró por ID, buscar por slug
    if (!accessory) {
      accessory = await Accessory.findOne({ slug: idOrSlug });
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
  } catch (error: any) {
    console.error("Error al obtener accesorio:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener el accesorio",
      error: error.message,
    });
  }
};

// @desc    Obtener tipos de accesorios disponibles
// @route   GET /api/v1/accessories/types
// @access  Public
export const getAccessoryTypes = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: ACCESSORY_TYPES,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al obtener tipos de accesorios",
      error: error.message,
    });
  }
};

// @desc    Crear un nuevo accesorio
// @route   POST /api/v1/accessories
// @access  Private (Admin)
export const createAccessory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      type,
      colors,
      sizes,
      tags,
      isFeatured,
      isActive,
      sku,
      weight,
      dimensions,
      uploadedImages,
    } = req.body;

    // Procesar colores y talles si vienen como string (FormData)
    let parsedColors = colors;
    let parsedSizes = sizes;
    let parsedTags = tags;
    let parsedDimensions = dimensions;

    if (typeof colors === "string") {
      try {
        parsedColors = JSON.parse(colors);
      } catch {
        parsedColors = [];
      }
    }

    if (typeof sizes === "string") {
      try {
        parsedSizes = JSON.parse(sizes);
      } catch {
        parsedSizes = [];
      }
    }

    if (typeof tags === "string") {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        parsedTags = tags.split(",").map((t: string) => t.trim()).filter(Boolean);
      }
    }

    if (typeof dimensions === "string") {
      try {
        parsedDimensions = JSON.parse(dimensions);
      } catch {
        parsedDimensions = undefined;
      }
    }

    const accessoryData: Partial<IAccessory> = {
      name,
      description,
      shortDescription,
      price: Number(price),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
      type,
      images: uploadedImages || [],
      colors: parsedColors || [],
      sizes: parsedSizes || [],
      tags: parsedTags || [],
      isFeatured: isFeatured === "true" || isFeatured === true,
      isActive: isActive !== "false" && isActive !== false,
      sku,
      weight: weight ? Number(weight) : undefined,
      dimensions: parsedDimensions,
    };

    const accessory = await Accessory.create(accessoryData);

    res.status(201).json({
      success: true,
      message: "Accesorio creado exitosamente",
      data: accessory,
    });
  } catch (error: any) {
    console.error("Error al crear accesorio:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear el accesorio",
      error: error.message,
    });
  }
};

// @desc    Actualizar un accesorio
// @route   PUT /api/v1/accessories/:id
// @access  Private (Admin)
export const updateAccessory: AsyncRequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      type,
      colors,
      sizes,
      tags,
      isFeatured,
      isActive,
      sku,
      weight,
      dimensions,
      uploadedImages,
      existingImages, // Imágenes que ya tenía y se mantienen
    } = req.body;

    const existingAccessory = await Accessory.findById(id);
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
      } catch {
        parsedColors = existingAccessory.colors;
      }
    }

    if (typeof sizes === "string") {
      try {
        parsedSizes = JSON.parse(sizes);
      } catch {
        parsedSizes = existingAccessory.sizes;
      }
    }

    if (typeof tags === "string") {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        parsedTags = tags.split(",").map((t: string) => t.trim()).filter(Boolean);
      }
    }

    if (typeof dimensions === "string") {
      try {
        parsedDimensions = JSON.parse(dimensions);
      } catch {
        parsedDimensions = existingAccessory.dimensions;
      }
    }

    if (typeof existingImages === "string") {
      try {
        parsedExistingImages = JSON.parse(existingImages);
      } catch {
        parsedExistingImages = [];
      }
    }

    // Combinar imágenes existentes con nuevas
    let finalImages: string[] = parsedExistingImages || [];
    if (uploadedImages && uploadedImages.length > 0) {
      finalImages = [...finalImages, ...uploadedImages].slice(0, 4);
    }

    // Eliminar imágenes que ya no se usan
    const imagesToDelete = existingAccessory.images.filter(
      (img) => !finalImages.includes(img)
    );
    if (imagesToDelete.length > 0) {
      deleteAccessoryImages(imagesToDelete);
    }

    const updateData: Partial<IAccessory> = {
      name: name || existingAccessory.name,
      description: description || existingAccessory.description,
      shortDescription: shortDescription !== undefined ? shortDescription : existingAccessory.shortDescription,
      price: price ? Number(price) : existingAccessory.price,
      compareAtPrice: compareAtPrice !== undefined ? (compareAtPrice ? Number(compareAtPrice) : undefined) : existingAccessory.compareAtPrice,
      type: type || existingAccessory.type,
      images: finalImages.length > 0 ? finalImages : existingAccessory.images,
      colors: parsedColors || existingAccessory.colors,
      sizes: parsedSizes || existingAccessory.sizes,
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

    const accessory = await Accessory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Accesorio actualizado exitosamente",
      data: accessory,
    });
  } catch (error: any) {
    console.error("Error al actualizar accesorio:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar el accesorio",
      error: error.message,
    });
  }
};

// @desc    Eliminar un accesorio
// @route   DELETE /api/v1/accessories/:id
// @access  Private (Admin)
export const deleteAccessory: AsyncRequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const accessory = await Accessory.findById(id);
    if (!accessory) {
      res.status(404).json({
        success: false,
        message: "Accesorio no encontrado",
      });
      return;
    }

    // Eliminar imágenes del filesystem
    if (accessory.images && accessory.images.length > 0) {
      deleteAccessoryImages(accessory.images);
    }

    await Accessory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Accesorio eliminado exitosamente",
    });
  } catch (error: any) {
    console.error("Error al eliminar accesorio:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar el accesorio",
      error: error.message,
    });
  }
};

// @desc    Cambiar estado de destacado
// @route   PATCH /api/v1/accessories/:id/featured
// @access  Private (Admin)
export const toggleFeatured: AsyncRequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const accessory = await Accessory.findById(id);
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado de destacado",
      error: error.message,
    });
  }
};

// @desc    Cambiar estado activo/inactivo
// @route   PATCH /api/v1/accessories/:id/active
// @access  Private (Admin)
export const toggleActive: AsyncRequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const accessory = await Accessory.findById(id);
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error al cambiar estado activo",
      error: error.message,
    });
  }
};

// @desc    Obtener estadísticas de accesorios
// @route   GET /api/v1/accessories/stats
// @access  Private (Admin)
export const getAccessoryStats = async (req: Request, res: Response) => {
  try {
    const [
      total,
      active,
      featured,
      byType,
    ] = await Promise.all([
      Accessory.countDocuments(),
      Accessory.countDocuments({ isActive: true }),
      Accessory.countDocuments({ isFeatured: true }),
      Accessory.aggregate([
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
        byType: byType.map((t) => ({
          type: t._id,
          label: ACCESSORY_TYPES.find((at) => at.value === t._id)?.label || t._id,
          count: t.count,
        })),
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
