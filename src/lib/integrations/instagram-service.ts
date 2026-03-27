/**
 * Instagram Service — Instagram Graph API integration
 * Posts to Instagram Business/Creator accounts via Meta Graph API
 *
 * Auth: Instagram Graph API token (obtained via Facebook Login)
 * API: https://graph.facebook.com/v19.0/ (Instagram endpoints use Facebook Graph)
 *
 * Publishing flow: Create media container → Publish container
 *
 * @module integrations/instagram-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InstagramConfig {
  accessToken?: string;
  instagramAccountId?: string;
}

export interface InstagramPostRequest {
  caption: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'REELS' | 'CAROUSEL_ALBUM';
}

export interface InstagramPostResponse {
  success: boolean;
  postId?: string;
  error?: string;
}

interface InstagramProfile {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://graph.facebook.com/v19.0';

export class InstagramService {
  private config: InstagramConfig;

  constructor(config: InstagramConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken && this.config.instagramAccountId);
  }

  async publishPost(request: InstagramPostRequest): Promise<InstagramPostResponse> {
    try {
      if (!this.config.accessToken || !this.config.instagramAccountId) {
        return { success: false, error: 'Instagram not configured' };
      }

      // Instagram requires media — text-only posts are not supported
      if (!request.imageUrl && !request.videoUrl) {
        return { success: false, error: 'Instagram requires an image or video URL' };
      }

      // Step 1: Create media container
      const containerBody: Record<string, string> = {
        caption: request.caption,
        access_token: this.config.accessToken,
      };

      if (request.videoUrl) {
        containerBody.video_url = request.videoUrl;
        containerBody.media_type = request.mediaType === 'REELS' ? 'REELS' : 'VIDEO';
      } else if (request.imageUrl) {
        containerBody.image_url = request.imageUrl;
      }

      const containerRes = await fetch(
        `${API_BASE}/${this.config.instagramAccountId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(containerBody),
        },
      );

      const containerData = (await containerRes.json()) as { id?: string; error?: { message?: string } };
      if (!containerRes.ok || !containerData.id) {
        return { success: false, error: containerData.error?.message ?? 'Failed to create Instagram media container' };
      }

      // Step 2: Publish the container
      const publishRes = await fetch(
        `${API_BASE}/${this.config.instagramAccountId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: containerData.id,
            access_token: this.config.accessToken,
          }),
        },
      );

      const publishData = (await publishRes.json()) as { id?: string; error?: { message?: string } };
      if (!publishRes.ok || !publishData.id) {
        return { success: false, error: publishData.error?.message ?? 'Failed to publish Instagram post' };
      }

      return { success: true, postId: publishData.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[InstagramService] Post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getProfile(): Promise<InstagramProfile | null> {
    try {
      if (!this.config.accessToken || !this.config.instagramAccountId) {
        return null;
      }

      const res = await fetch(
        `${API_BASE}/${this.config.instagramAccountId}?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${this.config.accessToken}`,
      );

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as InstagramProfile;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createInstagramService(): Promise<InstagramService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'instagram') as InstagramConfig | null;
  if (!keys) {
    return null;
  }
  const service = new InstagramService(keys);
  return service.isConfigured() ? service : null;
}
