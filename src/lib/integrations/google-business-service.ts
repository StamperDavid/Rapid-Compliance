/**
 * Google Business Profile Service — Google Business Profile API integration
 * Creates posts on Google Business Profile (formerly Google My Business)
 *
 * Auth: OAuth 2.0 (Google API)
 * API: https://mybusiness.googleapis.com/v4/ (legacy) or Business Profile API
 *
 * @module integrations/google-business-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleBusinessConfig {
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  locationId?: string;
}

export interface GoogleBusinessPostRequest {
  summary: string;
  callToAction?: {
    actionType: 'BOOK' | 'ORDER' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
    url?: string;
  };
  mediaUrl?: string;
}

export interface GoogleBusinessPostResponse {
  success: boolean;
  postName?: string;
  error?: string;
}

interface GoogleBusinessLocation {
  name: string;
  title: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://mybusiness.googleapis.com/v4';

export class GoogleBusinessService {
  private config: GoogleBusinessConfig;

  constructor(config: GoogleBusinessConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken && this.config.accountId && this.config.locationId);
  }

  async createLocalPost(request: GoogleBusinessPostRequest): Promise<GoogleBusinessPostResponse> {
    try {
      if (!this.config.accessToken || !this.config.accountId || !this.config.locationId) {
        return { success: false, error: 'Google Business Profile not configured' };
      }

      const locationPath = `accounts/${this.config.accountId}/locations/${this.config.locationId}`;

      const body: Record<string, unknown> = {
        languageCode: 'en',
        summary: request.summary,
        topicType: 'STANDARD',
      };

      if (request.callToAction) {
        body.callToAction = request.callToAction;
      }

      if (request.mediaUrl) {
        body.media = [{
          mediaFormat: 'PHOTO',
          sourceUrl: request.mediaUrl,
        }];
      }

      const response = await fetch(`${API_BASE}/${locationPath}/localPosts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as {
        name?: string;
        error?: { message?: string; status?: string };
      };

      if (!response.ok || !data.name) {
        return { success: false, error: data.error?.message ?? `Google Business post failed: ${response.status}` };
      }

      return { success: true, postName: data.name };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[GoogleBusinessService] Post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getLocation(): Promise<GoogleBusinessLocation | null> {
    try {
      if (!this.config.accessToken || !this.config.accountId || !this.config.locationId) {
        return null;
      }

      const locationPath = `accounts/${this.config.accountId}/locations/${this.config.locationId}`;
      const res = await fetch(`${API_BASE}/${locationPath}`, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as GoogleBusinessLocation;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createGoogleBusinessService(): Promise<GoogleBusinessService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'google_business') as GoogleBusinessConfig | null;
  if (!keys) {
    return null;
  }
  const service = new GoogleBusinessService(keys);
  return service.isConfigured() ? service : null;
}
