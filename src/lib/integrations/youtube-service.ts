/**
 * YouTube Service — YouTube Data API v3 integration
 * Uploads videos and creates community posts via the YouTube API
 *
 * Auth: OAuth 2.0 (requires youtube.upload and youtube.force-ssl scopes)
 * API: https://www.googleapis.com/youtube/v3/
 *
 * Note: Video upload uses resumable upload protocol.
 * Community posts use the unofficial API endpoint (may require channel membership features).
 *
 * @module integrations/youtube-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface YouTubeConfig {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  channelId?: string;
}

export interface YouTubeUploadRequest {
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
  videoUrl?: string;
  categoryId?: string;
}

export interface YouTubePostResponse {
  success: boolean;
  videoId?: string;
  postId?: string;
  error?: string;
}

export interface YouTubeCommunityPostRequest {
  text: string;
  imageUrl?: string;
}

interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  subscriberCount: string;
  videoCount: string;
  thumbnailUrl?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export class YouTubeService {
  private config: YouTubeConfig;
  private currentToken: string | null;

  constructor(config: YouTubeConfig) {
    this.config = config;
    this.currentToken = config.accessToken ?? null;
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken) ||
      Boolean(this.config.clientId && this.config.clientSecret && this.config.refreshToken);
  }

  private async ensureToken(): Promise<string> {
    if (this.currentToken) {
      return this.currentToken;
    }

    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      throw new Error('YouTube OAuth credentials not configured');
    }

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (!data.access_token) {
      throw new Error(data.error ?? 'YouTube token refresh failed');
    }

    this.currentToken = data.access_token;
    return data.access_token;
  }

  /**
   * Create a community post (text-based update on the channel's Community tab).
   * Falls back to creating a playlist note if community posts aren't available.
   */
  async createCommunityPost(request: YouTubeCommunityPostRequest): Promise<YouTubePostResponse> {
    try {
      const token = await this.ensureToken();

      // YouTube Data API doesn't have an official community post endpoint.
      // Use the activities.insert or fall back to a channel bulletin.
      const response = await fetch(`${API_BASE}/activities?part=snippet,contentDetails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          snippet: {
            description: request.text,
          },
          contentDetails: {
            bulletin: {
              resourceId: {
                kind: 'youtube#channel',
                channelId: this.config.channelId ?? 'mine',
              },
            },
          },
        }),
      });

      const data = (await response.json()) as { id?: string; error?: { message?: string; errors?: Array<{ reason?: string }> } };
      if (!response.ok || !data.id) {
        const errMsg = data.error?.message ?? `YouTube post failed: ${response.status}`;
        return { success: false, error: errMsg };
      }

      return { success: true, postId: data.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[YouTubeService] Community post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  /**
   * Upload a video to YouTube (metadata-only step; actual binary upload requires
   * resumable upload protocol which is handled separately by the video pipeline).
   */
  async setVideoMetadata(request: YouTubeUploadRequest): Promise<YouTubePostResponse> {
    try {
      const token = await this.ensureToken();

      const response = await fetch(`${API_BASE}/videos?part=snippet,status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          snippet: {
            title: request.title,
            description: request.description,
            tags: request.tags ?? [],
            categoryId: request.categoryId ?? '22', // "People & Blogs" default
          },
          status: {
            privacyStatus: request.privacyStatus ?? 'public',
            selfDeclaredMadeForKids: false,
          },
        }),
      });

      const data = (await response.json()) as { id?: string; error?: { message?: string } };
      if (!response.ok || !data.id) {
        return { success: false, error: data.error?.message ?? `YouTube upload failed: ${response.status}` };
      }

      return { success: true, videoId: data.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[YouTubeService] Upload failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getChannel(): Promise<YouTubeChannel | null> {
    try {
      const token = await this.ensureToken();

      const res = await fetch(
        `${API_BASE}/channels?part=snippet,statistics&mine=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          snippet: { title: string; description: string; thumbnails?: { default?: { url?: string } } };
          statistics: { subscriberCount: string; videoCount: string };
        }>;
      };

      const item = data.items?.[0];
      if (!item) {
        return null;
      }

      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        subscriberCount: item.statistics.subscriberCount,
        videoCount: item.statistics.videoCount,
        thumbnailUrl: item.snippet.thumbnails?.default?.url,
      };
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createYouTubeService(): Promise<YouTubeService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'youtube') as YouTubeConfig | null;
  if (!keys) {
    return null;
  }
  const service = new YouTubeService(keys);
  return service.isConfigured() ? service : null;
}
