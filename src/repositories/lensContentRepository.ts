import { LensContentModel } from "@models/LensContent";
import {
  ILensContentRepository,
  LensAudienceFilter,
  LensContent,
} from "types/LensContentTypes";
import { QnaTopic } from "@models/CommunityPost";
import { Query } from "types/RepositoryTypes";

// Orden de listado: primero lo fijado, despues la posicion manual de Liz
// (de menor a mayor) y, como desempate, lo mas reciente primero.
const LIST_SORT = { isPinned: -1, order: 1, createdAt: -1 } as const;

const buildAudienceFilter = (audience?: LensAudienceFilter): Record<string, unknown> | null => {
  if (!audience || audience === "all") return null;
  if (audience === "public") {
    // Los contenidos publicados antes de existir el campo "visibility" tambien
    // son publicos: se incluyen para que no queden invisibles.
    return {
      $or: [{ visibility: "public" }, { visibility: { $exists: false } }],
    };
  }
  return { visibility: "premium" };
};

export class LensContentRepository implements ILensContentRepository {
  async create(data: LensContent): Promise<LensContent> {
    const doc = new LensContentModel(data);
    return await doc.save();
  }

  async findByTopic(
    topic: QnaTopic,
    options?: { includeInactive?: boolean; audience?: LensAudienceFilter }
  ): Promise<LensContent[]> {
    const filter: Record<string, unknown> = { topic };
    if (!options?.includeInactive) filter.isActive = true;
    const audienceFilter = buildAudienceFilter(options?.audience);
    if (audienceFilter) Object.assign(filter, audienceFilter);
    return await LensContentModel.find(filter)
      .sort(LIST_SORT)
      .populate("author", "name username avatarUrl")
      .exec();
  }

  async findAllFiltered(options?: {
    includeInactive?: boolean;
    audience?: LensAudienceFilter;
  }): Promise<LensContent[]> {
    const filter: Record<string, unknown> = {};
    if (!options?.includeInactive) filter.isActive = true;
    const audienceFilter = buildAudienceFilter(options?.audience);
    if (audienceFilter) Object.assign(filter, audienceFilter);
    return await LensContentModel.find(filter)
      .sort(LIST_SORT)
      .populate("author", "name username avatarUrl")
      .exec();
  }

  async find(query?: Query): Promise<LensContent[]> {
    return await LensContentModel.find(query || {})
      .sort(LIST_SORT)
      .populate("author", "name username avatarUrl")
      .exec();
  }

  async getMaxOrder(topic?: QnaTopic): Promise<number> {
    const filter: Record<string, unknown> = topic ? { topic } : {};
    const top = await LensContentModel.findOne(filter)
      .sort({ order: -1, createdAt: -1 })
      .select({ order: 1 })
      .lean<{ order?: number }>();
    const value = Number(top?.order ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  async applyOrder(entries: Array<{ id: string; order: number }>): Promise<void> {
    if (entries.length === 0) return;
    await LensContentModel.bulkWrite(
      entries.map(({ id, order }) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order } },
        },
      }))
    );
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
