"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingRepository = void 0;
const Training_1 = require("@models/Training");
class TrainingRepository {
    async create(trainingData) {
        const training = new Training_1.TrainingModel(trainingData);
        return await training.save();
    }
    async find(query) {
        return await Training_1.TrainingModel.find(query || {}).exec();
    }
    async findById(id) {
        return await Training_1.TrainingModel.findById(id).exec();
    }
    async update(id, data) {
        return await Training_1.TrainingModel.findByIdAndUpdate(id, data, {
            new: true,
        }).exec();
    }
    async findAll() {
        return await Training_1.TrainingModel.find().exec();
    }
}
exports.TrainingRepository = TrainingRepository;
