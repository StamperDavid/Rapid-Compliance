/**
 * Truth Social Service — Truth Social API integration
 * Compatible with Mastodon API (Truth Social is a Mastodon fork)
 *
 * Auth: OAuth 2.0 Bearer token
 * API: https://truthsocial.com/api/v1/ (Mastodon-compatible)
 *
 * @module integrations/truth-social-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TruthSocialConfig {
  accessToken?: string;
  instanceUrl?: string;
}

export interface TruthSocialPostRequest {
  status: string;
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  mediaIds?: string[];
}

export interface TruthSocialPostResponse {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

interface TruthSocialAccount {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class TruthSocialService {
  private config: TruthSocialConfig;
  private baseUrl: string;

  constructor(config: TruthSocialConfig) {
    this.config = config;
    this.baseUrl = config.instanceUrl ?? 'https://truthsocial.com';
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken);
  }

  async postStatus(request: TruthSocialPostRequest): Promise<TruthSocialPostResponse> {
    try {
      if (!this.config.accessToken) {
        return { success: false, error: 'Truth Social not configured' };
      }

      const body: Record<string, unknown> = {
        status: request.status,
        visibility: request.visibility ?? 'public',
      };
      if (request.mediaIds?.length) {
        body.media_ids = request.mediaIds;
      }

      const response = await fetch(`${this.baseUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as { id?: string; url?: string; error?: string };
      if (!response.ok || !data.id) {
        return { success: false, error: data.error ?? `Truth Social post failed: ${response.status}` };
      }

      return { success: true, postId: data.id, url: data.url };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[TruthSocialService] Post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getProfile(): Promise<TruthSocialAccount | null> {
    try {
      if (!this.config.accessToken) {
        return null;
      }

      const res = await fetch(`${this.baseUrl}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as TruthSocialAccount;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createTruthSocialService(): Promise<TruthSocialService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'truth_social') as TruthSocialConfig | null;
  if (!keys) {
    return null;
  }
  const service = new TruthSocialService(keys);
  return service.isConfigured() ? service : null;
}
