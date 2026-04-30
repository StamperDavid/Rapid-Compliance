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

/** The blob object returned by uploadBlob and required in embed.images[].image */
export interface BlueskyBlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export interface BlueskyPostWithImagesRequest {
  text: string;
  mediaUrls: string[];
  /** Optional alt text per image; index-aligned with mediaUrls */
  alts?: string[];
  langs?: string[];
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
      cache: 'no-store',
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
        cache: 'no-store',
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
          { cache: 'no-store', headers: { Authorization: `Bearer ${session.accessJwt}` } },
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
        { cache: 'no-store', headers: proxyHeaders },
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
        cache: 'no-store',
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

  /**
   * Upload a remote image/video to the Bluesky PDS blob store.
   *
   * Fetches raw bytes from `url`, then POSTs them to
   * `com.atproto.repo.uploadBlob` as a raw (non-multipart) body.
   * Content-Type is derived from the HTTP response header first,
   * falling back to the URL file extension.
   *
   * Returns the full blob object that must be placed verbatim in
   * `embed.images[].image` — Bluesky requires the complete blob
   * shape, not just the CID ref.
   */
  async uploadBlobFromUrl(url: string): Promise<BlueskyBlobRef> {
    const session = await this.ensureSession();

    // Fetch the remote asset
    const assetResponse = await fetch(url, { cache: 'no-store' });
    if (!assetResponse.ok) {
      throw new Error(`uploadBlobFromUrl: failed to fetch asset (${assetResponse.status}) from ${url}`);
    }

    // Detect MIME type — response header wins, URL extension is fallback
    const contentTypeHeader = assetResponse.headers.get('content-type');
    let mimeType = contentTypeHeader?.split(';')[0].trim() ?? '';
    if (!mimeType) {
      const lower = url.toLowerCase().split('?')[0];
      if (lower.endsWith('.png')) { mimeType = 'image/png'; }
      else if (lower.endsWith('.gif')) { mimeType = 'image/gif'; }
      else if (lower.endsWith('.webp')) { mimeType = 'image/webp'; }
      else if (lower.endsWith('.mp4')) { mimeType = 'video/mp4'; }
      else { mimeType = 'image/jpeg'; } // safe default for social assets
    }

    const bytes = await assetResponse.arrayBuffer();

    // POST raw bytes to the PDS blob store (NOT multipart)
    const uploadResponse = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.accessJwt}`,
        'Content-Type': mimeType,
      },
      body: bytes,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text().catch(() => '');
      throw new Error(`uploadBlob failed: HTTP ${uploadResponse.status} ${errText.slice(0, 200)}`);
    }

    const uploadData = (await uploadResponse.json()) as { blob?: BlueskyBlobRef };
    if (!uploadData.blob) {
      throw new Error('uploadBlob response missing blob field');
    }
    return uploadData.blob;
  }

  /**
   * Post a record with up to 4 embedded images (Bluesky hard limit).
   *
   * Uploads each URL in parallel via `uploadBlobFromUrl`, then builds
   * an `app.bsky.embed.images` embed and calls `createRecord` with it.
   * Extra URLs beyond the 4-image limit are silently dropped — callers
   * should slice beforehand if they need precise control over which
   * images are included.
   *
   * Session-refresh edge case: `ensureSession` is called once inside
   * `uploadBlobFromUrl` for each image (they share the same in-memory
   * session because Promise.all resolves in the same service instance).
   * If the access JWT expires mid-upload (> ~2 hours after the first
   * call on this instance), all parallel uploads will fail with 401.
   * The fix is to re-instantiate BlueskyService before calling this
   * method — the constructor clears the cached session.
   */
  async postRecordWithImages(request: BlueskyPostWithImagesRequest): Promise<BlueskyPostResponse> {
    const MAX_IMAGES = 4;
    const urls = request.mediaUrls.slice(0, MAX_IMAGES);

    if (urls.length === 0) {
      // No images — fall back to plain text post
      return this.postRecord({ text: request.text, langs: request.langs });
    }

    try {
      // Upload all blobs in parallel (all share the same session)
      const blobs = await Promise.all(urls.map((u) => this.uploadBlobFromUrl(u)));

      const session = await this.ensureSession();

      const embed = {
        $type: 'app.bsky.embed.images',
        images: blobs.map((blob, idx) => ({
          alt: request.alts?.[idx] ?? '',
          image: blob,
        })),
      };

      const record = {
        $type: 'app.bsky.feed.post',
        text: request.text,
        langs: request.langs ?? ['en'],
        createdAt: new Date().toISOString(),
        embed,
      };

      const response = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        cache: 'no-store',
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
      logger.error('[BlueskyService] postRecordWithImages failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getProfile(): Promise<BlueskyProfile | null> {
    try {
      const session = await this.ensureSession();
      const handle = session.handle ?? this.config.identifier ?? '';

      const response = await fetch(
        `${this.pdsUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
        { cache: 'no-store', headers: { Authorization: `Bearer ${session.accessJwt}` } },
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
