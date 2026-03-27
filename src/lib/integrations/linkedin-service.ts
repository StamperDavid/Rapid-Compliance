/**
 * LinkedIn Service — LinkedIn API integration
 * Posts to LinkedIn profiles/pages via the LinkedIn Marketing API
 *
 * Auth: OAuth 2.0 (3-legged) or RapidAPI key
 * API: https://api.linkedin.com/v2/ (official) or RapidAPI proxy
 *
 * Supports two modes:
 * 1. Official LinkedIn API (requires approved Marketing Developer Platform app)
 * 2. RapidAPI proxy (linkedin-api.p.rapidapi.com) — simpler setup
 *
 * @module integrations/linkedin-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LinkedInServiceConfig {
  accessToken?: string;
  personUrn?: string;
  organizationUrn?: string;
  rapidApiKey?: string;
  mode?: 'official' | 'rapidapi';
}

export interface LinkedInPublishRequest {
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  mediaUrl?: string;
  articleUrl?: string;
  articleTitle?: string;
}

export interface LinkedInPublishResponse {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const OFFICIAL_API = 'https://api.linkedin.com/v2';
const RAPIDAPI_HOST = 'linkedin-api.p.rapidapi.com';

export class LinkedInService {
  private config: LinkedInServiceConfig;

  constructor(config: LinkedInServiceConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    if (this.config.mode === 'rapidapi' || this.config.rapidApiKey) {
      return Boolean(this.config.rapidApiKey);
    }
    return Boolean(this.config.accessToken && (this.config.personUrn ?? this.config.organizationUrn));
  }

  async publishPost(request: LinkedInPublishRequest): Promise<LinkedInPublishResponse> {
    // Route to the appropriate implementation
    if (this.config.rapidApiKey) {
      return this.publishViaRapidApi(request);
    }
    return this.publishViaOfficialApi(request);
  }

  private async publishViaOfficialApi(request: LinkedInPublishRequest): Promise<LinkedInPublishResponse> {
    try {
      if (!this.config.accessToken) {
        return { success: false, error: 'LinkedIn access token not configured' };
      }

      const author = this.config.organizationUrn ?? this.config.personUrn;
      if (!author) {
        return { success: false, error: 'LinkedIn author URN not configured (personUrn or organizationUrn)' };
      }

      const body: Record<string, unknown> = {
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: request.text },
            shareMediaCategory: request.articleUrl ? 'ARTICLE' : 'NONE',
            ...(request.articleUrl ? {
              media: [{
                status: 'READY',
                originalUrl: request.articleUrl,
                title: { text: request.articleTitle ?? '' },
              }],
            } : {}),
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': request.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
        },
      };

      const response = await fetch(`${OFFICIAL_API}/ugcPosts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = (await response.json()) as { message?: string };
        return { success: false, error: errData.message ?? `LinkedIn post failed: ${response.status}` };
      }

      const postId = response.headers.get('x-restli-id') ?? undefined;
      return { success: true, postId };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[LinkedInService] Official API post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  private async publishViaRapidApi(request: LinkedInPublishRequest): Promise<LinkedInPublishResponse> {
    try {
      if (!this.config.rapidApiKey) {
        return { success: false, error: 'RapidAPI key not configured for LinkedIn' };
      }

      const response = await fetch(`https://${RAPIDAPI_HOST}/create-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': this.config.rapidApiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
        body: JSON.stringify({
          text: request.text,
          visibility: request.visibility ?? 'PUBLIC',
          ...(request.articleUrl ? { link: request.articleUrl } : {}),
        }),
      });

      const data = (await response.json()) as { id?: string; urn?: string; error?: string; message?: string };
      if (!response.ok) {
        return { success: false, error: data.error ?? data.message ?? `LinkedIn RapidAPI post failed: ${response.status}` };
      }

      return { success: true, postId: data.urn ?? data.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[LinkedInService] RapidAPI post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getProfile(): Promise<LinkedInProfile | null> {
    try {
      if (this.config.rapidApiKey) {
        return await this.getProfileViaRapidApi();
      }

      if (!this.config.accessToken) {
        return null;
      }

      const res = await fetch(`${OFFICIAL_API}/me?projection=(id,firstName,lastName,headline,profilePicture)`, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        id: string;
        firstName: { localized: Record<string, string> };
        lastName: { localized: Record<string, string> };
        headline?: { localized: Record<string, string> };
      };

      return {
        id: data.id,
        firstName: Object.values(data.firstName.localized)[0] ?? '',
        lastName: Object.values(data.lastName.localized)[0] ?? '',
        headline: data.headline ? Object.values(data.headline.localized)[0] : undefined,
      };
    } catch {
      return null;
    }
  }

  private async getProfileViaRapidApi(): Promise<LinkedInProfile | null> {
    try {
      if (!this.config.rapidApiKey) {
        return null;
      }

      const res = await fetch(`https://${RAPIDAPI_HOST}/me`, {
        headers: {
          'X-RapidAPI-Key': this.config.rapidApiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        id?: string;
        firstName?: string;
        lastName?: string;
        headline?: string;
      };

      return {
        id: data.id ?? '',
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        headline: data.headline,
      };
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createLinkedInService(): Promise<LinkedInService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'linkedin') as LinkedInServiceConfig | null;
  if (!keys) {
    return null;
  }
  const service = new LinkedInService(keys);
  return service.isConfigured() ? service : null;
}
