"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const categoryController_1 = require("@controllers/categoryController");
const router = (0, express_1.Router)();
// GET /api/categories - Obtener todas las categorías
router.get("/", categoryController_1.getCategories);
// GET /api/categories/:id - Obtener categoría por ID
router.get("/:id", categoryController_1.getCategoryById);
// POST /api/categories - Crear nueva categoría
router.post("/", categoryController_1.createCategory);
// PUT /api/categories/:id - Actualizar categoría
router.put("/:id", categoryController_1.updateCategory);
// DELETE /api/categories/:id - Eliminar categoría
router.delete("/:id", categoryController_1.deleteCategory);
exports.default = router;
