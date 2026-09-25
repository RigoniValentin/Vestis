import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { UserModel } from "@models/Users";
import { Query } from "types/RepositoryTypes";
import {
  AdminUserListFilter,
  AdminUserListItem,
  AdminUserDetail,
  IUserRepository,
  User,
} from "types/UserTypes";

const toObjectId = (id: string): mongoose.Types.ObjectId =>
  new mongoose.Types.ObjectId(id);

const buildMatchFromFilter = (
  filter: AdminUserListFilter
): Record<string, unknown> => {
  const match: Record<string, unknown> = {};

  if (!filter.includeDeleted) {
    match.deletedAt = null;
  }

  if (filter.q && filter.q.trim()) {
    const rx = new RegExp(escapeRegex(filter.q.trim()), "i");
    match.$or = [{ name: rx }, { username: rx }, { email: rx }];
  }

  return match;
};

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildStatusMatch = (
  status: AdminUserListFilter["status"],
  expirationKey: string
): Record<string, unknown> | null => {
  const now = new Date();
  if (status === "active") {
    return { [expirationKey]: { $gt: now } };
  }
  if (status === "expired") {
    return {
      [expirationKey]: { $exists: true, $ne: null, $lte: now },
    };
  }
  if (status === "none") {
    return {
      $or: [
        { [expirationKey]: { $exists: false } },
        { [expirationKey]: null },
      ],
    };
  }
  return null;
};

const projectUserToListItem = (doc: any): AdminUserListItem => {
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
      ? Math.ceil((expiration.getTime() - Date.now()) / (1000 * 3600 * 24))
      : null;
    subInfo = {
      active,
      expired: expiration ? expiration <= new Date() : false,
      expiringSoon:
        active && daysRemaining !== null && daysRemaining <= 7,
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
};

export class UserRepository implements IUserRepository {
  async create(data: User): Promise<User> {
    const newUser = new UserModel(data);
    return await newUser.save();
  }

  async find(query?: Query): Promise<User[]> {
    return await UserModel.find({ deletedAt: null, ...(query || {}) })
      .populate("roles")
      .exec();
  }

  async findOne(query: Query): Promise<User | null> {
    return await UserModel.findOne({ deletedAt: null, ...query })
      .populate("roles")
      .exec();
  }

  async findById(id: string): Promise<User | null> {
    return await UserModel.findOne({ _id: id, deletedAt: null })
      .populate("roles")
      .exec();
  }

  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    return await UserModel.findById(id).populate("roles").exec();
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    return await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      data,
      { new: true }
    )
      .populate("roles")
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await UserModel.findByIdAndDelete(id).exec();
    return deleted !== null;
  }

  async findPaginatedAdmin(filter: AdminUserListFilter): Promise<{
    items: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(200, Math.max(1, filter.limit || 25));
    const skip = (page - 1) * limit;

    const baseMatch = buildMatchFromFilter(filter);

    const pipeline: any[] = [
      { $match: baseMatch },
      {
        $lookup: {
          from: "documentarypurchases",
          localField: "_id",
          foreignField: "userId",
          as: "documentaryAccess",
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    if (filter.status && filter.status !== "all") {
      const statusMatch = buildStatusMatch(filter.status, "subscription.expirationDate");
      if (statusMatch) {
        pipeline.push({ $match: statusMatch });
      }
    }

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const aggResult = await UserModel.aggregate(facetPipeline);
    const items = aggResult?.[0]?.items || [];
    const total = aggResult?.[0]?.total?.[0]?.count || 0;

    return {
      items: items as any,
      total,
      page,
      limit,
    };
  }

  async findDetailAdmin(id: string): Promise<AdminUserDetail | null> {
    const result = await UserModel.aggregate([
      { $match: { _id: toObjectId(id), deletedAt: null } },
      {
        $lookup: {
          from: "roles",
          localField: "roles",
          foreignField: "_id",
          as: "roles",
        },
      },
      {
        $lookup: {
          from: "documentarypurchases",
          localField: "_id",
          foreignField: "userId",
          as: "documentaryPurchases",
        },
      },
    ]);

    if (!result || result.length === 0) return null;
    const doc = result[0];
    const base = projectUserToListItem({
      ...doc,
      documentaryAccess: (doc.documentaryPurchases || []).map((p: any) => ({
        documentarySlug: p.documentarySlug,
        status: p.status,
        method: p.method,
        paidAt: p.paidAt,
      })),
    });

    return {
      ...base,
      bio: doc.bio || null,
      nationality: doc.nationality || null,
      locality: doc.locality || null,
      age: typeof doc.age === "number" ? doc.age : null,
      couponUsed: !!doc.couponUsed,
      communityBonusGrantedAt: doc.communityBonusGrantedAt || null,
      documentaryPurchases: (doc.documentaryPurchases || []).map(
        (p: any) => ({
          _id: String(p._id),
          documentarySlug: p.documentarySlug,
          status: p.status,
          method: p.method,
          amount: p.amount,
          currency: p.currency,
          transactionId: p.transactionId || null,
          paidAt: p.paidAt || null,
          createdAt: p.createdAt,
        })
      ),
    };
  }

  async softDelete(id: string, deletedById: string): Promise<User | null> {
    return await UserModel.findByIdAndUpdate(
      id,
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: deletedById,
          // Por seguridad, limpiamos el token de reset si tenía uno.
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
        },
      },
      { new: true }
    )
      .populate("roles")
      .exec();
  }

  async restore(id: string): Promise<User | null> {
    return await UserModel.findByIdAndUpdate(
      id,
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
        },
      },
      { new: true }
    )
      .populate("roles")
      .exec();
  }

  async updatePassword(id: string, plainPassword: string): Promise<User | null> {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(plainPassword, salt);
    return await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { password: hash } },
      { new: true }
    ).exec();
  }

  async findAllForSelect(limit = 200): Promise<User[]> {
    return await UserModel.find({ deletedAt: null })
      .select("_id name username email")
      .sort({ name: 1 })
      .limit(limit)
      .exec();
  }
}
