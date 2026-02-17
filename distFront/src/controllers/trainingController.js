"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTraining = exports.getTrainings = exports.getCupos = exports.updateCupos = void 0;
const trainingService_1 = require("@services/trainingService");
const trainingRepository_1 = require("@repositories/trainingRepository");
const trainingService = new trainingService_1.TrainingService(new trainingRepository_1.TrainingRepository());
const updateCupos = async (req, res) => {
    try {
        const id = req.params.id;
        const { cupos } = req.body;
        if (typeof cupos !== "number") {
            res.status(400).json({ message: "El campo 'cupos' debe ser un número." });
            return;
        }
        const updatedTraining = await trainingService.updateCupos(id, cupos);
        if (!updatedTraining) {
            res.status(404).json({ message: "Capacitación no encontrada." });
            return;
        }
        res.json(updatedTraining);
    }
    catch (error) {
        res
            .status(500)
            .json({ message: error instanceof Error ? error.message : error });
    }
};
exports.updateCupos = updateCupos;
const getCupos = async (req, res) => {
    try {
        const id = req.params.id;
        const cupos = await trainingService.getCupos(id);
        if (cupos === null) {
            res.status(404).json({ message: "Capacitación no encontrada." });
            return;
        }
        res.json({ cupos });
    }
    catch (error) {
        res.status(500).json({
            message: error instanceof Error ? error.message : error,
        });
    }
};
exports.getCupos = getCupos;
const getTrainings = async (req, res) => {
    try {
        const trainings = await trainingService.getAllTrainings();
        res.json(trainings);
    }
    catch (error) {
        res.status(500).json({
            message: error instanceof Error ? error.message : error,
        });
    }
};
exports.getTrainings = getTrainings;
const createTraining = async (req, res) => {
    try {
        const { name, cupos } = req.body;
        if (!name || cupos === undefined) {
            res
                .status(400)
                .json({ message: "El nombre y la cantidad de cupos son requeridos." });
            return;
        }
        const training = await trainingService.createTraining({ name, cupos });
        res.status(201).json(training);
    }
    catch (error) {
        res.status(500).json({
            message: error instanceof Error ? error.message : error,
        });
    }
};
exports.createTraining = createTraining;
