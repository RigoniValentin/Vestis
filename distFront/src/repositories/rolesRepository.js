"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesRepository = void 0;
const Roles_1 = require("@models/Roles");
class RolesRepository {
    async create(data) {
        const newRoles = new Roles_1.RolesModel(data);
        return await newRoles.save();
    }
    async find(query) {
        return await Roles_1.RolesModel.find(query || {}).exec();
    }
    async findById(id) {
        return await Roles_1.RolesModel.findById(id).exec();
    }
    async update(id, data) {
        return await Roles_1.RolesModel.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async delete(id) {
        const deleted = await Roles_1.RolesModel.findByIdAndDelete(id).exec();
        return deleted !== null;
    }
}
exports.RolesRepository = RolesRepository;
