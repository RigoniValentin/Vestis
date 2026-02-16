import { Request, Response } from "express";
import { NoticeService } from "@services/noticeService";
import {
  CreateNoticeRequest,
  UpdateNoticeRequest,
  NoticeQueryParams,
} from "../types/NoticeTypes";

const noticeService = new NoticeService();

export class NoticeController {
  /**
   * GET /api/v1/notices
   * Obtener todos los avisos (solo admin)
   */
  static async getAllNotices(req: Request, res: Response): Promise<void> {
    try {
      const queryParams: NoticeQueryParams = {
        type: req.query.type as any,
        isActive:
          req.query.isActive !== undefined
            ? req.query.isActive === "true"
            : undefined,
        includeExpired: req.query.includeExpired !== "false",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
      };

      const notices = await noticeService.getAllNotices(queryParams);

      res.json({
        success: true,
        data: notices,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          total: notices.length,
        },
      });
    } catch (error) {
      console.error("Error getting all notices:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los avisos",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * GET /api/v1/notices/active
   * Obtener solo avisos activos y vigentes (cualquier usuario autenticado)
   */
  static async getActiveNotices(req: Request, res: Response): Promise<void> {
    try {
      const notices = await noticeService.getActiveNotices();

      res.json({
        success: true,
        data: notices,
        count: notices.length,
      });
    } catch (error) {
      console.error("Error getting active notices:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los avisos activos",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * GET /api/v1/notices/urgent
   * Obtener solo avisos urgentes activos
   */
  static async getUrgentNotices(req: Request, res: Response): Promise<void> {
    try {
      const notices = await noticeService.getUrgentNotices();

      res.json({
        success: true,
        data: notices,
        count: notices.length,
      });
    } catch (error) {
      console.error("Error getting urgent notices:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los avisos urgentes",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * GET /api/v1/notices/:id
   * Obtener aviso por ID
   */
  static async getNoticeById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const notice = await noticeService.getNoticeById(id);

      if (!notice) {
        res.status(404).json({
          success: false,
          message: "Aviso no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        data: notice,
      });
    } catch (error) {
      console.error("Error getting notice by ID:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener el aviso",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * POST /api/v1/notices
   * Crear nuevo aviso (solo admin)
   */
  static async createNotice(req: Request, res: Response): Promise<void> {
    try {
      const noticeData: CreateNoticeRequest = req.body;
      const createdBy = req.currentUser.id;

      // Validaciones adicionales
      if (!noticeData.title || !noticeData.message) {
        res.status(400).json({
          success: false,
          message: "Los campos title y message son requeridos",
        });
        return;
      }

      // Validar fechas si se proporcionan
      if (noticeData.startDate) {
        const startDate = new Date(noticeData.startDate);
        if (isNaN(startDate.getTime())) {
          res.status(400).json({
            success: false,
            message: "La fecha de inicio no es válida",
          });
          return;
        }
      }

      if (noticeData.endDate) {
        const endDate = new Date(noticeData.endDate);
        if (isNaN(endDate.getTime())) {
          res.status(400).json({
            success: false,
            message: "La fecha de fin no es válida",
          });
          return;
        }
      }

      // Validar que endDate sea posterior a startDate si ambas están presentes
      if (noticeData.startDate && noticeData.endDate) {
        const startDate = new Date(noticeData.startDate);
        const endDate = new Date(noticeData.endDate);
        if (endDate <= startDate) {
          res.status(400).json({
            success: false,
            message: "La fecha de fin debe ser posterior a la fecha de inicio",
          });
          return;
        }
      }

      const notice = await noticeService.createNotice(noticeData, createdBy);

      res.status(201).json({
        success: true,
        message: "Aviso creado exitosamente",
        data: notice,
      });
    } catch (error) {
      console.error("Error creating notice:", error);
      res.status(500).json({
        success: false,
        message: "Error al crear el aviso",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * PUT /api/v1/notices/:id
   * Actualizar aviso existente (solo admin)
   */
  static async updateNotice(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const updateData: UpdateNoticeRequest = req.body;

      // Validar fechas si se proporcionan
      if (updateData.startDate && updateData.startDate !== null) {
        const startDate = new Date(updateData.startDate);
        if (isNaN(startDate.getTime())) {
          res.status(400).json({
            success: false,
            message: "La fecha de inicio no es válida",
          });
          return;
        }
      }

      if (updateData.endDate && updateData.endDate !== null) {
        const endDate = new Date(updateData.endDate);
        if (isNaN(endDate.getTime())) {
          res.status(400).json({
            success: false,
            message: "La fecha de fin no es válida",
          });
          return;
        }
      }

      // Validación adicional si ambas fechas están presentes en la actualización
      if (updateData.startDate && updateData.endDate) {
        const startDate = new Date(updateData.startDate);
        const endDate = new Date(updateData.endDate);
        if (endDate <= startDate) {
          res.status(400).json({
            success: false,
            message: "La fecha de fin debe ser posterior a la fecha de inicio",
          });
          return;
        }
      }

      const notice = await noticeService.updateNotice(id, updateData);

      if (!notice) {
        res.status(404).json({
          success: false,
          message: "Aviso no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: "Aviso actualizado exitosamente",
        data: notice,
      });
    } catch (error) {
      console.error("Error updating notice:", error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar el aviso",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * DELETE /api/v1/notices/:id
   * Eliminar aviso permanentemente (solo admin)
   */
  static async deleteNotice(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const deleted = await noticeService.deleteNotice(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Aviso no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: "Aviso eliminado exitosamente",
      });
    } catch (error) {
      console.error("Error deleting notice:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar el aviso",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * PATCH /api/v1/notices/:id/toggle
   * Alternar estado activo/inactivo del aviso (solo admin)
   */
  static async toggleNoticeStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const notice = await noticeService.toggleNoticeStatus(id);

      if (!notice) {
        res.status(404).json({
          success: false,
          message: "Aviso no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: `Aviso ${
          notice.isActive ? "activado" : "desactivado"
        } exitosamente`,
        data: notice,
      });
    } catch (error) {
      console.error("Error toggling notice status:", error);
      res.status(500).json({
        success: false,
        message: "Error al cambiar el estado del aviso",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * GET /api/v1/notices/admin/stats
   * Obtener estadísticas de avisos (solo admin)
   */
  static async getNoticeStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await noticeService.getNoticeStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting notice stats:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las estadísticas",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * POST /api/v1/notices/admin/cleanup
   * Limpiar avisos expirados (solo admin)
   */
  static async cleanupExpiredNotices(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const deletedCount = await noticeService.cleanupExpiredNotices();

      res.json({
        success: true,
        message: `Se eliminaron ${deletedCount} avisos expirados`,
        data: { deletedCount },
      });
    } catch (error) {
      console.error("Error cleaning up notices:", error);
      res.status(500).json({
        success: false,
        message: "Error al limpiar avisos expirados",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
}
