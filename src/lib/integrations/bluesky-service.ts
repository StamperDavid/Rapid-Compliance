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
    // Reuse the in-memory session for the lifetime of this service
    // instance. We do NOT cache across instances — every fresh
    // BlueskyService starts with no session and mints one on the first
    // operation that needs auth. Bluesky access JWTs expire after a
    // couple of hours; the in-memory cache covers the few seconds of
    // a typical request, which is the only window where reuse helps.
    if (this.session) {
      return this.session;
    }

    if (!this.config.identifier || !this.config.password) {
      throw new Error('Bluesky credentials not configured (identifier + app password required)');
    }

    // Create a fresh session via app password. Cached `accessJwt` from
    // Firestore is intentionally ignored because the saved value goes
    // stale within hours of the initial save script — which previously
    // caused every send to fail with HTTP 400 ExpiredToken.
    const response = await fetch(`${this.pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: this.config.identifier,
        password: this.config.password,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Bluesky auth failed: ${response.status} ${errText.slice(0, 200)}`);
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

  /**
   * Send a direct message via Bluesky's chat service.
   *
   * Bluesky DMs route through a separate service (`api.bsky.chat`)
   * accessed via the AT Protocol's service-proxy header. The flow is:
   *   1. Resolve the recipient's DID (we accept either a handle or a did)
   *   2. Get-or-create a conversation between the brand and the recipient
   *   3. Send the message to that conversation
   *
   * Requires the app password to have been created with the "Allow access
   * to direct messages" option enabled. If the password lacks DM scope,
   * step 2 returns 401 with a clear error.
   */
  async sendDirectMessage(input: { recipient: string; text: string }): Promise<{ success: boolean; messageId?: string; convoId?: string; error?: string }> {
    const text = input.text.trim();
    if (!input.recipient) { return { success: false, error: 'recipient is required' }; }
    if (!text) { return { success: false, error: 'text is required' }; }
    if (text.length > 1000) { return { success: false, error: `text is ${text.length} chars; Bluesky DM limit is 1000` }; }

    try {
      const session = await this.ensureSession();

      // 1. Resolve recipient to a DID. Caller can pass either a handle
      // (e.g. "rapidcompliance.bsky.social") or a did directly.
      let recipientDid = input.recipient;
      if (!recipientDid.startsWith('did:')) {
        const profileResp = await fetch(
          `${this.pdsUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(input.recipient)}`,
          { headers: { Authorization: `Bearer ${session.accessJwt}` } },
        );
        if (!profileResp.ok) {
          return { success: false, error: `Could not resolve handle ${input.recipient}: HTTP ${profileResp.status}` };
        }
        const profile = await profileResp.json() as { did?: string };
        if (!profile.did) {
          return { success: false, error: `Profile for ${input.recipient} missing did field` };
        }
        recipientDid = profile.did;
      }

      // 2. Get-or-create the conversation. Chat lexicons are served by
      // the Bluesky chat service at api.bsky.chat — NOT by the personal
      // data server (bsky.social). The session token from createSession
      // is recognized by the chat service. The atproto-proxy header is
      // included for forward compatibility with proxy-aware infra.
      const chatHost = 'https://api.bsky.chat';
      const proxyHeaders = {
        Authorization: `Bearer ${session.accessJwt}`,
        'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat',
      };

      const convoResp = await fetch(
        `${chatHost}/xrpc/chat.bsky.convo.getConvoForMembers?members=${encodeURIComponent(recipientDid)}`,
        { headers: proxyHeaders },
      );
      if (!convoResp.ok) {
        const errText = await convoResp.text();
        return { success: false, error: `getConvoForMembers failed: HTTP ${convoResp.status} ${errText.slice(0, 200)}` };
      }
      const convoData = await convoResp.json() as { convo?: { id?: string } };
      const convoId = convoData.convo?.id;
      if (!convoId) {
        return { success: false, error: 'getConvoForMembers returned no convo id' };
      }

      // 3. Send the message.
      const sendResp = await fetch(`${chatHost}/xrpc/chat.bsky.convo.sendMessage`, {
        method: 'POST',
        headers: { ...proxyHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ convoId, message: { text } }),
      });
      if (!sendResp.ok) {
        const errText = await sendResp.text();
        return { success: false, convoId, error: `sendMessage failed: HTTP ${sendResp.status} ${errText.slice(0, 200)}` };
      }
      const sentData = await sendResp.json() as { id?: string };
      return { success: true, convoId, messageId: sentData.id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[BlueskyService] sendDirectMessage failed', error instanceof Error ? error : new Error(msg));
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
