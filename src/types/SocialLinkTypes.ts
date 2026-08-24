export interface CreateSocialLinkRequest {
  name: string;
  url: string;
  imageUrl?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateSocialLinkRequest {
  name?: string;
  url?: string;
  imageUrl?: string;
  order?: number;
  isActive?: boolean;
}

export interface SocialLinkResponse {
  _id: string;
  name: string;
  url: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
