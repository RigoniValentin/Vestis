"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productController_1 = require("@controllers/productController");
const upload_1 = require("@middlewares/upload");
const router = (0, express_1.Router)();
// GET /api/v1/products - Obtener todos los productos (con filtros y paginación)
router.get("/", productController_1.getProducts);
// GET /api/v1/products/:id - Obtener producto por ID
router.get("/:id", productController_1.getProductById);
// POST /api/v1/products - Crear nuevo producto (máximo 4 imágenes)
router.post("/", upload_1.uploadProductImages, upload_1.handleUploadError, productController_1.createProduct);
// PUT /api/v1/products/:id - Actualizar producto (máximo 4 imágenes)
router.put("/:id", upload_1.uploadProductImages, upload_1.handleUploadError, productController_1.updateProduct);
// DELETE /api/v1/products/:id - Eliminar producto
router.delete("/:id", productController_1.deleteProduct);
// PUT /api/v1/products/:id/stock - Actualizar stock específicamente
router.put("/:id/stock", productController_1.updateStock);
exports.default = router;
