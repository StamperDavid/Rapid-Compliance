/**
 * TikTok Service — TikTok Content Posting API integration
 * Posts videos to TikTok via the official Content Posting API
 *
 * Auth: OAuth 2.0 (requires video.upload scope)
 * API: https://open.tiktokapis.com/v2/
 *
 * Publishing flow: Init upload → Upload video → Publish
 *
 * @module integrations/tiktok-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TikTokConfig {
  accessToken?: string;
  refreshToken?: string;
  clientKey?: string;
  clientSecret?: string;
  openId?: string;
}

export interface TikTokPostRequest {
  title: string;
  videoUrl?: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export interface TikTokPostResponse {
  success: boolean;
  publishId?: string;
  error?: string;
}

interface TikTokUserInfo {
  open_id: string;
  display_name: string;
  avatar_url: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://open.tiktokapis.com/v2';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export class TikTokService {
  private config: TikTokConfig;
  private currentToken: string | null;

  constructor(config: TikTokConfig) {
    this.config = config;
    this.currentToken = config.accessToken ?? null;
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken) ||
      Boolean(this.config.clientKey && this.config.clientSecret && this.config.refreshToken);
  }

  private async ensureToken(): Promise<string> {
    if (this.currentToken) {
      return this.currentToken;
    }

    if (!this.config.clientKey || !this.config.clientSecret || !this.config.refreshToken) {
      throw new Error('TikTok OAuth credentials not configured');
    }

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
      }).toString(),
    });

    const data = (await response.json()) as { data?: { access_token?: string }; error?: { message?: string } };
    if (!data.data?.access_token) {
      throw new Error(data.error?.message ?? 'TikTok token refresh failed');
    }

    this.currentToken = data.data.access_token;
    return data.data.access_token;
  }

  /**
   * Initiate a video post to TikTok using the Content Posting API.
   * This creates a publish task; the actual video is pulled from videoUrl by TikTok's servers.
   */
  async publishVideo(request: TikTokPostRequest): Promise<TikTokPostResponse> {
    try {
      const token = await this.ensureToken();

      if (!request.videoUrl) {
        return { success: false, error: 'TikTok requires a video URL' };
      }

      // Use "pull from URL" source type
      const response = await fetch(`${API_BASE}/post/publish/video/init/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          post_info: {
            title: request.title.substring(0, 2200),
            privacy_level: request.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
            disable_comment: request.disableComment ?? false,
            disable_duet: request.disableDuet ?? false,
            disable_stitch: request.disableStitch ?? false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: request.videoUrl,
          },
        }),
      });

      const data = (await response.json()) as {
        data?: { publish_id?: string };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || data.error?.code) {
        return { success: false, error: data.error?.message ?? `TikTok publish failed: ${response.status}` };
      }

      return { success: true, publishId: data.data?.publish_id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[TikTokService] Publish failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  /**
   * Post a photo/carousel to TikTok (photo mode).
   * Uses the photo publish endpoint with a caption.
   */
  async publishPhoto(request: { title: string; imageUrls: string[]; privacyLevel?: string }): Promise<TikTokPostResponse> {
    try {
      const token = await this.ensureToken();

      if (!request.imageUrls.length) {
        return { success: false, error: 'TikTok photo post requires at least one image URL' };
      }

      const response = await fetch(`${API_BASE}/post/publish/content/init/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          post_info: {
            title: request.title.substring(0, 2200),
            privacy_level: request.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
          },
          source_info: {
            source: 'PULL_FROM_URL',
            photo_images: request.imageUrls,
          },
          media_type: 'PHOTO',
        }),
      });

      const data = (await response.json()) as {
        data?: { publish_id?: string };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || data.error?.code) {
        return { success: false, error: data.error?.message ?? `TikTok photo publish failed: ${response.status}` };
      }

      return { success: true, publishId: data.data?.publish_id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[TikTokService] Photo publish failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getUserInfo(): Promise<TikTokUserInfo | null> {
    try {
      const token = await this.ensureToken();

      const res = await fetch(`${API_BASE}/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as { data?: { user?: TikTokUserInfo } };
      return data.data?.user ?? null;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createTikTokService(): Promise<TikTokService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'tiktok') as TikTokConfig | null;
  if (!keys) {
    return null;
  }
  const service = new TikTokService(keys);
  return service.isConfigured() ? service : null;
}
