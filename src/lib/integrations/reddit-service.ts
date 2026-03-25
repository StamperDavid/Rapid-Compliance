/**
 * Reddit Service — Reddit API integration
 * Posts to subreddits via OAuth 2.0
 *
 * Auth: OAuth 2.0 (script app or web app flow)
 * API: https://oauth.reddit.com/
 *
 * @module integrations/reddit-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RedditConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  username?: string;
}

export interface RedditPostRequest {
  subreddit: string;
  title: string;
  text?: string;
  url?: string;
  kind?: 'self' | 'link';
}

export interface RedditPostResponse {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

interface RedditIdentity {
  name: string;
  id: string;
  icon_img: string;
  link_karma: number;
  comment_karma: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://oauth.reddit.com';

export class RedditService {
  private config: RedditConfig;
  private currentToken: string | null;

  constructor(config: RedditConfig) {
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
      throw new Error('Reddit OAuth credentials not configured');
    }

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: `grant_type=refresh_token&refresh_token=${this.config.refreshToken}`,
    });

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (!data.access_token) {
      throw new Error(data.error ?? 'Reddit token refresh failed');
    }

    this.currentToken = data.access_token;
    return data.access_token;
  }

  async submitPost(request: RedditPostRequest): Promise<RedditPostResponse> {
    try {
      const token = await this.ensureToken();
      const kind = request.kind ?? (request.url ? 'link' : 'self');

      const params = new URLSearchParams({
        api_type: 'json',
        kind,
        sr: request.subreddit,
        title: request.title,
        resubmit: 'true',
      });

      if (kind === 'self' && request.text) {
        params.set('text', request.text);
      } else if (kind === 'link' && request.url) {
        params.set('url', request.url);
      }

      const response = await fetch(`${API_BASE}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'SalesVelocity.ai/1.0',
        },
        body: params.toString(),
      });

      const data = (await response.json()) as {
        json?: {
          data?: { id?: string; url?: string; name?: string };
          errors?: Array<string[]>;
        };
      };

      if (data.json?.errors?.length) {
        const errorMsg = data.json.errors.map((e) => e.join(': ')).join(', ');
        return { success: false, error: errorMsg };
      }

      return {
        success: true,
        postId: data.json?.data?.name,
        postUrl: data.json?.data?.url,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[RedditService] Submit failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getIdentity(): Promise<RedditIdentity | null> {
    try {
      const token = await this.ensureToken();
      const res = await fetch(`${API_BASE}/api/v1/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'SalesVelocity.ai/1.0',
        },
      });

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as RedditIdentity;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createRedditService(): Promise<RedditService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'reddit') as RedditConfig | null;
  if (!keys) {
    return null;
  }
  const service = new RedditService(keys);
  return service.isConfigured() ? service : null;
}
