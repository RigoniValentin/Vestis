import { Document } from "mongoose";
import { Query, Repository } from "./RepositoryTypes";
import { Roles } from "./RolesTypes";

export interface User extends Document {
  name: string;
  username: string;
  email: string;
  password: string;
  nationality: string;
  locality: string;
  age: number;
  roles?: Roles[];
  permissions?: string[];
  // Nuevos campos para capacitaciones:
  capSeresArte?: boolean;
  capThr?: boolean;
  capPhr?: boolean;
  capMat?: boolean;
  capUor?: boolean;
  capReh?: boolean;
  capViv?: boolean;
  capTELA?: boolean;
  capNO_CONVENCIONAL?: boolean;
  capDANZA_DRAGON?: boolean;
  capPARADA_MANOS?: boolean;
  capDANZA_AEREA_ARNES?: boolean;
  capCUBO?: boolean;
  capPOLE_AEREO?: boolean;
  capRED?: boolean;
  capCONTORSION?: boolean;
  capARO?: boolean;
  capACRO_TRAINING?: boolean;
  capANCESTROS_AL_DESCUBIERTO?: boolean;
  // Campos para la suscripción
  subscription?: {
    transactionId: string;
    paymentDate: Date;
    expirationDate: Date;
  };
  communityBonusGrantedAt?: Date;
  couponUsed?: boolean;
  avatarUrl?: string;
  bio?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  comparePassword(password: string): Promise<boolean>;
  createdAt: Date;
}

export interface IUserRepository extends Repository<User> {
  findOne(query: Query): Promise<User | null>;
  findByIdIncludingDeleted(id: string): Promise<User | null>;
  findPaginatedAdmin(filter: AdminUserListFilter): Promise<{
    items: User[];
    total: number;
    page: number;
    limit: number;
  }>;
  findDetailAdmin(id: string): Promise<AdminUserDetail | null>;
  softDelete(id: string, deletedById: string): Promise<User | null>;
  restore(id: string): Promise<User | null>;
  updatePassword(id: string, plainPassword: string): Promise<User | null>;
  findAllForSelect(limit?: number): Promise<User[]>;
}

export interface AdminUserListFilter {
  q?: string;
  status?: "active" | "expired" | "none" | "all";
  role?: string;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface IUserService {
  createUser(user: User): Promise<User>;
  findUsers(query?: Query): Promise<User[]>;
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserByResetToken(token: string): Promise<User | null>;
  updateUser(id: string, user: Partial<User>): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;
  // Nuevo método para actualizar las capacitaciones usando el email del usuario
  updateUserCapacitationsByEmail(
    email: string,
    capacitations: {
      capSeresArte: boolean;
      capThr: boolean;
      capPhr: boolean;
      capMat: boolean;
      capUor: boolean;
      capReh: boolean;
      capViv: boolean;
    }
  ): Promise<User | null>;

  // Admin user management
  listUsersAdmin(filter: AdminUserListFilter): Promise<{
    items: AdminUserListItem[];
    total: number;
    page: number;
    limit: number;
  }>;
  getUserDetailAdmin(id: string): Promise<AdminUserDetail | null>;
  updateUserProfile(
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
  ): Promise<User | null>;
  updateUserSubscription(
    id: string,
    subscription: {
      paymentDate?: Date;
      expirationDate: Date;
      transactionId?: string;
    }
  ): Promise<User | null>;
  cancelUserSubscription(id: string): Promise<User | null>;
  softDeleteUser(id: string, deletedById: string): Promise<User | null>;
  restoreUser(id: string): Promise<User | null>;
  resetUserPassword(id: string, newPassword: string): Promise<User | null>;
  assignRolesByName(id: string, roleNames: string[]): Promise<User | null>;
  isSelf(targetId: string, currentUserId: string): boolean;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  username: string;
  email: string;
  roleNames: string[];
  primaryRole: string;
  createdAt: Date;
  avatarUrl?: string | null;
  subscription: {
    active: boolean;
    expired: boolean;
    expiringSoon: boolean;
    paymentDate?: Date | null;
    expirationDate?: Date | null;
    transactionId?: string | null;
    daysRemaining: number | null;
  } | null;
  documentaryAccess: {
    slug: string;
    status: string;
    method: string;
    paidAt?: Date | null;
  }[];
  deletedAt: Date | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  bio?: string | null;
  nationality?: string | null;
  locality?: string | null;
  age?: number | null;
  couponUsed?: boolean;
  communityBonusGrantedAt?: Date | null;
  documentaryPurchases: {
    _id: string;
    documentarySlug: string;
    status: string;
    method: string;
    amount: number;
    currency: string;
    transactionId?: string | null;
    paidAt?: Date | null;
    createdAt: Date;
  }[];
}
