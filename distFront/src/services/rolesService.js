"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
class RolesService {
    constructor(rolesRepository) {
        this.rolesRepository = rolesRepository;
    }
    async createRoles(roles) {
        return this.rolesRepository.create(roles);
    }
    async findRoles(query) {
        return this.rolesRepository.find(query);
    }
    async findRolesById(id) {
        return this.rolesRepository.findById(id);
    }
    async updateRoles(id, roles) {
        return this.rolesRepository.update(id, roles);
    }
    async deleteRoles(id) {
        return this.rolesRepository.delete(id);
    }
}
exports.RolesService = RolesService;
