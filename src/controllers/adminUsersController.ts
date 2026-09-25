import { Request, Response } from "express";
import { UserRepository } from "@repositories/userRepository";
import { UserService } from "@services/userService";
import { RolesRepository } from "@repositories/rolesRepository";
import { RolesService } from "@services/rolesService";
import { IUserRepository, IUserService, User } from "types/UserTypes";
import { IRolesRepository, IRolesService } from "types/RolesTypes";
import { DocumentaryPurchaseModel } from "@models/DocumentaryPurchase";
import { DocumentaryModel } from "@models/Documentary";
import {
  resetDocumentaryPlayCounter,
} from "@controllers/documentaryController";

const userRepository: IUserRepository = new UserRepository();
const userService: IUserService = new UserService(userRepository);

const rolesRepository: IRolesRepository = new RolesRepository();
const rolesService: IRolesService = new RolesService(rolesRepository);

const DEFAULT_DOCUMENTARY_SLUG = "humano-existes";

const ensureTargetUser = async (
  res: Response,
  id: string
): Promise<User | null> => {
  const user = await userService.findUserById(id);
  if (!user) {
    res.status(404).json({ success: false, message: "Usuario no encontrado" });
    return null;
  }
  return user;
};

const targetHasAdminRole = (target: User): boolean => {
  if (!target || !Array.isArray(target.roles)) return false;
  return (target.roles as any[]).some(
    (r) => r && (r.name === "admin" || r.name === "superadmin")
  );
};

/**
 * GET /admin/users?q&status&role&page&limit
 */
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, status, role } = req.query;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "25", 10);

    const filter = {
      q: q ? String(q) : undefined,
      status: (status as any) || "all",
      role: role ? String(role) : undefined,
      page,
      limit,
    };

    const result = await userService.listUsersAdmin(filter as any);

    res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit) || 1,
      },
    });
  } catch (error) {
    console.error("listUsers error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /admin/users/:id
 */
export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const detail = await userService.getUserDetailAdmin(req.params.id);
    if (!detail) {
      res.status(404).json({ success: false, message: "Usuario no encontrado" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (error) {
    console.error("getUser error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * POST /admin/users
 * Crea un usuario nuevo. El body debe incluir name, username, email, password.
 * Opcionalmente roles[] con nombres de rol.
 */
export const createUserAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, username, email, password, roles, ...rest } = req.body || {};
    if (!name || !username || !email || !password) {
      res.status(400).json({
        success: false,
        message: "name, username, email y password son requeridos",
      });
      return;
    }

    const exists = await userService.findUserByEmail(email);
    if (exists) {
      res
        .status(400)
        .json({ success: false, message: "Ya existe un usuario con ese email" });
      return;
    }

    let roleIds: any[] = [];
    if (Array.isArray(roles) && roles.length > 0) {
      const found = await rolesService.findRoles({ name: { $in: roles } });
      if (found.length === 0) {
        res.status(400).json({
          success: false,
          message: `Roles no encontrados: ${roles.join(", ")}`,
        });
        return;
      }
      roleIds = found.map((r) => r._id);
    } else {
      const guestRole = await rolesService.findRoles({ name: "user" });
      roleIds = guestRole.map((r) => r._id);
    }

    const created = await userService.createUser({
      name,
      username,
      email,
      password,
      roles: roleIds as any,
      ...rest,
    } as User);

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("createUserAdmin error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al crear el usuario" });
  }
};

/**
 * PUT /admin/users/:id
 * Edita datos de perfil (NO suscripción, NO roles, NO password).
 */
export const updateUserAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const target = await ensureTargetUser(res, id);
    if (!target) return;

    const allowed: (keyof User)[] = [
      "name",
      "username",
      "email",
      "bio",
      "avatarUrl",
      "nationality",
      "locality",
      "age",
    ];
    const update: Partial<User> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (update as any)[key] = req.body[key];
      }
    }

    if (update.email && update.email !== target.email) {
      const dup = await userService.findUserByEmail(update.email);
      if (dup && String(dup._id) !== String(target._id)) {
        res
          .status(400)
          .json({ success: false, message: "Ese email ya está en uso" });
        return;
      }
    }

    const updated = await userService.updateUserProfile(id, update);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updateUserAdmin error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar el usuario" });
  }
};

/**
 * PUT /admin/users/:id/roles
 * Body: { roles: string[] } con nombres de rol.
 */
export const updateUserRolesAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { roles } = req.body || {};
    if (!Array.isArray(roles)) {
      res.status(400).json({
        success: false,
        message: "roles debe ser un array de nombres de rol",
      });
      return;
    }

    const target = await ensureTargetUser(res, id);
    if (!target) return;

    const adminId = String(req.currentUser._id || req.currentUser.id);
    const isSelf = userService.isSelf(id, adminId);
    // admin o superadmin, lo impedimos.
    const hasAdminRole = targetHasAdminRole(target);
    const newRolesContainAdmin = roles.some(
      (r) => r === "admin" || r === "superadmin"
    );
    if (isSelf && hasAdminRole && !newRolesContainAdmin) {
      res.status(400).json({
        success: false,
        message:
          "No podés sacarte a vos mismo el rol admin/superadmin desde el panel.",
      });
      return;
    }

    const updated = await userService.assignRolesByName(id, roles);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("updateUserRolesAdmin error:", error);
    res.status(400).json({
      success: false,
      message: error?.message || "Error al actualizar roles",
    });
  }
};

/**
 * PUT /admin/users/:id/password
 * Body: { password: string }
 */
export const resetUserPasswordAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      });
      return;
    }

    const target = await ensureTargetUser(res, id);
    if (!target) return;

    const updated = await userService.resetUserPassword(id, password);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("resetUserPasswordAdmin error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * PUT /admin/users/:id/subscription
 * Body: { paymentDate?, expirationDate, transactionId? }
 */
export const setUserSubscriptionAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentDate, expirationDate, transactionId } = req.body || {};

    if (!expirationDate) {
      res.status(400).json({
        success: false,
        message: "expirationDate es requerido",
      });
      return;
    }

    const target = await ensureTargetUser(res, id);
    if (!target) return;

    const exp = new Date(expirationDate);
    if (isNaN(exp.getTime())) {
      res
        .status(400)
        .json({ success: false, message: "expirationDate inválida" });
      return;
    }
    const pay = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(pay.getTime())) {
      res
        .status(400)
        .json({ success: false, message: "paymentDate inválida" });
      return;
    }

    const updated = await userService.updateUserSubscription(id, {
      paymentDate: pay,
      expirationDate: exp,
      transactionId: transactionId || target.subscription?.transactionId,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("setUserSubscriptionAdmin error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * DELETE /admin/users/:id/subscription
 * Cancela la suscripción del usuario.
 */
export const cancelUserSubscriptionAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const target = await ensureTargetUser(res, id);
    if (!target) return;

    const updated = await userService.cancelUserSubscription(id);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("cancelUserSubscriptionAdmin error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * DELETE /admin/users/:id
 * Soft delete.
 */
export const softDeleteUserAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const target = await ensureTargetUser(res, id);
    if (!target) return;

    const adminId = String(req.currentUser._id || req.currentUser.id);
    const isSelf = userService.isSelf(id, adminId);

    if (isSelf) {
      res.status(400).json({
        success: false,
        message: "No podés darte de baja a vos mismo.",
      });
      return;
    }

    const updated = await userService.softDeleteUser(id, adminId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("softDeleteUserAdmin error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * POST /admin/users/:id/restore
 */
export const restoreUserAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await userService.restoreUser(id);
    if (!updated) {
      res.status(404).json({ success: false, message: "Usuario no encontrado" });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("restoreUserAdmin error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * GET /admin/users/:id/documentary-access
 * Devuelve las compras del usuario para todos los slugs de documentales.
 */
export const getUserDocumentaryAccess = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const detail = await userService.getUserDetailAdmin(id);
    if (!detail) {
      res.status(404).json({ success: false, message: "Usuario no encontrado" });
      return;
    }
    res.json({ success: true, data: detail.documentaryPurchases });
  } catch (error) {
    console.error("getUserDocumentaryAccess error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * POST /admin/users/:id/documentary-access
 * Body: { slug?: string }
 * Otorga acceso al documental para el usuario.
 */
export const grantUserDocumentaryAccessAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const slug = (req.body?.slug as string) || DEFAULT_DOCUMENTARY_SLUG;

    const target = await ensureTargetUser(res, id);
    if (!target) return;

    const doc = await DocumentaryModel.findOne({ slug: slug.toLowerCase() });
    if (!doc) {
      res
        .status(404)
        .json({ success: false, message: `Documental ${slug} no encontrado` });
      return;
    }

    const adminId = String(req.currentUser.id);

    const purchase = await DocumentaryPurchaseModel.create({
      userId: target._id,
      documentarySlug: slug.toLowerCase(),
      method: "admin",
      amount: 0,
      currency: doc.currency || "ARS",
      status: "approved",
      paidAt: new Date(),
      reviewedBy: adminId,
      reviewedAt: new Date(),
      adminNotes: `Otorgado por admin ${req.currentUser.email || ""}`,
    });

    await resetDocumentaryPlayCounter(String(target._id), slug.toLowerCase());

    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error("grantUserDocumentaryAccessAdmin error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

/**
 * DELETE /admin/users/:id/documentary-access/:purchaseId
 * Revoca acceso al documental (marca refunded).
 */
export const revokeUserDocumentaryAccessAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, purchaseId } = req.params;

    const purchase = await DocumentaryPurchaseModel.findOneAndUpdate(
      { _id: purchaseId, userId: id },
      { $set: { status: "refunded" } },
      { new: true }
    );

    if (!purchase) {
      res.status(404).json({
        success: false,
        message: "Compra no encontrada para este usuario",
      });
      return;
    }

    await resetDocumentaryPlayCounter(
      String(purchase.userId),
      purchase.documentarySlug
    );

    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error("revokeUserDocumentaryAccessAdmin error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};
