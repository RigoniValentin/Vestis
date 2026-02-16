import { Request, Response } from "express";
import { EventService } from "@services/eventService";
import {
  CreateEventRequest,
  UpdateEventRequest,
  EventQueryParams,
} from "../types/EventTypes";

const eventService = new EventService();

export class EventController {
  /**
   * GET /api/v1/events
   * Obtener todos los eventos activos con filtros opcionales
   */
  static async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const queryParams: EventQueryParams = {
        type: req.query.type as any,
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        month: req.query.month
          ? parseInt(req.query.month as string)
          : undefined,
        category: req.query.category as string,
        instructor: req.query.instructor as string,
        isActive: req.query.isActive !== "false", // Por defecto true
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
      };

      const events = await eventService.getEvents(queryParams);

      res.json({
        success: true,
        data: events,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          total: events.length,
        },
      });
    } catch (error) {
      console.error("Error getting events:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los eventos",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * GET /api/v1/events/month/:year/:month
   * Obtener eventos de un mes específico incluyendo recurrentes
   */
  static async getEventsByMonth(req: Request, res: Response): Promise<void> {
    try {
      const year = parseInt(req.params.year as string);
      const month = parseInt(req.params.month as string);

      // Validaciones
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({
          success: false,
          message: "Año y mes deben ser números válidos (mes: 1-12)",
        });
        return;
      }

      const result = await eventService.getEventsByMonth(year, month);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error getting events by month:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los eventos del mes",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * GET /api/v1/events/:id
   * Obtener evento por ID
   */
  static async getEventById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const event = await eventService.getEventById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Evento no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      console.error("Error getting event by ID:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener el evento",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * POST /api/v1/events
   * Crear nuevo evento (solo admin)
   */
  static async createEvent(req: Request, res: Response): Promise<void> {
    try {
      const eventData: CreateEventRequest = req.body;
      const createdBy = req.currentUser.id;

      // Validaciones adicionales
      if (!eventData.title || !eventData.startDate || !eventData.type) {
        res.status(400).json({
          success: false,
          message: "Los campos title, startDate y type son requeridos",
        });
        return;
      }

      // Validar fechas
      const startDate = new Date(eventData.startDate);
      const endDate = eventData.endDate ? new Date(eventData.endDate) : null;

      if (isNaN(startDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "La fecha de inicio no es válida",
        });
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "La fecha de fin no es válida",
        });
        return;
      }

      if (endDate && endDate <= startDate) {
        res.status(400).json({
          success: false,
          message: "La fecha de fin debe ser posterior a la fecha de inicio",
        });
        return;
      }

      // Validar días recurrentes si es necesario
      if (
        eventData.isRecurring &&
        (!eventData.recurringDays || eventData.recurringDays.length === 0)
      ) {
        res.status(400).json({
          success: false,
          message: "Para eventos recurrentes debe especificar al menos un día",
        });
        return;
      }

      const event = await eventService.createEvent(eventData, createdBy);

      res.status(201).json({
        success: true,
        message: "Evento creado exitosamente",
        data: event,
      });
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({
        success: false,
        message: "Error al crear el evento",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * PUT /api/v1/events/:id
   * Actualizar evento existente (solo admin)
   */
  static async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const updateData: UpdateEventRequest = req.body;

      // Validar fechas si se proporcionan
      if (updateData.startDate) {
        const startDate = new Date(updateData.startDate);
        if (isNaN(startDate.getTime())) {
          res.status(400).json({
            success: false,
            message: "La fecha de inicio no es válida",
          });
          return;
        }
      }

      if (updateData.endDate) {
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

      const event = await eventService.updateEvent(id, updateData);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Evento no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: "Evento actualizado exitosamente",
        data: event,
      });
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar el evento",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * DELETE /api/v1/events/:id
   * Eliminar evento (soft delete, solo admin)
   */
  static async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const event = await eventService.deleteEvent(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Evento no encontrado",
        });
        return;
      }

      res.json({
        success: true,
        message: "Evento eliminado exitosamente",
        data: event,
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar el evento",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * GET /api/v1/events/stats
   * Obtener estadísticas de eventos (solo admin)
   */
  static async getEventStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await eventService.getEventStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting event stats:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las estadísticas",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
}
