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
  comparePassword(password: string): Promise<boolean>;
  createdAt: Date;
}

export interface IUserRepository extends Repository<User> {
  findOne(query: Query): Promise<User | null>;
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
}
