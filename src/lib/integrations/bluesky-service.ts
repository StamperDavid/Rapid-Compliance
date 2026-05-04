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

/**
 * Normalized Bluesky mention/reply/quote item returned by `pollMentions`.
 * `uri` + `cid` together form the strong-ref needed to reply to the post.
 */
export interface BlueskyMentionItem {
  uri: string;
  cid: string;
  authorDid: string;
  authorHandle: string;
  authorDisplayName?: string;
  reason: 'mention' | 'reply' | 'quote';
  text: string;
  indexedAt: string;
  /** URI of the post that was mentioned/replied-to/quoted (when applicable). */
  reasonSubject?: string;
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

    let bytes: ArrayBuffer = await assetResponse.arrayBuffer();

    // Bluesky's PDS rejects blobs larger than 2,000,000 bytes (2 MB) with
    // "Invalid app.bsky.feed.post record: blob too big". Auto-compress if
    // the operator's image exceeds a safe margin so the user never has to
    // know per-platform image limits — that's the point of the platform.
    // Only compress images (skip video/gif).
    const BLUESKY_MAX_BYTES = 1_900_000; // safe margin under hard 2 MB limit
    const isCompressibleImage =
      mimeType === 'image/jpeg'
      || mimeType === 'image/png'
      || mimeType === 'image/webp';
    if (isCompressibleImage && bytes.byteLength > BLUESKY_MAX_BYTES) {
      try {
        const sharpModule = (await import('sharp')).default;
        let quality = 85;
        let compressed = await sharpModule(Buffer.from(bytes))
          .rotate() // honor EXIF orientation
          .resize({ width: 1600, withoutEnlargement: true })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        while (compressed.byteLength > BLUESKY_MAX_BYTES && quality > 40) {
          quality -= 10;
          compressed = await sharpModule(Buffer.from(bytes))
            .rotate()
            .resize({ width: 1600, withoutEnlargement: true })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
        }
        // Buffer.buffer can include other allocations — slice to the exact
        // byteOffset/byteLength to get a clean ArrayBuffer for the upload.
        bytes = compressed.buffer.slice(
          compressed.byteOffset,
          compressed.byteOffset + compressed.byteLength,
        ) as ArrayBuffer;
        mimeType = 'image/jpeg';
      } catch (err) {
        // If compression fails for any reason, surface the original error
        // by letting the upload fail rather than silently posting a
        // half-broken record. This is rare (sharp is bundled).
        throw new Error(
          `uploadBlobFromUrl: image exceeds 2MB and compression failed — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

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

  /**
   * List the brand's notifications via the AT Protocol.
   *
   * GET /xrpc/app.bsky.notification.listNotifications
   *
   * Filters server-response down to mention/reply/quote items only — likes
   * and reposts are dropped because the operator-facing inbox is for
   * conversational engagement, not approval notifications.
   *
   * Live-fetched on every call. The mention-inbox UI is operator-driven
   * (live read on dashboard load + 30s poll) so persistence isn't needed.
   */
  async pollMentions(options: { limit?: number } = {}): Promise<{
    success: boolean;
    items: BlueskyMentionItem[];
    error?: string;
  }> {
    try {
      const session = await this.ensureSession();
      const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);

      const response = await fetch(
        `${this.pdsUrl}/xrpc/app.bsky.notification.listNotifications?limit=${limit}`,
        { cache: 'no-store', headers: { Authorization: `Bearer ${session.accessJwt}` } },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          items: [],
          error: `listNotifications failed: HTTP ${response.status} ${errText.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as {
        notifications?: Array<{
          uri?: string;
          cid?: string;
          author?: { did?: string; handle?: string; displayName?: string };
          reason?: string;
          reasonSubject?: string;
          record?: { text?: string };
          isRead?: boolean;
          indexedAt?: string;
        }>;
      };

      const ALLOWED = new Set(['mention', 'reply', 'quote']);
      const items: BlueskyMentionItem[] = [];

      for (const n of data.notifications ?? []) {
        const reason = n.reason ?? '';
        if (!ALLOWED.has(reason)) { continue; }
        const text = n.record?.text;
        if (typeof text !== 'string' || text.length === 0) { continue; }
        if (!n.uri || !n.author?.did || !n.author.handle) { continue; }

        items.push({
          uri: n.uri,
          cid: n.cid ?? '',
          authorDid: n.author.did,
          authorHandle: n.author.handle,
          reason: reason as 'mention' | 'reply' | 'quote',
          text,
          indexedAt: n.indexedAt ?? new Date().toISOString(),
          ...(n.author.displayName ? { authorDisplayName: n.author.displayName } : {}),
          ...(n.reasonSubject ? { reasonSubject: n.reasonSubject } : {}),
        });
      }

      return { success: true, items };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BlueskyService] pollMentions failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, items: [], error: msg };
    }
  }

  /**
   * Reply to a Bluesky post. Requires the parent post's `uri` and `cid`
   * (both returned from `pollMentions`). The AT Protocol reply embed needs
   * BOTH a `root` and `parent` strong-ref — when replying to a top-level
   * mention/reply, root === parent. Threading deeper than one level would
   * require fetching the parent's own reply ref to find the true root,
   * which is out of scope for the manual mention-inbox use case.
   */
  async replyToPost(input: {
    parentUri: string;
    parentCid: string;
    text: string;
    langs?: string[];
  }): Promise<BlueskyPostResponse> {
    const text = input.text.trim();
    if (!text) { return { success: false, error: 'text is required' }; }
    if (text.length > 300) {
      return { success: false, error: `text is ${text.length} chars; Bluesky post limit is 300` };
    }
    if (!input.parentUri || !input.parentCid) {
      return { success: false, error: 'parentUri and parentCid are required' };
    }

    try {
      const session = await this.ensureSession();
      const parentRef = { uri: input.parentUri, cid: input.parentCid };
      const record = {
        $type: 'app.bsky.feed.post',
        text,
        langs: input.langs ?? ['en'],
        createdAt: new Date().toISOString(),
        // For top-level mentions/replies, root === parent.
        reply: { root: parentRef, parent: parentRef },
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
        const errData = (await response.json().catch(() => ({}))) as { message?: string };
        return {
          success: false,
          error: errData.message ?? `Bluesky reply failed: ${response.status}`,
        };
      }

      const data = (await response.json()) as { uri?: string; cid?: string };
      return { success: true, uri: data.uri, cid: data.cid };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BlueskyService] replyToPost failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, error: msg };
    }
  }

  /**
   * List the brand's followers via app.bsky.graph.getFollowers.
   * Cursor-paginated. Open at the consumer tier — no paid tier needed.
   */
  async listFollowers(options: { cursor?: string; limit?: number } = {}): Promise<{
    followers: Array<{
      handle: string;
      displayName: string;
      avatarUrl?: string;
      bio?: string;
      profileUrl: string;
    }>;
    nextCursor?: string;
    error?: string;
  }> {
    try {
      const session = await this.ensureSession();
      const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
      const actor = session.did ?? this.config.identifier;
      if (!actor) {
        return { followers: [], error: 'Bluesky session has no actor (did/identifier)' };
      }
      const params = new URLSearchParams({ actor, limit: String(limit) });
      if (options.cursor) {
        params.set('cursor', options.cursor);
      }

      const response = await fetch(
        `${this.pdsUrl}/xrpc/app.bsky.graph.getFollowers?${params.toString()}`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.accessJwt}` },
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          followers: [],
          error: `getFollowers failed: HTTP ${response.status} ${errText.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as {
        followers?: Array<{
          did?: string;
          handle?: string;
          displayName?: string;
          avatar?: string;
          description?: string;
        }>;
        cursor?: string;
      };

      const followers = (data.followers ?? [])
        .filter((f): f is { did: string; handle: string; displayName?: string; avatar?: string; description?: string } =>
          typeof f.did === 'string' && typeof f.handle === 'string',
        )
        .map((f) => ({
          handle: f.handle,
          displayName: f.displayName ?? f.handle,
          avatarUrl: f.avatar,
          bio: f.description,
          profileUrl: `https://bsky.app/profile/${f.handle}`,
        }));

      return {
        followers,
        nextCursor: data.cursor,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BlueskyService] listFollowers failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { followers: [], error: msg };
    }
  }

  /**
   * Delete a Bluesky post via com.atproto.repo.deleteRecord. The `uri`
   * input is the AT URI (`at://did:.../app.bsky.feed.post/{rkey}`); we
   * extract the rkey for the deleteRecord call. Idempotent on the
   * platform — deleting an already-deleted record returns success.
   */
  async deletePost(uri: string): Promise<{ success: boolean; error?: string }> {
    if (!uri.startsWith('at://')) {
      return { success: false, error: `deletePost expects an AT URI, got: ${uri.slice(0, 80)}` };
    }
    const rkey = uri.split('/').pop();
    if (!rkey) {
      return { success: false, error: `Could not extract rkey from URI: ${uri}` };
    }

    try {
      const session = await this.ensureSession();
      const response = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did || this.config.identifier,
          collection: 'app.bsky.feed.post',
          rkey,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          error: `deletePost failed: HTTP ${response.status} ${errText.slice(0, 200)}`,
        };
      }
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BlueskyService] deletePost failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, error: msg };
    }
  }

  /**
   * Resolve the CID for a Bluesky post URI. AT Protocol replies + reposts
   * + quote-posts all need both the uri AND cid of the subject post; many
   * stored social-post docs only carry the uri (we didn't always capture
   * the cid at publish time). This helper hits com.atproto.repo.getRecord
   * to fetch the current cid on demand.
   */
  async getRecordCid(uri: string): Promise<{ cid?: string; error?: string }> {
    if (!uri.startsWith('at://')) {
      return { error: `getRecordCid expects an AT URI, got: ${uri.slice(0, 80)}` };
    }
    // at://did:plc:.../app.bsky.feed.post/{rkey}
    const parts = uri.replace('at://', '').split('/');
    if (parts.length < 3) {
      return { error: `Could not parse AT URI: ${uri}` };
    }
    const [repo, collection, rkey] = parts as [string, string, string];

    try {
      const session = await this.ensureSession();
      const params = new URLSearchParams({ repo, collection, rkey });
      const response = await fetch(
        `${this.pdsUrl}/xrpc/com.atproto.repo.getRecord?${params.toString()}`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.accessJwt}` },
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          error: `getRecord failed: HTTP ${response.status} ${errText.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as { cid?: string };
      if (!data.cid) {
        return { error: 'getRecord returned no cid' };
      }
      return { cid: data.cid };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BlueskyService] getRecordCid failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { error: msg };
    }
  }

  /**
   * Quote-post: create a new post that embeds the subject post via
   * app.bsky.embed.record. The operator's commentary is the new post's
   * text; the embedded subject is the strong-ref { uri, cid }.
   */
  async quotePost(input: {
    text: string;
    subjectUri: string;
    subjectCid: string;
  }): Promise<{ success: boolean; uri?: string; cid?: string; error?: string }> {
    const text = input.text.trim();
    if (!text) {
      return { success: false, error: 'text is required for quote-post' };
    }
    if (text.length > 300) {
      return { success: false, error: `text is ${text.length} chars; Bluesky post limit is 300` };
    }
    if (!input.subjectUri || !input.subjectCid) {
      return { success: false, error: 'subjectUri and subjectCid are required' };
    }

    try {
      const session = await this.ensureSession();
      const record = {
        $type: 'app.bsky.feed.post',
        text,
        langs: ['en'],
        createdAt: new Date().toISOString(),
        embed: {
          $type: 'app.bsky.embed.record',
          record: { uri: input.subjectUri, cid: input.subjectCid },
        },
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
        const errData = (await response.json().catch(() => ({}))) as { message?: string };
        return {
          success: false,
          error: errData.message ?? `Bluesky quote-post failed: ${response.status}`,
        };
      }

      const data = (await response.json()) as { uri?: string; cid?: string };
      return { success: true, uri: data.uri, cid: data.cid };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BlueskyService] quotePost failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, error: msg };
    }
  }

  /**
   * Repost (no-commentary share): writes a record of type
   * app.bsky.feed.repost referencing the subject post. The subject
   * appears in the brand's feed as a "reposted by" entry.
   */
  async repost(input: {
    subjectUri: string;
    subjectCid: string;
  }): Promise<{ success: boolean; uri?: string; cid?: string; error?: string }> {
    if (!input.subjectUri || !input.subjectCid) {
      return { success: false, error: 'subjectUri and subjectCid are required' };
    }

    try {
      const session = await this.ensureSession();
      const record = {
        $type: 'app.bsky.feed.repost',
        subject: { uri: input.subjectUri, cid: input.subjectCid },
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
          collection: 'app.bsky.feed.repost',
          record,
        }),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { message?: string };
        return {
          success: false,
          error: errData.message ?? `Bluesky repost failed: ${response.status}`,
        };
      }

      const data = (await response.json()) as { uri?: string; cid?: string };
      return { success: true, uri: data.uri, cid: data.cid };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BlueskyService] repost failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, error: msg };
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
