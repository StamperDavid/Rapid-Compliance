/**
 * Twitch Helix REST client for posting + metrics on the brand's own channel.
 *
 * Auth model: Helix endpoints require BOTH headers on every request:
 *   - Authorization: Bearer <user_access_token>
 *   - Client-Id:     <client_id of the central Twitch developer app>
 *
 * Per project_central_developer_apps_architecture.md, ONE central Twitch
 * app at dev.twitch.tv is used by every tenant; only the user access
 * token + broadcaster_id differ per tenant.
 *
 * Whispers (DMs) are intentionally NOT exposed by this service. Twitch's
 * Whisper API is gated/dying; the platform viability matrix marks it
 * inert. Build organic posting + metrics, leave inbound DM out.
 */

import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIG
// ============================================================================

const FILE = 'social/twitch-posting-service.ts';
const HELIX_BASE = 'https://api.twitch.tv/helix';

// ============================================================================
// TYPES — shared
// ============================================================================

export interface TwitchAuthContext {
  /** User access token for the channel owner. */
  accessToken: string;
  /** Central developer app client id. */
  clientId: string;
}

export interface TwitchHelixError {
  status: number;
  message: string;
  responseBody?: string;
}

export class TwitchHelixApiError extends Error {
  public readonly status: number;
  public readonly responseBody?: string;
  constructor(err: TwitchHelixError) {
    super(`[TwitchHelix ${err.status}] ${err.message}`);
    this.name = 'TwitchHelixApiError';
    this.status = err.status;
    this.responseBody = err.responseBody;
  }
}

// ============================================================================
// TYPES — modify-channel-information (PATCH /helix/channels)
// ============================================================================

export interface ModifyChannelInfoParams {
  /** Stream title — 140 char hard cap. */
  title?: string;
  /** Game / category id. Must be a valid Twitch category id, NOT name. */
  gameId?: string;
  /** Stream language code (ISO 639-1, e.g. "en"). */
  broadcasterLanguage?: string;
  /** Up to 10 free-form tags. */
  tags?: string[];
  /** Content classification labels (e.g. "DrugsIntoxication"). */
  contentClassificationLabels?: Array<{ id: string; isEnabled: boolean }>;
  /** Whether the broadcast contains branded content. */
  isBrandedContent?: boolean;
}

export interface ModifyChannelInfoResult {
  /** Helix returns 204 No Content on success — we surface a boolean. */
  success: true;
}

// ============================================================================
// TYPES — chat announcement (POST /helix/chat/announcements)
// ============================================================================

export type TwitchAnnouncementColor = 'primary' | 'blue' | 'green' | 'orange' | 'purple';

export interface SendChatAnnouncementParams {
  /** Message body, 1-500 chars. */
  message: string;
  /** Chat highlight color. Defaults to channel primary. */
  color?: TwitchAnnouncementColor;
}

export interface SendChatAnnouncementResult {
  success: true;
}

// ============================================================================
// TYPES — clip creation (POST /helix/clips)
// ============================================================================

export interface CreateClipResult {
  /** The created clip's URL slug. */
  clipId: string;
  /** Edit-page URL the operator can open to trim before publishing. */
  editUrl: string;
}

interface CreateClipResponseBody {
  data?: Array<{ id?: string; edit_url?: string }>;
}

// ============================================================================
// TYPES — schedule segment (POST /helix/schedule/segment)
// ============================================================================

export interface CreateScheduleSegmentParams {
  /** ISO 8601 start datetime in UTC. */
  startTime: string;
  /** Channel timezone (e.g. "America/New_York"). */
  timezone: string;
  /** Duration in minutes (30-1440). */
  durationMinutes: number;
  /** Whether this segment recurs weekly at the same day/time. */
  isRecurring?: boolean;
  /** Optional category id (game id). */
  categoryId?: string;
  /** Optional segment title (max 25 chars by Twitch contract). */
  title?: string;
}

export interface CreateScheduleSegmentResult {
  segmentId: string;
}

interface ScheduleSegmentResponseBody {
  data?: {
    segments?: Array<{ id?: string }>;
  };
}

// ============================================================================
// TYPES — channel followers (GET /helix/channels/followers)
// ============================================================================

export interface ChannelFollowersResult {
  /** Total number of followers for the broadcaster. */
  total: number;
  /** Up-to-100 most recent followers (display + followed_at). */
  recent: Array<{
    userId: string;
    userLogin: string;
    userName: string;
    followedAt: string;
  }>;
}

interface ChannelFollowersResponseBody {
  total?: number;
  data?: Array<{
    user_id?: string;
    user_login?: string;
    user_name?: string;
    followed_at?: string;
  }>;
}

// ============================================================================
// TYPES — stream info (GET /helix/streams)
// ============================================================================

export interface StreamInfoResult {
  /** True when the channel is live; everything below is null when offline. */
  isLive: boolean;
  streamId: string | null;
  gameId: string | null;
  gameName: string | null;
  title: string | null;
  viewerCount: number | null;
  startedAt: string | null;
  language: string | null;
  thumbnailUrl: string | null;
  tags: string[] | null;
}

interface StreamsResponseBody {
  data?: Array<{
    id?: string;
    game_id?: string;
    game_name?: string;
    title?: string;
    viewer_count?: number;
    started_at?: string;
    language?: string;
    thumbnail_url?: string;
    tags?: string[];
  }>;
}

// ============================================================================
// REQUEST CORE
// ============================================================================

interface HelixRequestOptions {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /**
   * 204 No Content endpoints (PATCH channels, POST chat/announcements)
   * never return a JSON body. Set this to true to short-circuit parsing.
   */
  expectNoContent?: boolean;
}

function buildUrl(pathWithLeadingSlash: string, query?: HelixRequestOptions['query']): string {
  const url = new URL(`${HELIX_BASE}${pathWithLeadingSlash}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) { continue; }
      url.searchParams.append(k, String(v));
    }
  }
  return url.toString();
}

async function readErrorBody(resp: Response): Promise<string> {
  try {
    const text = await resp.text();
    return text.slice(0, 1000);
  } catch {
    return '';
  }
}

async function helixRequest<T>(
  auth: TwitchAuthContext,
  opts: HelixRequestOptions,
): Promise<T> {
  const url = buildUrl(opts.path, opts.query);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    'Client-Id': auth.clientId,
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const init: RequestInit = {
    method: opts.method,
    headers,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }

  const resp = await fetch(url, init);

  if (!resp.ok) {
    const responseBody = await readErrorBody(resp);
    logger.error(
      `[TwitchHelix] ${opts.method} ${opts.path} failed (HTTP ${resp.status})`,
      new Error(responseBody || resp.statusText),
      { file: FILE },
    );
    throw new TwitchHelixApiError({
      status: resp.status,
      message: `${opts.method} ${opts.path} failed: ${resp.status} ${resp.statusText}`,
      responseBody,
    });
  }

  if (opts.expectNoContent || resp.status === 204) {
    return undefined as unknown as T;
  }

  const json = (await resp.json()) as T;
  return json;
}

// ============================================================================
// PUBLIC: modifyChannelInfo
// ============================================================================

/**
 * PATCH /helix/channels — update the broadcaster's channel title /
 * category / language / tags / classification.
 *
 * Required scope: channel:manage:broadcast
 */
export async function modifyChannelInfo(
  auth: TwitchAuthContext,
  broadcasterId: string,
  params: ModifyChannelInfoParams,
): Promise<ModifyChannelInfoResult> {
  if (!broadcasterId) {
    throw new Error('modifyChannelInfo: broadcasterId is required');
  }
  if (params.title !== undefined && params.title.length > 140) {
    throw new Error(`modifyChannelInfo: title exceeds 140 char cap (got ${params.title.length})`);
  }
  if (params.tags && params.tags.length > 10) {
    throw new Error(`modifyChannelInfo: tags array exceeds 10 entries (got ${params.tags.length})`);
  }

  const body: Record<string, unknown> = {};
  if (params.title !== undefined) { body.title = params.title; }
  if (params.gameId !== undefined) { body.game_id = params.gameId; }
  if (params.broadcasterLanguage !== undefined) { body.broadcaster_language = params.broadcasterLanguage; }
  if (params.tags !== undefined) { body.tags = params.tags; }
  if (params.contentClassificationLabels !== undefined) {
    body.content_classification_labels = params.contentClassificationLabels.map((l) => ({
      id: l.id,
      is_enabled: l.isEnabled,
    }));
  }
  if (params.isBrandedContent !== undefined) { body.is_branded_content = params.isBrandedContent; }

  if (Object.keys(body).length === 0) {
    throw new Error('modifyChannelInfo: at least one field must be supplied');
  }

  await helixRequest<void>(auth, {
    method: 'PATCH',
    path: '/channels',
    query: { broadcaster_id: broadcasterId },
    body,
    expectNoContent: true,
  });

  return { success: true };
}

// ============================================================================
// PUBLIC: sendChatAnnouncement
// ============================================================================

/**
 * POST /helix/chat/announcements — send a colored, pinned chat announcement.
 *
 * Required scope: moderator:manage:announcements
 *
 * The moderatorId may equal broadcasterId when the broadcaster is sending
 * the announcement themselves — that's the typical own-brand path here.
 */
export async function sendChatAnnouncement(
  auth: TwitchAuthContext,
  broadcasterId: string,
  moderatorId: string,
  message: string,
  color?: TwitchAnnouncementColor,
): Promise<SendChatAnnouncementResult> {
  if (!broadcasterId) {
    throw new Error('sendChatAnnouncement: broadcasterId is required');
  }
  if (!moderatorId) {
    throw new Error('sendChatAnnouncement: moderatorId is required');
  }
  if (!message || message.length === 0) {
    throw new Error('sendChatAnnouncement: message is required');
  }
  if (message.length > 500) {
    throw new Error(`sendChatAnnouncement: message exceeds 500 char cap (got ${message.length})`);
  }

  const body: Record<string, unknown> = { message };
  if (color !== undefined) { body.color = color; }

  await helixRequest<void>(auth, {
    method: 'POST',
    path: '/chat/announcements',
    query: { broadcaster_id: broadcasterId, moderator_id: moderatorId },
    body,
    expectNoContent: true,
  });

  return { success: true };
}

// ============================================================================
// PUBLIC: createClip
// ============================================================================

/**
 * POST /helix/clips — capture a clip from the broadcaster's currently
 * live stream.
 *
 * Required scope: clips:edit
 *
 * Returns a clip id + edit URL the operator can use to trim the clip
 * before publishing it. The clip itself becomes available a few seconds
 * after creation.
 */
export async function createClip(
  auth: TwitchAuthContext,
  broadcasterId: string,
): Promise<CreateClipResult> {
  if (!broadcasterId) {
    throw new Error('createClip: broadcasterId is required');
  }

  const json = await helixRequest<CreateClipResponseBody>(auth, {
    method: 'POST',
    path: '/clips',
    query: { broadcaster_id: broadcasterId },
  });

  const entry = json.data?.[0];
  if (!entry?.id || !entry.edit_url) {
    throw new TwitchHelixApiError({
      status: 200,
      message: 'createClip: Helix response missing id or edit_url',
      responseBody: JSON.stringify(json).slice(0, 500),
    });
  }

  return { clipId: entry.id, editUrl: entry.edit_url };
}

// ============================================================================
// PUBLIC: createScheduleSegment
// ============================================================================

/**
 * POST /helix/schedule/segment — add a segment to the broadcaster's
 * stream schedule.
 *
 * Required scope: channel:manage:schedule
 */
export async function createScheduleSegment(
  auth: TwitchAuthContext,
  broadcasterId: string,
  params: CreateScheduleSegmentParams,
): Promise<CreateScheduleSegmentResult> {
  if (!broadcasterId) {
    throw new Error('createScheduleSegment: broadcasterId is required');
  }
  if (!params.startTime) {
    throw new Error('createScheduleSegment: startTime (ISO 8601) is required');
  }
  if (!params.timezone) {
    throw new Error('createScheduleSegment: timezone is required');
  }
  if (params.durationMinutes < 30 || params.durationMinutes > 1440) {
    throw new Error(
      `createScheduleSegment: durationMinutes must be 30-1440 (got ${params.durationMinutes})`,
    );
  }
  if (params.title !== undefined && params.title.length > 25) {
    throw new Error(`createScheduleSegment: title exceeds 25 char cap (got ${params.title.length})`);
  }

  const body: Record<string, unknown> = {
    start_time: params.startTime,
    timezone: params.timezone,
    duration: String(params.durationMinutes),
  };
  if (params.isRecurring !== undefined) { body.is_recurring = params.isRecurring; }
  if (params.categoryId !== undefined) { body.category_id = params.categoryId; }
  if (params.title !== undefined) { body.title = params.title; }

  const json = await helixRequest<ScheduleSegmentResponseBody>(auth, {
    method: 'POST',
    path: '/schedule/segment',
    query: { broadcaster_id: broadcasterId },
    body,
  });

  const segmentId = json.data?.segments?.[0]?.id;
  if (!segmentId) {
    throw new TwitchHelixApiError({
      status: 200,
      message: 'createScheduleSegment: Helix response missing segments[0].id',
      responseBody: JSON.stringify(json).slice(0, 500),
    });
  }

  return { segmentId };
}

// ============================================================================
// PUBLIC: getChannelFollowers
// ============================================================================

/**
 * GET /helix/channels/followers — total + recent follower list. Used by
 * the metrics surface; the broadcaster can only see their own followers.
 *
 * Required scope: moderator:read:followers
 */
export async function getChannelFollowers(
  auth: TwitchAuthContext,
  broadcasterId: string,
): Promise<ChannelFollowersResult> {
  if (!broadcasterId) {
    throw new Error('getChannelFollowers: broadcasterId is required');
  }

  const json = await helixRequest<ChannelFollowersResponseBody>(auth, {
    method: 'GET',
    path: '/channels/followers',
    query: { broadcaster_id: broadcasterId, first: 100 },
  });

  const recent = (json.data ?? [])
    .map((f) => ({
      userId: f.user_id ?? '',
      userLogin: f.user_login ?? '',
      userName: f.user_name ?? '',
      followedAt: f.followed_at ?? '',
    }))
    .filter((f) => f.userId.length > 0);

  return {
    total: typeof json.total === 'number' ? json.total : 0,
    recent,
  };
}

// ============================================================================
// PUBLIC: getStreamInfo
// ============================================================================

/**
 * GET /helix/streams — current live status + metadata for the
 * broadcaster. Returns isLive=false when the channel is offline (Helix
 * returns an empty data array in that case).
 *
 * No additional scope required beyond app-level read.
 */
export async function getStreamInfo(
  auth: TwitchAuthContext,
  broadcasterId: string,
): Promise<StreamInfoResult> {
  if (!broadcasterId) {
    throw new Error('getStreamInfo: broadcasterId is required');
  }

  const json = await helixRequest<StreamsResponseBody>(auth, {
    method: 'GET',
    path: '/streams',
    query: { user_id: broadcasterId },
  });

  const stream = json.data?.[0];
  if (!stream) {
    return {
      isLive: false,
      streamId: null,
      gameId: null,
      gameName: null,
      title: null,
      viewerCount: null,
      startedAt: null,
      language: null,
      thumbnailUrl: null,
      tags: null,
    };
  }

  return {
    isLive: true,
    streamId: stream.id ?? null,
    gameId: stream.game_id ?? null,
    gameName: stream.game_name ?? null,
    title: stream.title ?? null,
    viewerCount: typeof stream.viewer_count === 'number' ? stream.viewer_count : null,
    startedAt: stream.started_at ?? null,
    language: stream.language ?? null,
    thumbnailUrl: stream.thumbnail_url ?? null,
    tags: Array.isArray(stream.tags) ? stream.tags : null,
  };
}
