"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveExamples = exports.getExamples = void 0;
const Example_1 = require("@models/Example");
const getExamples = async (req, res) => {
    try {
        const { category } = req.query;
        if (!category ||
            !["conciencia", "biologia", "emociones"].includes(category)) {
            res.status(400).json({ message: "Categoría inválida" });
            return;
        }
        const doc = await Example_1.ExampleModel.findOne({ category });
        res.json(doc ? doc.examples : []);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error instanceof Error ? error.message : error });
    }
};
exports.getExamples = getExamples;
const saveExamples = async (req, res) => {
    try {
        const { category, examples } = req.body;
        if (!category ||
            !["conciencia", "biologia", "emociones"].includes(category)) {
            res.status(400).json({ message: "Categoría inválida" });
            return;
        }
        if (!Array.isArray(examples)) {
            res
                .status(400)
                .json({ message: "El campo examples debe ser un arreglo de strings" });
            return;
        }
        const updated = await Example_1.ExampleModel.findOneAndUpdate({ category }, { examples }, { new: true, upsert: true });
        res.json(updated);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error instanceof Error ? error.message : error });
    }
};
exports.saveExamples = saveExamples;
