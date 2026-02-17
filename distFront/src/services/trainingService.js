"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingService = void 0;
class TrainingService {
    constructor(trainingRepository) {
        this.trainingRepository = trainingRepository;
    }
    async createTraining(trainingData) {
        return this.trainingRepository.create(trainingData);
    }
    async updateCupos(id, cupos) {
        return this.trainingRepository.update(id, { cupos });
    }
    async getTrainingById(id) {
        return this.trainingRepository.findById(id);
    }
    // Método opcional para devolver solo el campo cupos:
    async getCupos(id) {
        const training = await this.trainingRepository.findById(id);
        return training ? training.cupos : null;
    }
    async getAllTrainings() {
        return this.trainingRepository.findAll();
    }
}
exports.TrainingService = TrainingService;
