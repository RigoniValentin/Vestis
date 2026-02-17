"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoticeService = void 0;
const Notice_1 = __importDefault(require("@models/Notice"));
class NoticeService {
    /**
     * Crear un nuevo aviso
     */
    async createNotice(noticeData, createdBy) {
        const notice = new Notice_1.default({
            ...noticeData,
            createdBy,
        });
        const savedNotice = await notice.save();
        return (await Notice_1.default.findById(savedNotice._id)
            .populate("createdBy", "name email")
            .exec());
    }
    /**
     * Obtener todos los avisos (solo admin)
     */
    async getAllNotices(queryParams) {
        const { type, isActive, includeExpired = true, limit = 50, page = 1, } = queryParams;
        const filter = {};
        // Filtros opcionales
        if (type)
            filter.type = type;
        if (isActive !== undefined)
            filter.isActive = isActive;
        // Filtro para excluir expirados si se especifica
        if (!includeExpired) {
            const now = new Date();
            filter.$or = [{ endDate: null }, { endDate: { $gte: now } }];
        }
        const skip = (page - 1) * limit;
        const notices = await Notice_1.default.find(filter)
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        return notices.map((notice) => ({
            ...notice,
            _id: notice._id.toString(),
            createdBy: {
                _id: notice.createdBy._id.toString(),
                name: notice.createdBy.name,
                email: notice.createdBy.email,
            },
        }));
    }
    /**
     * Obtener avisos activos y vigentes
     */
    async getActiveNotices() {
        const now = new Date();
        const notices = await Notice_1.default.find({
            isActive: true,
            $or: [
                // Sin fechas límite
                { startDate: null, endDate: null },
                // Solo con endDate válida
                { startDate: null, endDate: { $gte: now } },
                // Solo con startDate válida
                { startDate: { $lte: now }, endDate: null },
                // Con ambas fechas válidas
                { startDate: { $lte: now }, endDate: { $gte: now } },
            ],
        })
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .lean();
        return notices.map((notice) => ({
            ...notice,
            _id: notice._id.toString(),
            createdBy: {
                _id: notice.createdBy._id.toString(),
                name: notice.createdBy.name,
                email: notice.createdBy.email,
            },
        }));
    }
    /**
     * Obtener aviso por ID
     */
    async getNoticeById(id) {
        return await Notice_1.default.findById(id).populate("createdBy", "name email").exec();
    }
    /**
     * Actualizar aviso
     */
    async updateNotice(id, updateData) {
        // Obtener el aviso actual para validaciones
        const currentNotice = await Notice_1.default.findById(id);
        if (!currentNotice) {
            return null;
        }
        // Validar fechas si se proporcionan
        const newStartDate = updateData.startDate !== undefined
            ? updateData.startDate
                ? new Date(updateData.startDate)
                : null
            : currentNotice.startDate;
        const newEndDate = updateData.endDate !== undefined
            ? updateData.endDate
                ? new Date(updateData.endDate)
                : null
            : currentNotice.endDate;
        // Validar que las fechas sean consistentes
        if (newStartDate && newEndDate && newStartDate > newEndDate) {
            throw new Error("La fecha de inicio debe ser anterior a la fecha de fin");
        }
        // Realizar la actualización
        return await Notice_1.default.findByIdAndUpdate(id, { ...updateData, updatedAt: new Date() }, { new: true, runValidators: false } // Usamos validación manual
        ).populate("createdBy", "name email");
    }
    /**
     * Eliminar aviso permanentemente
     */
    async deleteNotice(id) {
        const result = await Notice_1.default.findByIdAndDelete(id);
        return !!result;
    }
    /**
     * Alternar estado activo/inactivo
     */
    async toggleNoticeStatus(id) {
        const notice = await Notice_1.default.findById(id);
        if (!notice) {
            return null;
        }
        notice.isActive = !notice.isActive;
        await notice.save();
        return await Notice_1.default.findById(id).populate("createdBy", "name email").exec();
    }
    /**
     * Obtener estadísticas de avisos
     */
    async getNoticeStats() {
        const now = new Date();
        // Total de avisos
        const total = await Notice_1.default.countDocuments();
        // Avisos activos
        const active = await Notice_1.default.countDocuments({ isActive: true });
        // Avisos por tipo
        const typeStats = await Notice_1.default.aggregate([
            { $group: { _id: "$type", count: { $sum: 1 } } },
        ]);
        const byType = {
            info: 0,
            warning: 0,
            urgent: 0,
            success: 0,
        };
        typeStats.forEach((stat) => {
            if (stat._id in byType) {
                byType[stat._id] = stat.count;
            }
        });
        // Avisos expirados
        const expired = await Notice_1.default.countDocuments({
            isActive: true,
            endDate: { $lt: now },
        });
        // Avisos programados (con startDate futura)
        const scheduled = await Notice_1.default.countDocuments({
            isActive: true,
            startDate: { $gt: now },
        });
        return {
            total,
            active,
            byType,
            expired,
            scheduled,
        };
    }
    /**
     * Obtener avisos urgentes activos
     */
    async getUrgentNotices() {
        const now = new Date();
        const notices = await Notice_1.default.find({
            isActive: true,
            type: "urgent",
            $or: [
                { startDate: null, endDate: null },
                { startDate: null, endDate: { $gte: now } },
                { startDate: { $lte: now }, endDate: null },
                { startDate: { $lte: now }, endDate: { $gte: now } },
            ],
        })
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 })
            .lean();
        return notices.map((notice) => ({
            ...notice,
            _id: notice._id.toString(),
            createdBy: {
                _id: notice.createdBy._id.toString(),
                name: notice.createdBy.name,
                email: notice.createdBy.email,
            },
        }));
    }
    /**
     * Limpiar avisos expirados automáticamente
     */
    async cleanupExpiredNotices() {
        const now = new Date();
        const result = await Notice_1.default.deleteMany({
            isActive: false,
            endDate: { $lt: now },
            // Solo eliminar avisos inactivos que han estado expirados por más de 30 días
            updatedAt: { $lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        });
        return result.deletedCount || 0;
    }
}
exports.NoticeService = NoticeService;
