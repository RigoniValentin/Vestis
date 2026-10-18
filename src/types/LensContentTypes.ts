import { Document, Types } from "mongoose";
import { Query, Repository } from "./RepositoryTypes";
import { QnaTopic } from "@models/CommunityPost";

export type LensContentVisibility = "public" | "premium";

export type LensAudienceFilter = "public" | "premium" | "all";

export interface LensAttachment {
  url: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

export interface LensContent extends Document {
  topic: QnaTopic;
  title: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  link?: { label: string; url: string };
  attachments?: LensAttachment[];
  isPinned: boolean;
  isActive: boolean;
  visibility: LensContentVisibility;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface LensContentCreatePayload {
  topic: QnaTopic;
  title: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  link?: { label?: string; url: string };
  attachments?: LensAttachment[];
  isPinned?: boolean;
  isActive?: boolean;
  visibility?: LensContentVisibility;
  author: Types.ObjectId;
}

export interface LensContentUpdatePayload {
  topic?: QnaTopic;
  title?: string;
  body?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  link?: { label?: string; url: string } | null;
  attachments?: LensAttachment[] | null;
  isPinned?: boolean;
  isActive?: boolean;
  visibility?: LensContentVisibility;
}

export interface ILensContentRepository extends Repository<LensContent> {
  findByTopic(
    topic: QnaTopic,
    options?: { includeInactive?: boolean; audience?: LensAudienceFilter }
  ): Promise<LensContent[]>;
  findAllFiltered(options?: {
    includeInactive?: boolean;
    audience?: LensAudienceFilter;
  }): Promise<LensContent[]>;
}

export interface ILensContentService {
  createContent(payload: LensContentCreatePayload): Promise<LensContent>;
  updateContent(
    id: string,
    payload: LensContentUpdatePayload
  ): Promise<LensContent | null>;
  deleteContent(id: string): Promise<boolean>;
  listContent(
    topic?: QnaTopic,
    options?: { includeInactive?: boolean; audience?: LensAudienceFilter }
  ): Promise<LensContent[]>;
  findById(id: string): Promise<LensContent | null>;
}
