"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSubscription = void 0;
const userRepository_1 = require("@repositories/userRepository");
const userService_1 = require("@services/userService");
// Crear una instancia de UserService
const userRepository = new userRepository_1.UserRepository();
const userService = new userService_1.UserService(userRepository);
const checkSubscription = async (req, res, next) => {
    const user = await userService.findUserById(req.currentUser.id);
    if (user) {
        // Si el usuario tiene el rol "admin", permitir el acceso sin verificar la suscripción
        if (user.roles && user.roles.some((role) => role.name === "admin")) {
            return next();
        }
        // Verificar la suscripción si el usuario no es "admin"
        if (user.subscription && user.subscription.expirationDate < new Date()) {
            if (user.roles && user.roles.length > 0) {
                // Actualiza el nombre del primer rol a "guest"
                user.roles[0].name = "guest";
            }
            await user.save();
        }
    }
    next();
};
exports.checkSubscription = checkSubscription;
