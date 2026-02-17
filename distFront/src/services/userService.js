"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
class UserService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async createUser(user) {
        return this.userRepository.create(user);
    }
    async findUsers(query) {
        return this.userRepository.find(query);
    }
    async findUserById(id) {
        return this.userRepository.findById(id);
    }
    async findUserByEmail(email) {
        return this.userRepository.findOne({ email });
    }
    async findUserByResetToken(token) {
        return this.userRepository.findOne({ resetPasswordToken: token });
    }
    async updateUser(id, user) {
        return this.userRepository.update(id, user);
    }
    async deleteUser(id) {
        return this.userRepository.delete(id);
    }
    async hasActiveSubscription(userId) {
        const user = await this.findUserById(userId);
        if (!user || !user.subscription || !user.subscription.expirationDate) {
            return false;
        }
        // Comprueba si la fecha de expiración es mayor a la fecha actual
        return new Date(user.subscription.expirationDate) > new Date();
    }
    // Nuevo método para actualizar las capacitaciones por email
    async updateUserCapacitationsByEmail(email, capacitations) {
        const user = await this.findUserByEmail(email);
        if (!user) {
            return null;
        }
        return this.userRepository.update(user.id, capacitations);
    }
}
exports.UserService = UserService;
