"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRole = exports.checkRoles = void 0;
const rolesRepository_1 = require("@repositories/rolesRepository");
const rolesService_1 = require("@services/rolesService");
const rolesRepository = new rolesRepository_1.RolesRepository();
const rolesService = new rolesService_1.RolesService(rolesRepository);
const checkRoles = async (req, res, next) => {
    const roles = req.body && req.body?.roles ? req.body.roles : [];
    const role = Array.isArray(roles) && roles.length != 0 ? roles : ["user"];
    console.log("req.body", role);
    try {
        const findRoles = await rolesService.findRoles({ name: { $in: role } });
        if (findRoles.length === 0) {
            res.status(404).json({ message: "Role not found" });
            return; // Retorna sin devolver un Response
        }
        req.body.roles = findRoles.map((x) => x._id);
        console.log("req.body.roles :>>", req.body.roles);
        next();
    }
    catch (error) {
        console.log("error :>>", error);
        res.status(500).json(error);
        return;
    }
};
exports.checkRoles = checkRoles;
/**
 * Middleware para verificar si el usuario tiene uno de los roles especificados
 */
const verifyRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const user = req.currentUser;
            if (!user || !user.roles) {
                res.status(403).json({
                    message: "Acceso denegado: No tienes permisos para realizar esta acción",
                });
                return;
            }
            // Verificar si el usuario tiene alguno de los roles permitidos
            const hasPermission = user.roles.some((userRole) => allowedRoles.includes(userRole.name));
            if (!hasPermission) {
                res.status(403).json({
                    message: `Acceso denegado: Se requiere uno de los siguientes roles: ${allowedRoles.join(", ")}`,
                });
                return;
            }
            next();
        }
        catch (error) {
            console.error("Error verifying role:", error);
            res.status(500).json({
                message: "Error interno del servidor al verificar permisos",
            });
            return;
        }
    };
};
exports.verifyRole = verifyRole;
