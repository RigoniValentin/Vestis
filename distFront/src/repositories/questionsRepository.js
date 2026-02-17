"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionRepository = void 0;
const Question_1 = require("@models/Question");
class QuestionRepository {
    async create(data) {
        const newQuestion = new Question_1.QuestionModel(data);
        return await newQuestion.save();
    }
    async find(query) {
        return await Question_1.QuestionModel.find(query || {})
            .populate("user")
            .exec();
    }
    async findById(id) {
        return await Question_1.QuestionModel.findById(id).populate("user").exec();
    }
    async update(id, data) {
        return await Question_1.QuestionModel.findByIdAndUpdate(id, data, {
            new: true,
        })
            .populate("user")
            .exec();
    }
    async delete(id) {
        const deleted = await Question_1.QuestionModel.findByIdAndDelete(id).exec();
        return deleted !== null;
    }
    async count(query) {
        return await Question_1.QuestionModel.countDocuments(query).exec();
    }
}
exports.QuestionRepository = QuestionRepository;
