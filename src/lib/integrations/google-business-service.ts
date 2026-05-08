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
import { getConnectedGoogleTokens } from '@/lib/integrations/google-tokens';
import { logger } from '@/lib/logger/logger';

const FILE = 'integrations/google-business-service.ts';

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

/**
 * Build a GoogleBusinessService from the operator's connected Google
 * account.
 *
 * Token source (preferred): the central Google token store
 * (`getConnectedGoogleTokens()`), which is populated by the unified
 * onboarding OAuth flow that requests the full scope bundle including
 * `business.manage`. All Google integrations (Gmail, Calendar, Drive,
 * YouTube, GBP, GA4, GSC, Ads) read from the same store so the operator
 * doesn't have to re-OAuth per service.
 *
 * Location selection (preferred): the central connected-Google doc now
 * also stores the operator's chosen `gbpAccountId` / `gbpLocationId` /
 * `gbpLocationName`. The location-picker UI at /settings/integrations
 * writes those fields via POST /api/integrations/google/gbp/select
 * after listing options via GET /api/integrations/google/gbp/locations.
 *
 * Backward-compat fallback: if no central tokens are present (or the
 * central tokens are present but no GBP location has been selected yet),
 * fall back to the legacy `apiKeys.social.google_business` per-service
 * record. That record may carry its own access token AND/OR an
 * `accountId`/`locationId` pair from before the unified flow shipped.
 *
 * Resolution order in this factory:
 *   1. Central tokens + central GBP selection → fully central path.
 *   2. Central tokens + legacy accountId/locationId → mixed path
 *      (preserved for operators who connected Google centrally but
 *      never re-picked the GBP location).
 *   3. Legacy record only (tokens + ids) → pure legacy path.
 *   4. None → return null.
 */
export async function createGoogleBusinessService(): Promise<GoogleBusinessService | null> {
  const legacyKeys = (await apiKeyService.getServiceKey(
    PLATFORM_ID,
    'google_business',
  )) as GoogleBusinessConfig | null;

  const centralTokens = await getConnectedGoogleTokens();
  if (centralTokens) {
    // Prefer the central GBP selection. Fall through to legacy ids only
    // if the operator hasn't picked a location via the new UI yet.
    const accountId = centralTokens.gbpAccountId ?? legacyKeys?.accountId;
    const locationId = centralTokens.gbpLocationId ?? legacyKeys?.locationId;

    const config: GoogleBusinessConfig = {
      accessToken: centralTokens.accessToken,
      refreshToken: centralTokens.refreshToken ?? undefined,
      accountId,
      locationId,
    };
    const service = new GoogleBusinessService(config);
    if (service.isConfigured()) {
      logger.debug('[GoogleBusinessService] using central tokens', {
        file: FILE,
        usingCentralSelection: Boolean(centralTokens.gbpAccountId && centralTokens.gbpLocationId),
        usingLegacyIds: !centralTokens.gbpAccountId || !centralTokens.gbpLocationId,
      });
      return service;
    }
    // Tokens present but no GBP account/location selected yet — fall
    // through and let the legacy path try (it has its own access token
    // we can use if the operator filled out the legacy save flow).
    logger.info(
      '[GoogleBusinessService] central tokens present but no GBP location selected — operator must pick a location at /settings/integrations',
      { file: FILE },
    );
  }

  // Legacy fallback — preserved during migration.
  if (!legacyKeys) {
    return null;
  }
  const service = new GoogleBusinessService(legacyKeys);
  return service.isConfigured() ? service : null;
}
