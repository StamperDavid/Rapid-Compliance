/**
 * Mastodon Service — generic Mastodon-API integration.
 *
 * Works against any Mastodon-family instance (mastodon.social,
 * hachyderm.io, fosstodon.org, etc.) via `instanceUrl` config.
 *
 * Auth: OAuth 2.0 Bearer token (standard Mastodon authorization-code
 * flow with `urn:ietf:wg:oauth:2.0:oob` for CLI-driven setup).
 *
 * History: this code path was attempted against Truth Social on
 * Apr 26 2026; Truth Social fronts its Mastodon-compatible API with
 * Cloudflare bot management that fingerprints the TLS handshake
 * itself (not headers), so Node fetch gets 403'd in production. The
 * `BROWSER_HEADERS` below are kept because they're harmless on
 * standards-compliant Mastodon instances and would help against any
 * Cloudflare-fronted fork that opens up.
 *
 * @module integrations/mastodon-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

/**
 * Browser-shaped request headers. Standards-compliant Mastodon
 * instances ignore these; some Cloudflare-fronted forks check them.
 * Sending unconditionally is the safe default.
 */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MastodonConfig {
  accessToken?: string;
  instanceUrl?: string;
}

export interface MastodonPostRequest {
  status: string;
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  mediaIds?: string[];
}

export interface MastodonMediaAttachment {
  id: string;
  type: string;
  url: string | null;
  preview_url: string | null;
}

export interface MastodonPostWithMediaRequest {
  status: string;
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  /** Remote URLs of images/video to attach. Silently capped at 4 (Mastodon default limit). */
  mediaUrls: string[];
  /** Alt-text description applied to every uploaded attachment. */
  mediaDescription?: string;
}

export interface MastodonPostResponse {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

interface MastodonAccount {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
}

/**
 * Normalized Mastodon mention item returned by `pollMentions`.
 *
 * - `notificationId` — id of the notification (used for `dismissNotification`)
 * - `statusId` — id of the underlying status (used as `in_reply_to_id`)
 * - `authorAcct` — full webfinger acct of the sender (e.g. `alice@mastodon.social`)
 *   needed to prefix the @-mention in any reply we compose
 */
export interface MastodonMentionItem {
  notificationId: string;
  statusId: string;
  statusUrl: string;
  authorAcct: string;
  authorDisplayName: string;
  authorProfileUrl: string;
  text: string;
  createdAt: string;
}

/**
 * Strip Mastodon's HTML status content down to plain text.
 * Mastodon serializes `<p>…</p><br>…<a href>…</a>` etc.; the operator-facing
 * inbox shows plain text so we throw away tags and decode the four entity
 * forms we actually see in the wild (&amp; &lt; &gt; &quot;).
 */
function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class MastodonService {
  private config: MastodonConfig;
  private baseUrl: string;

  constructor(config: MastodonConfig) {
    this.config = config;
    this.baseUrl = config.instanceUrl ?? 'https://mastodon.social';
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken);
  }

  async postStatus(request: MastodonPostRequest): Promise<MastodonPostResponse> {
    try {
      if (!this.config.accessToken) {
        return { success: false, error: 'Mastodon not configured' };
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
        cache: 'no-store',
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as { id?: string; url?: string; error?: string };
      if (!response.ok || !data.id) {
        return { success: false, error: data.error ?? `Mastodon post failed: ${response.status}` };
      }

      return { success: true, postId: data.id, url: data.url };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[MastodonService] Post failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getProfile(): Promise<MastodonAccount | null> {
    try {
      if (!this.config.accessToken) {
        return null;
      }

      const res = await fetch(`${this.baseUrl}/api/v1/accounts/verify_credentials`, {
        cache: 'no-store',
        headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
      });

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as MastodonAccount;
    } catch {
      return null;
    }
  }

  /**
   * Send a direct message via Mastodon.
   *
   * Mastodon-family platforms model DMs as statuses with
   * `visibility: 'direct'`. The recipient must be addressed via an
   * `@username` mention at the start of the status text — without the
   * mention, the recipient never sees it. Caller can pass either:
   *   - `@username` (or `@username@instance.example` for federated)
   *   - the bare username with an inferred instance
   * The mention is normalized below; the API receives the literal
   * `@user@instance` form when needed.
   *
   * Caller may pass `inReplyToStatusId` to thread under the inbound DM
   * (recommended — keeps the conversation rendered as a thread on
   * Mastodon UIs). When omitted, a new DM thread starts.
   *
   * Returns `{ success, messageId, error }` matching the Bluesky/X
   * service shape so the send-dm-reply route can dispatch uniformly.
   */
  async sendDirectMessage(input: { recipient: string; text: string; inReplyToStatusId?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'Mastodon not configured' };
    }
    const recipient = input.recipient.trim();
    if (!recipient) { return { success: false, error: 'recipient is required' }; }
    const text = input.text.trim();
    if (!text) { return { success: false, error: 'text is required' }; }

    // Mastodon's status hard cap is typically 500 chars; some forks
    // raise it. The mention prefix counts toward the limit.
    const mention = recipient.startsWith('@') ? recipient : `@${recipient}`;
    const composed = `${mention} ${text}`;
    if (composed.length > 500) {
      return { success: false, error: `composed status is ${composed.length} chars; Mastodon-family limit is typically 500` };
    }

    try {
      const body: Record<string, unknown> = {
        status: composed,
        visibility: 'direct',
      };
      if (input.inReplyToStatusId) {
        body.in_reply_to_id = input.inReplyToStatusId;
      }

      const response = await fetch(`${this.baseUrl}/api/v1/statuses`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { success: false, error: `Mastodon DM send failed: ${response.status} ${errText.slice(0, 200)}` };
      }

      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        return { success: false, error: 'Mastodon DM send returned no status id' };
      }
      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[MastodonService] sendDirectMessage failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  /**
   * Poll the inbox for unread direct-visibility conversations.
   *
   * Returns one entry per conversation. The dispatcher cron walks
   * unread conversations, persists a new `inboundSocialEvents` doc per
   * sender message, and marks the conversation read so the same
   * message isn't dispatched twice. Marking-read is the responsibility
   * of `markConversationRead()` below — the cron MUST call it after a
   * successful event-write so we don't lose events on a partial failure.
   */
  async pollDirectMessages(): Promise<{ success: boolean; conversations: MastodonConversation[]; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, conversations: [], error: 'Mastodon not configured' };
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/conversations?limit=40`, {
        cache: 'no-store',
        headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { success: false, conversations: [], error: `pollDirectMessages failed: ${response.status} ${errText.slice(0, 200)}` };
      }
      const raw = await response.json() as MastodonConversation[];
      return { success: true, conversations: Array.isArray(raw) ? raw : [] };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[MastodonService] pollDirectMessages failed', error instanceof Error ? error : new Error(msg));
      return { success: false, conversations: [], error: msg };
    }
  }

  /**
   * Upload a single media item from a remote URL to Mastodon's v2 media
   * endpoint and return the resulting attachment id.
   *
   * Flow:
   *   1. Fetch the remote URL to get raw bytes + content-type.
   *   2. Wrap bytes in a `Blob` and append to `FormData` as `file`.
   *   3. Optionally append `description` for alt-text accessibility.
   *   4. POST multipart form to `{instanceUrl}/api/v2/media`.
   *   5. Return the attachment `id` for use in `media_ids`.
   *
   * Note: Mastodon returns 202 for large videos (async processing) with
   * `url: null`. For images this is rare; we accept either 200 or 202
   * and return the id regardless — the status post will attach it once
   * processing finishes. Callers that need synchronous `url` availability
   * should poll `/api/v1/media/{id}` separately.
   */
  async uploadMediaFromUrl(url: string, description?: string): Promise<string> {
    if (!this.config.accessToken) {
      throw new Error('Mastodon not configured');
    }

    // Step 1 — Fetch the remote image bytes.
    const fetchResponse = await fetch(url, { cache: 'no-store' });
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch media from URL (${fetchResponse.status}): ${url}`);
    }
    const contentType = fetchResponse.headers.get('content-type') ?? 'application/octet-stream';
    const arrayBuffer = await fetchResponse.arrayBuffer();

    // Step 2 — Build multipart form with a named Blob so Mastodon can
    // detect the MIME type without relying on a file extension.
    const blob = new Blob([arrayBuffer], { type: contentType });
    const form = new FormData();
    form.append('file', blob, 'upload');

    // Step 3 — Optional alt-text.
    if (description) {
      form.append('description', description);
    }

    // Step 4 — Upload to v2 endpoint.
    const uploadResponse = await fetch(`${this.baseUrl}/api/v2/media`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...BROWSER_HEADERS,
        // Do NOT set Content-Type manually — Node/browser sets it
        // automatically with the correct multipart boundary.
        Authorization: `Bearer ${this.config.accessToken}`,
      },
      body: form,
    });

    if (uploadResponse.status !== 200 && uploadResponse.status !== 202) {
      const errText = await uploadResponse.text().catch(() => '');
      throw new Error(`Mastodon media upload failed (${uploadResponse.status}): ${errText.slice(0, 200)}`);
    }

    // Step 5 — Parse and return the attachment id.
    const data = (await uploadResponse.json()) as MastodonMediaAttachment;
    if (!data.id) {
      throw new Error('Mastodon media upload returned no attachment id');
    }

    logger.info('[MastodonService] Media uploaded', { id: data.id, type: data.type });
    return data.id;
  }

  /**
   * Post a status that includes one or more images/videos fetched from
   * remote URLs.
   *
   * Mastodon's default cap is 4 attachments per status. Any extras beyond
   * the first 4 are silently dropped here — callers that send > 4 URLs
   * should be aware only the first 4 are posted.
   *
   * Media uploads run in parallel (`Promise.all`). If any single upload
   * fails, the whole call rejects so the caller can surface the error
   * rather than posting a status with missing attachments.
   */
  async postStatusWithMedia(request: MastodonPostWithMediaRequest): Promise<MastodonPostResponse> {
    try {
      if (!this.config.accessToken) {
        return { success: false, error: 'Mastodon not configured' };
      }

      const MASTODON_MEDIA_LIMIT = 4;
      const urlsToUpload = request.mediaUrls.slice(0, MASTODON_MEDIA_LIMIT);

      if (request.mediaUrls.length > MASTODON_MEDIA_LIMIT) {
        logger.warn(
          `[MastodonService] postStatusWithMedia received ${request.mediaUrls.length} media URLs; only first ${MASTODON_MEDIA_LIMIT} will be uploaded`,
        );
      }

      // Upload all media in parallel.
      const mediaIds = await Promise.all(
        urlsToUpload.map((url) => this.uploadMediaFromUrl(url, request.mediaDescription)),
      );

      // Delegate to the existing postStatus method with the resolved ids.
      return await this.postStatus({
        status: request.status,
        visibility: request.visibility,
        mediaIds,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[MastodonService] postStatusWithMedia failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  /**
   * Mark a conversation as read so it doesn't show up in subsequent
   * polls' `unread=true` filter. Called by the dispatcher cron after a
   * successful inboundSocialEvents write.
   */
  async markConversationRead(conversationId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'Mastodon not configured' };
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: 'POST',
        cache: 'no-store',
        headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { success: false, error: `markConversationRead failed: ${response.status} ${errText.slice(0, 200)}` };
      }
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Pull recent mention notifications for the authenticated brand account.
   *
   * GET /api/v1/notifications?types[]=mention
   *
   * The `types[]=mention` filter restricts the response server-side so we
   * don't pay for likes/favourites we'd throw away. We re-filter client-side
   * as a defensive belt-and-braces — older Mastodon versions ignore the
   * `types[]` filter.
   */
  async pollMentions(options: { limit?: number } = {}): Promise<{
    success: boolean;
    items: MastodonMentionItem[];
    error?: string;
  }> {
    if (!this.config.accessToken) {
      return { success: false, items: [], error: 'Mastodon not configured' };
    }
    try {
      const limit = Math.min(Math.max(options.limit ?? 25, 1), 80);
      const url = `${this.baseUrl}/api/v1/notifications?limit=${limit}&types[]=mention`;
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          items: [],
          error: `pollMentions failed: ${response.status} ${errText.slice(0, 200)}`,
        };
      }

      const raw = (await response.json()) as Array<{
        id?: string;
        type?: string;
        created_at?: string;
        account?: { id?: string; username?: string; acct?: string; display_name?: string; url?: string };
        status?: {
          id?: string;
          url?: string | null;
          content?: string;
          visibility?: string;
        };
      }>;

      const items: MastodonMentionItem[] = [];
      for (const n of Array.isArray(raw) ? raw : []) {
        if (n.type !== 'mention') { continue; }
        if (!n.id || !n.status?.id || !n.account?.acct) { continue; }
        const html = n.status.content ?? '';
        const text = stripHtmlToPlain(html);
        if (!text) { continue; }
        items.push({
          notificationId: n.id,
          statusId: n.status.id,
          statusUrl: n.status.url ?? '',
          authorAcct: n.account.acct,
          authorDisplayName: n.account.display_name ?? n.account.username ?? n.account.acct,
          authorProfileUrl: n.account.url ?? '',
          text,
          createdAt: n.created_at ?? new Date().toISOString(),
        });
      }

      return { success: true, items };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[MastodonService] pollMentions failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, items: [], error: msg };
    }
  }

  /**
   * Reply to a Mastodon status. The recipient acct is required so we can
   * prefix the @-mention; Mastodon does NOT auto-cc the original author on
   * a reply unless the mention is in the status text itself. Without the
   * prefix the reply renders awkwardly in clients that hide
   * replies-without-mention.
   *
   * Visibility defaults to `public` because mentions are public-by-default.
   * Setting `direct` would convert the reply into a DM and hide it from
   * the conversation thread.
   */
  async replyToStatus(input: {
    inReplyToStatusId: string;
    /**
     * Recipient acct (e.g. `alice@mastodon.social`). When replying to a
     * mention from another user, this is REQUIRED so we can prefix the
     * @-mention. When replying to your OWN post (a self-thread), pass
     * undefined and we skip the prefix.
     */
    recipientAcct?: string;
    text: string;
    visibility?: 'public' | 'unlisted' | 'private';
  }): Promise<MastodonPostResponse> {
    if (!this.config.accessToken) {
      return { success: false, error: 'Mastodon not configured' };
    }
    const text = input.text.trim();
    if (!text) { return { success: false, error: 'text is required' }; }
    if (!input.inReplyToStatusId) {
      return { success: false, error: 'inReplyToStatusId is required' };
    }

    const composed = input.recipientAcct
      ? `${input.recipientAcct.startsWith('@') ? input.recipientAcct : `@${input.recipientAcct}`} ${text}`
      : text;
    if (composed.length > 500) {
      return {
        success: false,
        error: `composed status is ${composed.length} chars; Mastodon limit is typically 500`,
      };
    }

    try {
      const body = {
        status: composed,
        visibility: input.visibility ?? 'public',
        in_reply_to_id: input.inReplyToStatusId,
      };
      const response = await fetch(`${this.baseUrl}/api/v1/statuses`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          error: `Mastodon reply failed: ${response.status} ${errText.slice(0, 200)}`,
        };
      }
      const data = (await response.json()) as { id?: string; url?: string };
      if (!data.id) {
        return { success: false, error: 'Mastodon reply returned no status id' };
      }
      return { success: true, postId: data.id, url: data.url };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[MastodonService] replyToStatus failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, error: msg };
    }
  }

  /**
   * Dismiss a single notification server-side so it doesn't appear in
   * future polls. POST /api/v1/notifications/{id}/dismiss marks the
   * notification as read for THIS account; the underlying status is
   * untouched. Used by the mention-inbox "Skip" button so a dismissed
   * mention stays gone across browser refreshes.
   */
  async dismissNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'Mastodon not configured' };
    }
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/notifications/${encodeURIComponent(notificationId)}/dismiss`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
        },
      );
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          error: `dismissNotification failed: ${response.status} ${errText.slice(0, 200)}`,
        };
      }
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * List the brand's followers via GET /api/v1/accounts/{id}/followers.
   *
   * Mastodon's pagination uses Link headers with `max_id` (next page) and
   * `min_id` (previous page) — we surface `max_id` as the opaque cursor
   * so the caller can round-trip without knowing Mastodon's vocabulary.
   * Open at the consumer tier — no paid tier needed.
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
    if (!this.config.accessToken) {
      return { followers: [], error: 'Mastodon not configured' };
    }

    const profile = await this.getProfile();
    if (!profile) {
      return { followers: [], error: 'Could not load Mastodon profile' };
    }
    const accountId = profile.id;
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 80);

    const params = new URLSearchParams({ limit: String(limit) });
    if (options.cursor) {
      params.set('max_id', options.cursor);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/accounts/${encodeURIComponent(accountId)}/followers?${params.toString()}`,
        {
          cache: 'no-store',
          headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          followers: [],
          error: `listFollowers failed: HTTP ${response.status} ${errText.slice(0, 200)}`,
        };
      }

      // Parse the Link header for the next-page max_id.
      let nextCursor: string | undefined;
      const linkHeader = response.headers.get('link') ?? response.headers.get('Link');
      if (linkHeader) {
        const nextMatch = /<([^>]+)>;\s*rel="next"/i.exec(linkHeader);
        if (nextMatch?.[1]) {
          const nextUrl = new URL(nextMatch[1]);
          const maxId = nextUrl.searchParams.get('max_id');
          if (maxId) {
            nextCursor = maxId;
          }
        }
      }

      const accounts = (await response.json()) as Array<{
        id?: string;
        username?: string;
        acct?: string;
        display_name?: string;
        avatar?: string;
        avatar_static?: string;
        note?: string;
        url?: string;
      }>;

      const followers = accounts
        .filter((a): a is { id: string; username: string; acct: string; display_name?: string; avatar?: string; avatar_static?: string; note?: string; url?: string } =>
          typeof a.id === 'string' && typeof a.username === 'string' && typeof a.acct === 'string',
        )
        .map((a) => ({
          handle: `@${a.acct}`,
          displayName: a.display_name && a.display_name.length > 0 ? a.display_name : a.username,
          avatarUrl: a.avatar ?? a.avatar_static,
          // Strip HTML tags from bio for plain-text display.
          bio: a.note
            ? a.note
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>\s*<p>/gi, '\n\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .trim()
            : undefined,
          // Mastodon's `url` is canonical; fall back to constructing from
          // baseUrl + acct if it's missing for any reason.
          profileUrl: a.url ?? `${this.baseUrl}/@${a.acct}`,
        }));

      return {
        followers,
        ...(nextCursor ? { nextCursor } : {}),
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[MastodonService] listFollowers failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { followers: [], error: msg };
    }
  }

  /**
   * Delete a Mastodon status (post). DELETE /api/v1/statuses/{id}
   * Returns 200 with the deleted status body on success; 404 if the
   * status was already deleted (we treat 404 as idempotent success).
   */
  async deleteStatus(statusId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'Mastodon not configured' };
    }
    if (!statusId) {
      return { success: false, error: 'statusId is required' };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/statuses/${encodeURIComponent(statusId)}`,
        {
          method: 'DELETE',
          cache: 'no-store',
          headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
        },
      );

      // 404 = already deleted = idempotent success.
      if (response.status === 404) {
        return { success: true };
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          error: `deleteStatus failed: HTTP ${response.status} ${errText.slice(0, 200)}`,
        };
      }

      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[MastodonService] deleteStatus failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, error: msg };
    }
  }

  /**
   * Reblog (Mastodon's repost primitive) via POST
   * /api/v1/statuses/{id}/reblog. Returns the reblog wrapper status —
   * we surface its id as `postId` so the caller can link to it.
   *
   * Note: Mastodon has no quote-post primitive. Quote-reposts are
   * rejected at the route layer with an explicit error before reaching
   * this method.
   */
  async reblogStatus(statusId: string): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'Mastodon not configured' };
    }
    if (!statusId) {
      return { success: false, error: 'statusId is required' };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/statuses/${encodeURIComponent(statusId)}/reblog`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${this.config.accessToken}` },
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          error: `reblogStatus failed: HTTP ${response.status} ${errText.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        return { success: false, error: 'reblog returned no status id' };
      }
      return { success: true, postId: data.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        '[MastodonService] reblogStatus failed',
        error instanceof Error ? error : new Error(msg),
      );
      return { success: false, error: msg };
    }
  }
}

// ─── Conversation/Status types (Mastodon-shaped) ─────────────────────────────

export interface MastodonConversation {
  id: string;
  unread: boolean;
  accounts: Array<{
    id: string;
    username: string;
    acct: string;
    display_name: string;
  }>;
  last_status: {
    id: string;
    content: string;
    created_at: string;
    visibility: string;
    account: {
      id: string;
      username: string;
      acct: string;
    };
    /**
     * Mastodon's media attachment array. When a sender attaches an
     * image/video/audio to their DM, it appears here. The dispatcher
     * forwards URL + alt-text to the specialist so the AI can actually
     * see the attachment instead of replying confused-by-text-only.
     */
    media_attachments?: Array<{
      id: string;
      type: 'image' | 'video' | 'audio' | 'gifv' | 'unknown';
      url: string;
      preview_url?: string;
      description?: string | null; // Mastodon's term for alt text
    }>;
  } | null;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createMastodonService(): Promise<MastodonService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'mastodon') as MastodonConfig | null;
  if (!keys) {
    return null;
  }
  const service = new MastodonService(keys);
  return service.isConfigured() ? service : null;
}
