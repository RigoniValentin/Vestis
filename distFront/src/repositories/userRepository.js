"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const Users_1 = require("@models/Users");
class UserRepository {
    async create(data) {
        const newUser = new Users_1.UserModel(data);
        return await newUser.save();
    }
    async find(query) {
        // The find() method returns documents including 'createdAt' due to timestamps in the schema.
        return await Users_1.UserModel.find(query || {})
            .populate("roles")
            .exec();
    }
    async findOne(query) {
        return await Users_1.UserModel.findOne(query).populate("roles").exec();
    }
    async findById(id) {
        return await Users_1.UserModel.findById(id).populate("roles").exec();
    }
    async update(id, data) {
        return await Users_1.UserModel.findByIdAndUpdate(id, data, { new: true })
            .populate("roles")
            .exec();
    }
    async delete(id) {
        const deleted = await Users_1.UserModel.findByIdAndDelete(id).exec();
        return deleted !== null;
    }
}
exports.UserRepository = UserRepository;
