import { LensContentModel } from "@models/LensContent";
import { ILensContentRepository, LensContent } from "types/LensContentTypes";
import { QnaTopic } from "@models/CommunityPost";
import { Query } from "types/RepositoryTypes";

export class LensContentRepository implements ILensContentRepository {
  async create(data: LensContent): Promise<LensContent> {
    const doc = new LensContentModel(data);
    return await doc.save();
  }

  async findByTopic(topic: QnaTopic, includeInactive = false): Promise<LensContent[]> {
    const filter: Record<string, unknown> = { topic };
    if (!includeInactive) filter.isActive = true;
    return await LensContentModel.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .populate("author", "name username avatarUrl")
      .exec();
  }

  async find(query?: Query): Promise<LensContent[]> {
    return await LensContentModel.find(query || {})
      .sort({ isPinned: -1, createdAt: -1 })
      .populate("author", "name username avatarUrl")
      .exec();
  }

  async findById(id: string): Promise<LensContent | null> {
    return await LensContentModel.findById(id)
      .populate("author", "name username avatarUrl")
      .exec();
  }

  async update(
    id: string,
    data: Partial<LensContent>
  ): Promise<LensContent | null> {
    return await LensContentModel.findByIdAndUpdate(id, data, {
      new: true,
    })
      .populate("author", "name username avatarUrl")
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await LensContentModel.findByIdAndDelete(id).exec();
    return deleted !== null;
  }

  async count(query: Query): Promise<number> {
    return await LensContentModel.countDocuments(query).exec();
  }
}
