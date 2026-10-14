import {
  ILensContentRepository,
  ILensContentService,
  LensAttachment,
  LensContent,
  LensContentCreatePayload,
  LensContentUpdatePayload,
} from "types/LensContentTypes";
import { QnaTopic, QNA_TOPICS } from "@models/CommunityPost";

const MAX_ATTACHMENT_ENTRIES = 6;

export class LensContentService implements ILensContentService {
  private repository: ILensContentRepository;

  constructor(repository: ILensContentRepository) {
    this.repository = repository;
  }

  private sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    if (!text) return undefined;
    return text.slice(0, maxLength);
  }

  private sanitizeAttachments(
    value: unknown
  ): LensAttachment[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const cleaned: LensAttachment[] = [];
    const seen = new Set<string>();
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const url = typeof (entry as LensAttachment).url === "string"
        ? (entry as LensAttachment).url.trim()
        : "";
      if (!url || seen.has(url)) continue;
      seen.add(url);
      cleaned.push({
        url: url.slice(0, 500),
        originalName:
          typeof (entry as LensAttachment).originalName === "string"
            ? ((entry as LensAttachment).originalName as string).slice(0, 255)
            : undefined,
        mimeType:
          typeof (entry as LensAttachment).mimeType === "string"
            ? ((entry as LensAttachment).mimeType as string).slice(0, 120)
            : undefined,
        size:
          typeof (entry as LensAttachment).size === "number"
            ? (entry as LensAttachment).size
            : undefined,
      });
      if (cleaned.length >= MAX_ATTACHMENT_ENTRIES) break;
    }
    return cleaned;
  }

  async createContent(payload: LensContentCreatePayload): Promise<LensContent> {
    if (!QNA_TOPICS.includes(payload.topic)) {
      throw new Error("Eje de lente inválido.");
    }

    const title = this.sanitizeText(payload.title, 200);
    if (!title) {
      throw new Error("El título es obligatorio.");
    }

    const body = this.sanitizeText(payload.body, 4000);
    const imageUrl = this.sanitizeText(payload.imageUrl, 500);
    const videoUrl = this.sanitizeText(payload.videoUrl, 500);
    const attachments = this.sanitizeAttachments(payload.attachments) || [];

    const linkUrl = payload.link?.url
      ? this.sanitizeText(payload.link.url, 500)
      : undefined;
    const linkLabel = payload.link?.label
      ? this.sanitizeText(payload.link.label, 80)
      : undefined;

    if (!body && !imageUrl && !videoUrl && !linkUrl && attachments.length === 0) {
      throw new Error(
        "Cargá al menos un contenido: texto, imagen, video, enlace o adjunto."
      );
    }

    return this.repository.create({
      topic: payload.topic,
      title,
      body,
      imageUrl,
      videoUrl,
      link: linkUrl
        ? { label: linkLabel || "Ver más", url: linkUrl }
        : undefined,
      attachments,
      isPinned: !!payload.isPinned,
      isActive: payload.isActive !== undefined ? !!payload.isActive : true,
      author: payload.author,
    } as LensContent);
  }

  async updateContent(
    id: string,
    payload: LensContentUpdatePayload
  ): Promise<LensContent | null> {
    const update: Record<string, unknown> = {};

    if (payload.topic !== undefined) {
      if (!QNA_TOPICS.includes(payload.topic)) {
        throw new Error("Eje de lente inválido.");
      }
      update.topic = payload.topic;
    }

    if (payload.title !== undefined) {
      const title = this.sanitizeText(payload.title, 200);
      if (!title) throw new Error("El título es obligatorio.");
      update.title = title;
    }

    if (payload.body !== undefined) {
      update.body =
        payload.body === null ? undefined : this.sanitizeText(payload.body, 4000);
    }
    if (payload.imageUrl !== undefined) {
      update.imageUrl =
        payload.imageUrl === null
          ? undefined
          : this.sanitizeText(payload.imageUrl, 500);
    }
    if (payload.videoUrl !== undefined) {
      update.videoUrl =
        payload.videoUrl === null
          ? undefined
          : this.sanitizeText(payload.videoUrl, 500);
    }
    if (payload.link !== undefined) {
      if (payload.link === null) {
        update.link = undefined;
      } else {
        const linkUrl = this.sanitizeText(payload.link.url, 500);
        update.link = linkUrl
          ? {
              label:
                this.sanitizeText(payload.link.label, 80) || "Ver más",
              url: linkUrl,
            }
          : undefined;
      }
    }
    if (payload.attachments !== undefined) {
      update.attachments =
        payload.attachments === null
          ? []
          : this.sanitizeAttachments(payload.attachments) || [];
    }

    if (payload.isPinned !== undefined) update.isPinned = !!payload.isPinned;
    if (payload.isActive !== undefined) update.isActive = !!payload.isActive;

    return this.repository.update(id, update as Partial<LensContent>);
  }

  async deleteContent(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async listContent(
    topic?: QnaTopic,
    options?: { includeInactive?: boolean }
  ): Promise<LensContent[]> {
    if (topic && QNA_TOPICS.includes(topic)) {
      return this.repository.findByTopic(topic, !!options?.includeInactive);
    }
    return this.repository.find(options?.includeInactive ? {} : { isActive: true });
  }

  async findById(id: string): Promise<LensContent | null> {
    return this.repository.findById(id);
  }
}
