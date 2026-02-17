"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("@controllers/userController");
const rolesController_1 = require("@controllers/rolesController");
const authControllers_1 = require("@controllers/auth/authControllers");
const auth_1 = require("@middlewares/auth");
const roles_1 = require("@middlewares/roles");
const checkSubscription_1 = require("@middlewares/checkSubscription");
const questionController_1 = require("@controllers/questionController");
const videosController_1 = require("@controllers/videosController");
const trainingController_1 = require("@controllers/trainingController");
// Importar rutas de la tienda
const categoryRoutes_1 = __importDefault(require("./categoryRoutes"));
const productRoutes_1 = __importDefault(require("./productRoutes"));
const eventRoutes_1 = __importDefault(require("./eventRoutes"));
const noticeRoutes_1 = __importDefault(require("./noticeRoutes"));
const designRoutes_1 = __importDefault(require("./designRoutes"));
const tshirtTypeRoutes_1 = __importDefault(require("./tshirtTypeRoutes"));
const customOrderRoutes_1 = __importDefault(require("./customOrderRoutes"));
const tshirtConfigRoutes_1 = __importDefault(require("./tshirtConfigRoutes"));
const accessoryRoutes_1 = __importDefault(require("./accessoryRoutes"));
const paymentController_1 = require("@controllers/paymentController");
const emailService_1 = require("@services/emailService");
const exampleController_1 = require("@controllers/exampleController");
const chatController_1 = require("@controllers/chatController");
const router = (0, express_1.Router)();
exports.default = () => {
    router.get("/health", (req, res) => {
        res.send("Api is healthy");
    });
    //#region Auth Routes
    router.post("/auth/register", roles_1.checkRoles, authControllers_1.registerUser);
    router.post("/auth/login", authControllers_1.loginUser);
    router.get("/auth/refresh", auth_1.verifyToken, (req, res, next) => {
        res.set("Cache-Control", "no-store");
        next();
    }, authControllers_1.refreshToken);
    router.post("/auth/forgot-password", authControllers_1.forgotPassword);
    router.post("/auth/reset-password", authControllers_1.resetPassword);
    //#endregion
    //#region User Routes
    router.get("/users", auth_1.verifyToken, auth_1.getPermissions, userController_1.findUsers);
    router.get("/users/subscription-info", auth_1.verifyToken, auth_1.getPermissions, userController_1.getUsersSubscriptionInfo);
    router.get("/users/:id", auth_1.verifyToken, auth_1.getPermissions, userController_1.findUserById);
    router.post("/users", auth_1.verifyToken, auth_1.getPermissions, roles_1.checkRoles, userController_1.createUser);
    router.put("/users/:id", auth_1.verifyToken, auth_1.getPermissions, userController_1.updateUser);
    router.put("/users/:id/capacitations", auth_1.verifyToken, auth_1.getPermissions, userController_1.updateUserCapacitations);
    router.put("/users/email/:email/capacitations", auth_1.verifyToken, auth_1.getPermissions, userController_1.updateUserCapacitationsByEmail);
    router.delete("/users/:id", auth_1.verifyToken, auth_1.getPermissions, userController_1.deleteUser);
    //#endregion
    //#region Roles Routes
    router.get("/roles", auth_1.verifyToken, auth_1.getPermissions, rolesController_1.findRoles);
    router.get("/roles/:id", auth_1.verifyToken, auth_1.getPermissions, rolesController_1.findRolesById);
    router.post("/roles", auth_1.verifyToken, auth_1.getPermissions, rolesController_1.createRoles);
    router.put("/roles/:id", auth_1.verifyToken, auth_1.getPermissions, rolesController_1.updateRoles);
    router.delete("/roles/:id", auth_1.verifyToken, auth_1.getPermissions, rolesController_1.deleteRoles);
    //#endregion
    //#region Question Routes
    router.post("/questions", auth_1.verifyToken, checkSubscription_1.checkSubscription, auth_1.getPermissions, questionController_1.createQuestion);
    router.get("/questions", auth_1.verifyToken, checkSubscription_1.checkSubscription, auth_1.getPermissions, questionController_1.findQuestions);
    router.put("/questions/:id/answer/1", auth_1.verifyToken, checkSubscription_1.checkSubscription, auth_1.getPermissions, questionController_1.answerQuestionVideo1);
    router.put("/questions/:id/answer/2", auth_1.verifyToken, checkSubscription_1.checkSubscription, auth_1.getPermissions, questionController_1.answerQuestionVideo2);
    router.put("/questions/:id/reject", auth_1.verifyToken, questionController_1.rejectQuestion);
    //#endregion
    //#region Videos Routes
    router.post("/videos", auth_1.verifyToken, checkSubscription_1.checkSubscription, auth_1.getPermissions, roles_1.checkRoles, videosController_1.createVideo);
    router.get("/videos", videosController_1.findVideos);
    router.get("/videos/:id", videosController_1.findVideoById);
    router.put("/videos/:id", auth_1.verifyToken, auth_1.getPermissions, roles_1.checkRoles, videosController_1.updateVideo);
    router.put("/videos-by-combo", auth_1.verifyToken, auth_1.getPermissions, roles_1.checkRoles, videosController_1.updateVideoByCombo);
    router.delete("/videos/:id", auth_1.verifyToken, auth_1.getPermissions, roles_1.checkRoles, videosController_1.deleteVideo);
    router.delete("/videos", auth_1.verifyToken, auth_1.getPermissions, roles_1.checkRoles, videosController_1.deleteVideoByUrl);
    //#endregion
    // #region Trainings Routes
    router.post("/trainings", auth_1.verifyToken, auth_1.getPermissions, trainingController_1.createTraining);
    router.put("/trainings/:id", auth_1.verifyToken, auth_1.getPermissions, trainingController_1.updateCupos);
    router.get("/trainings/:id", auth_1.verifyToken, trainingController_1.getCupos);
    router.get("/trainings", trainingController_1.getTrainings);
    // #endregion
    // #region Payments Routes
    router.get("/create-order", auth_1.verifyToken, paymentController_1.createOrder);
    router.get("/capture-order", paymentController_1.captureOrder);
    router.get("/cancel-order", paymentController_1.cancelPayment);
    router.post("/create-preference", auth_1.verifyToken, paymentController_1.createPreference);
    router.get("/capture-preference", paymentController_1.capturePreference);
    // #endregion
    // #region Email Routes
    // Route para enviar email a través del helper
    router.post("/send-email", async (req, res) => {
        const { to, subject, text } = req.body;
        try {
            await (0, emailService_1.sendResetPasswordEmail)(to, text);
            res.status(200).send(`Email sent to: ${to}`);
        }
        catch (error) {
            res.status(500).send("Error sending email");
        }
    });
    // #endregion
    // #region Coupons Routes
    router.post("/apply-coupon", auth_1.verifyToken, paymentController_1.applyCoupon);
    router.get("/subscription-info", auth_1.verifyToken, paymentController_1.getSubscriptionInfo);
    router.post("/admin/extend-subscription", auth_1.verifyToken, paymentController_1.extendUserSubscription);
    router.post("/admin/update-subscription-expiration", auth_1.verifyToken, paymentController_1.updateSubscriptionExpiration);
    // #endregion
    // #region Example Routes
    router.get("/examples", exampleController_1.getExamples);
    router.put("/examples", exampleController_1.saveExamples);
    // #endregion
    // #region Chat Routes
    // Obtener historial (para todos los usuarios)
    router.get("/history", auth_1.verifyToken, chatController_1.getChatHistory);
    // Eliminar historial (acceso restringido, por ejemplo admin)
    router.delete("/history", auth_1.verifyToken, auth_1.getPermissions, chatController_1.deleteChatHistory);
    // #endregion
    // #region Store Routes
    // Rutas de categorías de la tienda
    router.use("/categories", categoryRoutes_1.default);
    // Rutas de productos de la tienda
    router.use("/products", productRoutes_1.default);
    // Rutas de diseños/estampas para remeras personalizadas
    router.use("/designs", designRoutes_1.default);
    // Rutas de tipos de remeras/musculosas
    router.use("/tshirt-types", tshirtTypeRoutes_1.default);
    // Rutas de órdenes personalizadas
    router.use("/custom-orders", customOrderRoutes_1.default);
    // Rutas de configuraciones de remeras personalizadas
    router.use("/tshirt-configs", tshirtConfigRoutes_1.default);
    // Rutas de accesorios
    router.use("/accessories", accessoryRoutes_1.default);
    // #endregion
    // #region Events Routes
    // Rutas de eventos/cronograma
    router.use("/events", eventRoutes_1.default);
    // #endregion
    // #region Notices Routes
    // Rutas de avisos importantes
    router.use("/notices", noticeRoutes_1.default);
    // #endregion
    return router;
};
