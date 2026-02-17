"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const userService_1 = require("@services/userService");
const userRepository_1 = require("@repositories/userRepository");
const rolesService_1 = require("@services/rolesService");
const rolesRepository_1 = require("@repositories/rolesRepository"); // Importar RolesRepository
// Instanciar servicios
const userRepository = new userRepository_1.UserRepository();
const userService = new userService_1.UserService(userRepository);
const rolesRepository = new rolesRepository_1.RolesRepository(); // Instanciar RolesRepository
const rolesService = new rolesService_1.RolesService(rolesRepository); // Pasarlo al constructor
node_cron_1.default.schedule("0 0 * * *", async () => {
    try {
        const users = await userService.findUsers();
        const now = new Date();
        for (const user of users) {
            // Omitir usuarios con el rol "admin"
            if (!user.roles?.some((role) => role.name === "admin") &&
                user.subscription &&
                user.subscription.expirationDate < now) {
                user.roles = user.roles || [];
                // Remover el rol "user" si existe
                user.roles = user.roles.filter((role) => role.name !== "user");
                // Obtener el rol "guest" desde la BD
                const guestRoles = await rolesService.findRoles({ name: "guest" });
                if (!guestRoles || guestRoles.length === 0) {
                    console.error("Rol 'guest' no encontrado");
                    continue;
                }
                user.roles.push(guestRoles[0]);
                await user.save();
            }
        }
        console.log("Cron job executed: User roles updated based on subscription expiration");
    }
    catch (error) {
        console.error("Error executing cron job:", error);
    }
});
