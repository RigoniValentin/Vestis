"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermissions = exports.verifyToken = void 0;
const userRepository_1 = require("@repositories/userRepository");
const userService_1 = require("@services/userService");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const PermissionsType_1 = require("types/PermissionsType");
const userRepository = new userRepository_1.UserRepository();
const userService = new userService_1.UserService(userRepository);
const verifyToken = async (req, res, next) => {
    const jwtSecret = process.env.JWT_SECRET;
    const token = req.headers.authorization?.replace("Bearer ", "") ||
        req.query.authToken; // Leer el token de la URL
    if (!token) {
        res.status(401).json({ message: "JWT must be provided" });
        return;
    }
    try {
        const verify = jsonwebtoken_1.default.verify(token, jwtSecret);
        const getUser = await userService.findUserById(verify.id);
        if (!getUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        req.currentUser = getUser;
        console.log("Token verified, user:", req.currentUser);
        next();
    }
    catch (error) {
        console.log("error :>> ", error);
        res.status(401).send(error.message);
    }
};
exports.verifyToken = verifyToken;
const getPermissions = async (req, res, next) => {
    // - Obtener lo roles, (desde currentUser) y el Metodo HTTP de la petición
    const { currentUser, method, path } = req;
    const { roles } = currentUser;
    console.log("currentUser :>> ", currentUser);
    // - Obtener el path/modulos (usuarios - roles - posts)
    const currentModule = path.split("/")[1];
    console.log("currentModule :>> ", currentModule);
    // - Conseguir en los permisos el metodo que coincida para obtener el objeto que contiene el scope
    const findMethod = PermissionsType_1.permissions.find((p) => p.method === PermissionsType_1.Method[method]);
    // - Armar el permiso correspondiente al scope en le momento de la petición
    if (!findMethod?.permissions.includes(`${currentModule}_${findMethod.scope}`)) {
        findMethod?.permissions.push(`${currentModule}_${findMethod.scope}`);
    }
    console.log("findMethod :>> ", findMethod);
    // - obtener todos los permisos de los roles del usuario
    const mergedRolesPermissions = [
        ...new Set(roles?.flatMap((role) => role.permissions)),
    ];
    console.log("mergedRolesPermissions :>> ", mergedRolesPermissions);
    //- Verificar si el usuario Tiene Permisos
    //- Tienen mayor prioridad q los permisos de los roles
    let userPermissions = [];
    if (currentUser.permissions?.length == 0) {
        userPermissions = currentUser.permissions;
    }
    else {
        userPermissions = mergedRolesPermissions;
    }
    // - Comparar los permisos armados en el scope con los permisos del ususario
    const permissionGranted = findMethod?.permissions.find((x) => mergedRolesPermissions.includes(x));
    console.log("permissionGranted :>> ", permissionGranted);
    // - si no hay match, regresamos un error unauthorized
    if (!permissionGranted) {
        res.status(401).send("Unauthorized");
        return;
    }
    // - si todo bien next()
    next();
};
exports.getPermissions = getPermissions;
