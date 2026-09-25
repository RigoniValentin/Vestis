import { Query } from "types/RepositoryTypes";
import {
  AdminUserListFilter,
  AdminUserListItem,
  AdminUserDetail,
  IUserRepository,
  IUserService,
  User,
} from "types/UserTypes";
import { UserModel } from "../models/Users";

export class UserService implements IUserService {
  private userRepository: IUserRepository;

  constructor(userRepository: IUserRepository) {
    this.userRepository = userRepository;
  }

  async createUser(user: User): Promise<User> {
    return this.userRepository.create(user);
  }

  async findUsers(query?: Query): Promise<User[]> {
    return this.userRepository.find(query);
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ email });
  }

  async findUserByResetToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({ resetPasswordToken: token });
  }

  async updateUser(id: string, user: Partial<User>): Promise<User | null> {
    return this.userRepository.update(id, user);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userRepository.delete(id);
  }

  public async hasActiveSubscription(userId: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (!user || !user.subscription || !user.subscription.expirationDate) {
      return false;
    }
    // Comprueba si la fecha de expiración es mayor a la fecha actual
    return new Date(user.subscription.expirationDate) > new Date();
  }

  // Nuevo método para actualizar las capacitaciones por email
  async updateUserCapacitationsByEmail(
    email: string,
    capacitations: {
      capSeresArte: boolean;
      capThr: boolean;
      capPhr: boolean;
      capMat: boolean;
      capUor: boolean;
      capReh: boolean;
      capViv: boolean;
      capTELA: boolean;
      capNO_CONVENCIONAL: boolean;
      capDANZA_DRAGON: boolean;
      capPARADA_MANOS: boolean;
      capDANZA_AEREA_ARNES: boolean;
      capCUBO: boolean;
      capPOLE_AEREO: boolean;
      capRED: boolean;
      capCONTORSION: boolean;
      capARO: boolean;
      capACRO_TRAINING: boolean;
      capANCESTROS_AL_DESCUBIERTO: boolean;
    }
  ): Promise<User | null> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      return null;
    }
    return this.userRepository.update(user.id, capacitations);
  }

  async listUsersAdmin(
    filter: AdminUserListFilter
  ): Promise<{ items: AdminUserListItem[]; total: number; page: number; limit: number }> {
    const result = await this.userRepository.findPaginatedAdmin(filter);
    const projectedItems = (result.items as any[]).map((doc) =>
      this.projectUserToListItem(doc)
    );
    return {
      items: projectedItems,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getUserDetailAdmin(id: string): Promise<AdminUserDetail | null> {
    return this.userRepository.findDetailAdmin(id);
  }

  async updateUserProfile(
    id: string,
    profile: Partial<
      Pick<
        User,
        | "name"
        | "username"
        | "email"
        | "bio"
        | "avatarUrl"
        | "nationality"
        | "locality"
        | "age"
      >
    >
  ): Promise<User | null> {
    return this.userRepository.update(id, profile);
  }

  async updateUserSubscription(
    id: string,
    subscription: {
      paymentDate?: Date;
      expirationDate: Date;
      transactionId?: string;
    }
  ): Promise<User | null> {
    return this.userRepository.update(id, {
      subscription: {
        transactionId: subscription.transactionId,
        paymentDate: subscription.paymentDate || new Date(),
        expirationDate: subscription.expirationDate,
      },
    } as Partial<User>);
  }

  async cancelUserSubscription(id: string): Promise<User | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    user.subscription = undefined as any;
    await user.save();
    return user;
  }

  async softDeleteUser(id: string, deletedById: string): Promise<User | null> {
    return this.userRepository.softDelete(id, deletedById);
  }

  async restoreUser(id: string): Promise<User | null> {
    return this.userRepository.restore(id);
  }

  async resetUserPassword(
    id: string,
    newPassword: string
  ): Promise<User | null> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }
    return this.userRepository.updatePassword(id, newPassword);
  }

  async assignRolesByName(
    id: string,
    roleNames: string[]
  ): Promise<User | null> {
    const RolesModel = (await import("@models/Roles")).RolesModel;
    const foundRoles = await RolesModel.find({
      name: { $in: roleNames },
    }).exec();
    if (foundRoles.length !== roleNames.length) {
      const found = new Set(foundRoles.map((r) => r.name));
      const missing = roleNames.filter((n) => !found.has(n));
      throw new Error(`Roles inexistentes: ${missing.join(", ")}`);
    }
    return this.userRepository.update(id, {
      roles: foundRoles.map((r) => r._id) as any,
    });
  }

  isSelf(targetId: string, currentUserId: string): boolean {
    return String(targetId) === String(currentUserId);
  }

  private projectUserToListItem(doc: any): AdminUserListItem {
    const sub = doc.subscription;
    let subInfo: AdminUserListItem["subscription"] = null;
    if (sub) {
      const expiration =
        sub.expirationDate instanceof Date
          ? sub.expirationDate
          : sub.expirationDate
          ? new Date(sub.expirationDate)
          : null;
      const active = !!expiration && expiration > new Date();
      const daysRemaining = expiration
        ? Math.ceil(
            (expiration.getTime() - Date.now()) / (1000 * 3600 * 24)
          )
        : null;
      subInfo = {
        active,
        expired: expiration ? expiration <= new Date() : false,
        expiringSoon: active && daysRemaining !== null && daysRemaining <= 7,
        paymentDate: sub.paymentDate || null,
        expirationDate: expiration,
        transactionId: sub.transactionId || null,
        daysRemaining,
      };
    }
    const roleNames: string[] = (doc.roles || [])
      .map((r: any) => (r && typeof r === "object" ? r.name : null))
      .filter(Boolean) as string[];
    const primaryRole = roleNames[0] || "user";
    return {
      id: String(doc._id),
      name: doc.name,
      username: doc.username,
      email: doc.email,
      roleNames,
      primaryRole,
      createdAt: doc.createdAt,
      avatarUrl: doc.avatarUrl || null,
      subscription: subInfo,
      documentaryAccess: (doc.documentaryAccess || []).map((p: any) => ({
        slug: p.documentarySlug,
        status: p.status,
        method: p.method,
        paidAt: p.paidAt || null,
      })),
      deletedAt: doc.deletedAt || null,
    };
  }
}
