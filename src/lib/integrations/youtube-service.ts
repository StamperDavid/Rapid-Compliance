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
 * Tokens: Per the architectural rule
 * (`feedback_one_google_account_per_tenant_runs_calendars_and_email`),
 * YouTube reads OAuth tokens from the central connected-Google-account
 * store (`organizations/{tenant}/connectedAccounts/google`). The full
 * scope bundle granted at onboarding already includes `youtube.upload`
 * and `youtube.readonly`, so no separate YouTube OAuth flow is needed.
 *
 * Backward-compat: if the central store is empty (operator hasn't
 * re-OAuth'd since the migration), the factory falls back to the
 * legacy `apiKeys.youtube` per-service credential so existing
 * deployments keep working until their next reconnect.
 *
 * @module integrations/youtube-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import {
  getConnectedGoogleTokens,
  refreshConnectedGoogleTokens,
} from '@/lib/integrations/google-tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface YouTubeConfig {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  channelId?: string;
  /**
   * Optional async hook the service calls when its current access token
   * expires and a fresh one is needed. Returning null signals refresh
   * failure (e.g., revoked access). When provided, this hook supersedes
   * the legacy `clientId/clientSecret/refreshToken` direct refresh path
   * — it's how the central-Google-token consumer persists refreshed
   * tokens back to the central store instead of the legacy
   * `apiKeys.youtube` doc.
   */
  refreshAccessToken?: () => Promise<string | null>;
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
      Boolean(this.config.refreshAccessToken) ||
      Boolean(this.config.clientId && this.config.clientSecret && this.config.refreshToken);
  }

  private async ensureToken(): Promise<string> {
    if (this.currentToken) {
      return this.currentToken;
    }

    // Prefer the injected refresh hook (used by the central-Google
    // token store path so refreshes write back to the central doc).
    if (this.config.refreshAccessToken) {
      const refreshed = await this.config.refreshAccessToken();
      if (!refreshed) {
        throw new Error('YouTube token refresh failed (central store)');
      }
      this.currentToken = refreshed;
      return refreshed;
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
   * Force a token refresh (e.g., after a 401). When the central-store
   * refresh hook is in play, refreshed tokens are persisted back to
   * the central doc by the hook itself.
   */
  private async refreshToken(): Promise<string | null> {
    this.currentToken = null;
    try {
      return await this.ensureToken();
    } catch (err) {
      logger.warn('[YouTubeService] token refresh failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Run a YouTube API call with one-shot 401-retry. The callback receives
   * a fresh access token; on 401 we force a refresh and retry exactly
   * once. This covers the case where a cached central-store access token
   * has expired between the last write and the current call.
   *
   * Strict cap: at most one retry per outer call. If the second response
   * also 401s, it's returned to the caller for normal error handling.
   */
  private async withRefreshRetry(
    call: (token: string) => Promise<Response>,
  ): Promise<Response> {
    let token = await this.ensureToken();
    let res = await call(token);

    if (res.status === 401) {
      const fresh = await this.refreshToken();
      if (fresh) {
        token = fresh;
        res = await call(token);
      }
    }

    return res;
  }

  /**
   * Create a community post (text-based update on the channel's Community tab).
   * Falls back to creating a playlist note if community posts aren't available.
   */
  async createCommunityPost(request: YouTubeCommunityPostRequest): Promise<YouTubePostResponse> {
    try {
      // YouTube Data API doesn't have an official community post endpoint.
      // Use the activities.insert or fall back to a channel bulletin.
      const response = await this.withRefreshRetry((token) =>
        fetch(`${API_BASE}/activities?part=snippet,contentDetails`, {
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
        }),
      );

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
      const response = await this.withRefreshRetry((token) =>
        fetch(`${API_BASE}/videos?part=snippet,status`, {
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
        }),
      );

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
      const res = await this.withRefreshRetry((token) =>
        fetch(
          `${API_BASE}/channels?part=snippet,statistics&mine=true`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
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

/**
 * Build a YouTubeService for the active tenant.
 *
 * Token resolution order (Apr 2026 — central Google store migration):
 *   1. Central connected-Google-account store
 *      (`organizations/{tenant}/connectedAccounts/google`). This is the
 *      preferred source — one OAuth at onboarding covers Gmail,
 *      Calendar, Drive, YouTube, GBP, GA4, GSC, and Ads.
 *   2. Legacy fallback: `apiKeys.youtube` per-service credential. Kept
 *      so operators connected before the central-store migration
 *      keep posting until they reconnect Google. This fallback can be
 *      removed once all live tenants have re-OAuth'd.
 *
 * Returns null when neither source is configured.
 */
export async function createYouTubeService(): Promise<YouTubeService | null> {
  // 1. Preferred path — central connected-Google-account store.
  const connected = await getConnectedGoogleTokens();
  if (connected?.accessToken) {
    const service = new YouTubeService({
      accessToken: connected.accessToken,
      refreshToken: connected.refreshToken ?? undefined,
      // Refresh hook routes back through the central store so refreshed
      // tokens persist there, not into legacy apiKeys.youtube.
      refreshAccessToken: async (): Promise<string | null> => {
        const fresh = await refreshConnectedGoogleTokens();
        return fresh?.accessToken ?? null;
      },
    });
    return service.isConfigured() ? service : null;
  }

  // 2. Backward-compat — legacy per-service credential. Only reached
  // when the central store is empty (operator hasn't re-OAuth'd since
  // the migration).
  const legacyKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'youtube') as YouTubeConfig | null;
  if (!legacyKeys) {
    return null;
  }
  logger.info('[YouTubeService] using legacy apiKeys.youtube fallback — operator should reconnect Google to migrate to central token store');
  const service = new YouTubeService(legacyKeys);
  return service.isConfigured() ? service : null;
}
