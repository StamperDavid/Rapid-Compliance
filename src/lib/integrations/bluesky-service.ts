/**
 * Bluesky Service — AT Protocol integration
 * Posts via the Bluesky API (app.bsky.feed.post)
 *
 * Auth: App password or OAuth 2.0 access token
 * API: https://bsky.social/xrpc/ (default PDS)
 *
 * @module integrations/bluesky-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BlueskyConfig {
  identifier?: string;
  password?: string;
  accessJwt?: string;
  refreshJwt?: string;
  pdsUrl?: string;
}

interface BlueskySession {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  handle: string;
}

interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

export interface BlueskyPostRequest {
  text: string;
  langs?: string[];
}

export interface BlueskyPostResponse {
  success: boolean;
  uri?: string;
  cid?: string;
  error?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class BlueskyService {
  private config: BlueskyConfig;
  private session: BlueskySession | null = null;
  private pdsUrl: string;

  constructor(config: BlueskyConfig) {
    this.config = config;
    this.pdsUrl = config.pdsUrl ?? 'https://bsky.social';
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessJwt) || Boolean(this.config.identifier && this.config.password);
  }

  private async ensureSession(): Promise<BlueskySession> {
    if (this.session) {
      return this.session;
    }

    if (this.config.accessJwt) {
      // Use existing JWT
      this.session = {
        accessJwt: this.config.accessJwt,
        refreshJwt: this.config.refreshJwt ?? '',
        did: '',
        handle: '',
      };
      return this.session;
    }

    if (!this.config.identifier || !this.config.password) {
      throw new Error('Bluesky credentials not configured');
    }

    // Create session via app password
    const response = await fetch(`${this.pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: this.config.identifier,
        password: this.config.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bluesky auth failed: ${response.status}`);
    }

    const data = (await response.json()) as BlueskySession;
    this.session = data;
    return data;
  }

  async postRecord(request: BlueskyPostRequest): Promise<BlueskyPostResponse> {
    try {
      const session = await this.ensureSession();

      const record = {
        $type: 'app.bsky.feed.post',
        text: request.text,
        langs: request.langs ?? ['en'],
        createdAt: new Date().toISOString(),
      };

      const response = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did || this.config.identifier,
          collection: 'app.bsky.feed.post',
          record,
        }),
      });

      if (!response.ok) {
        const errData = (await response.json()) as { message?: string };
        return { success: false, error: errData.message ?? `Bluesky post failed: ${response.status}` };
      }

      const data = (await response.json()) as { uri?: string; cid?: string };
      return { success: true, uri: data.uri, cid: data.cid };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[BlueskyService] Post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getProfile(): Promise<BlueskyProfile | null> {
    try {
      const session = await this.ensureSession();
      const handle = session.handle ?? this.config.identifier ?? '';

      const response = await fetch(
        `${this.pdsUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
        { headers: { Authorization: `Bearer ${session.accessJwt}` } },
      );

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as BlueskyProfile;
    } catch {
      return null;
    }
  }
}

// ─── Factory Functions ───────────────────────────────────────────────────────

export async function createBlueskyService(): Promise<BlueskyService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'bluesky') as BlueskyConfig | null;
  if (!keys) {
    return null;
  }
  const service = new BlueskyService(keys);
  return service.isConfigured() ? service : null;
}
