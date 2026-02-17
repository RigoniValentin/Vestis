"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoles = exports.updateRoles = exports.createRoles = exports.findRolesById = exports.findRoles = void 0;
const rolesRepository_1 = require("@repositories/rolesRepository");
const rolesService_1 = require("@services/rolesService");
const rolesRepository = new rolesRepository_1.RolesRepository();
const rolesService = new rolesService_1.RolesService(rolesRepository);
const findRoles = async (req, res) => {
    try {
        const roles = await rolesService.findRoles();
        if (roles.length === 0) {
            res.status(404).json({ message: "No roles found" });
            return;
        }
        res.json(roles);
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(500).json(error);
    }
};
exports.findRoles = findRoles;
const findRolesById = async (req, res) => {
    try {
        const roles = await rolesService.findRolesById(req.params.id);
        if (!roles) {
            res.status(404).json({ message: "Not role found" });
            return;
        }
        res.json(roles);
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(500).json(error);
    }
};
exports.findRolesById = findRolesById;
const createRoles = async (req, res) => {
    try {
        const newRole = req.body;
        const result = await rolesService.createRoles(newRole);
        res.status(201).json(result);
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(400).json(error);
    }
};
exports.createRoles = createRoles;
const updateRoles = async (req, res) => {
    try {
        const roles = await rolesService.updateRoles(req.params.id, req.body);
        if (!roles) {
            res.status(404).json({ message: "Not role found" });
            return;
        }
        res.json(roles);
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(500).json(error);
    }
};
exports.updateRoles = updateRoles;
const deleteRoles = async (req, res) => {
    try {
        const roles = await rolesService.deleteRoles(req.params.id);
        if (!roles) {
            res.status(404).json({ message: "Not role found" });
            return;
        }
        res.json(roles);
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(500).json(error);
    }
};
exports.deleteRoles = deleteRoles;
