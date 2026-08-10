import { Document, Types } from "mongoose";
import { Query, Repository } from "./RepositoryTypes";
import { QnaTopic } from "@models/CommunityPost";

export interface LensContent extends Document {
  topic: QnaTopic;
  title: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  link?: { label: string; url: string };
  isPinned: boolean;
  isActive: boolean;
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
  isPinned?: boolean;
  isActive?: boolean;
  author: Types.ObjectId;
}

export interface LensContentUpdatePayload {
  topic?: QnaTopic;
  title?: string;
  body?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  link?: { label?: string; url: string } | null;
  isPinned?: boolean;
  isActive?: boolean;
}

export interface ILensContentRepository extends Repository<LensContent> {
  findByTopic(topic: QnaTopic, includeInactive?: boolean): Promise<LensContent[]>;
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
    options?: { includeInactive?: boolean }
  ): Promise<LensContent[]>;
  findById(id: string): Promise<LensContent | null>;
}
