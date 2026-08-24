import SocialLink, { ISocialLink } from "@models/SocialLink";
import {
  CreateSocialLinkRequest,
  UpdateSocialLinkRequest,
  SocialLinkResponse,
} from "../types/SocialLinkTypes";

const toResponse = (item: any): SocialLinkResponse => {
  const createdBy = item.createdBy
    ? typeof item.createdBy === "string"
      ? { _id: item.createdBy, name: "", email: "" }
      : {
          _id: (item.createdBy._id as any).toString(),
          name: item.createdBy.name,
          email: item.createdBy.email,
        }
    : undefined;
  return {
    _id: (item._id as any).toString(),
    name: item.name,
    url: item.url,
    imageUrl: item.imageUrl,
    order: typeof item.order === "number" ? item.order : 0,
    isActive: !!item.isActive,
    createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

export class SocialLinkService {
  async createSocialLink(
    data: CreateSocialLinkRequest,
    createdBy: string,
    imageUrl: string
  ): Promise<SocialLinkResponse> {
    const created = await SocialLink.create({
      name: data.name,
      url: data.url,
      imageUrl,
      order: data.order ?? 0,
      isActive: data.isActive ?? true,
      createdBy,
    });
    const populated = await SocialLink.findById(created._id)
      .populate("createdBy", "name email")
      .lean();
    return toResponse(populated || created.toObject());
  }

  async getActiveSocialLinks(): Promise<SocialLinkResponse[]> {
    const items = await SocialLink.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    return items.map(toResponse);
  }

  async getAllSocialLinks(): Promise<SocialLinkResponse[]> {
    const items = await SocialLink.find()
      .populate("createdBy", "name email")
      .sort({ order: 1, createdAt: -1 })
      .lean();
    return items.map(toResponse);
  }

  async getSocialLinkById(id: string): Promise<ISocialLink | null> {
    return await SocialLink.findById(id).populate("createdBy", "name email");
  }

  async updateSocialLink(
    id: string,
    data: UpdateSocialLinkRequest,
    imageUrl?: string
  ): Promise<SocialLinkResponse | null> {
    const current = await SocialLink.findById(id);
    if (!current) return null;

    if (data.name !== undefined) current.name = data.name;
    if (data.url !== undefined) current.url = data.url;
    if (data.order !== undefined) current.order = data.order;
    if (data.isActive !== undefined) current.isActive = data.isActive;
    if (imageUrl) current.imageUrl = imageUrl;

    await current.save();

    const populated = await SocialLink.findById(id)
      .populate("createdBy", "name email")
      .lean();
    return populated ? toResponse(populated) : null;
  }

  async deleteSocialLink(id: string): Promise<boolean> {
    const result = await SocialLink.findByIdAndDelete(id);
    return !!result;
  }

  async toggleSocialLinkStatus(
    id: string
  ): Promise<SocialLinkResponse | null> {
    const item = await SocialLink.findById(id);
    if (!item) return null;
    item.isActive = !item.isActive;
    await item.save();
    const populated = await SocialLink.findById(id)
      .populate("createdBy", "name email")
      .lean();
    return populated ? toResponse(populated) : null;
  }
}
