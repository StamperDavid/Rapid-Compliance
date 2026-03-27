/**
 * Facebook Service — Meta Graph API integration
 * Posts to Facebook Pages via the Graph API
 *
 * Auth: Page Access Token (long-lived, obtained via Facebook Login)
 * API: https://graph.facebook.com/v19.0/
 *
 * @module integrations/facebook-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FacebookConfig {
  pageAccessToken?: string;
  pageId?: string;
}

export interface FacebookPostRequest {
  message: string;
  link?: string;
  imageUrl?: string;
}

export interface FacebookPostResponse {
  success: boolean;
  postId?: string;
  error?: string;
}

interface FacebookPageInfo {
  id: string;
  name: string;
  category?: string;
  fan_count?: number;
  picture?: { data?: { url?: string } };
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://graph.facebook.com/v19.0';

export class FacebookService {
  private config: FacebookConfig;

  constructor(config: FacebookConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.pageAccessToken && this.config.pageId);
  }

  async publishPost(request: FacebookPostRequest): Promise<FacebookPostResponse> {
    try {
      if (!this.config.pageAccessToken || !this.config.pageId) {
        return { success: false, error: 'Facebook Page not configured' };
      }

      // If an image URL is provided, post as photo; otherwise post as feed
      const endpoint = request.imageUrl
        ? `${API_BASE}/${this.config.pageId}/photos`
        : `${API_BASE}/${this.config.pageId}/feed`;

      const body: Record<string, string> = {
        access_token: this.config.pageAccessToken,
      };

      if (request.imageUrl) {
        body.url = request.imageUrl;
        body.caption = request.message;
      } else {
        body.message = request.message;
        if (request.link) {
          body.link = request.link;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as { id?: string; error?: { message?: string } };
      if (!response.ok || !data.id) {
        return { success: false, error: data.error?.message ?? `Facebook post failed: ${response.status}` };
      }

      return { success: true, postId: data.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[FacebookService] Post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getPageInfo(): Promise<FacebookPageInfo | null> {
    try {
      if (!this.config.pageAccessToken || !this.config.pageId) {
        return null;
      }

      const res = await fetch(
        `${API_BASE}/${this.config.pageId}?fields=id,name,category,fan_count,picture&access_token=${this.config.pageAccessToken}`,
      );

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as FacebookPageInfo;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createFacebookService(): Promise<FacebookService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'facebook') as FacebookConfig | null;
  if (!keys) {
    return null;
  }
  const service = new FacebookService(keys);
  return service.isConfigured() ? service : null;
}
