/**
 * Discord REST client (API v10).
 *
 * Wraps the subset of the Discord REST API the platform actually publishes:
 *  - sendChannelMessage       Plain or rich (embeds) message into a channel
 *  - createScheduledEvent     Guild-level scheduled event
 *  - createWebhookMessage     Post via an incoming-webhook URL (no bot token)
 *  - getGuildInfo             Read guild name / icon for display
 *  - getChannels              List text channels for the channel-picker UI
 *
 * Bot-token endpoints authenticate via `Authorization: Bot <token>`.
 * Webhook delivery uses the webhook URL directly and needs no auth header.
 *
 * @module social/discord-posting-service
 */

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// ─── Discord domain types (subset we actually use) ───────────────────────────

/** Discord channel types we care about. 0=GUILD_TEXT, 5=GUILD_ANNOUNCEMENT, 15=GUILD_FORUM. */
export type DiscordChannelType = 0 | 1 | 2 | 3 | 4 | 5 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export interface DiscordChannel {
  id: string;
  type: DiscordChannelType;
  name: string;
  /** Position within the channel list. Lower = higher in the UI. */
  position?: number;
  /** Parent category id, if any. */
  parent_id?: string | null;
  /** True for NSFW channels — we exclude these from any UI. */
  nsfw?: boolean;
  /** Server (guild) id this channel belongs to. */
  guild_id?: string;
}

export interface DiscordGuildInfo {
  id: string;
  name: string;
  /** Hash that combines with id to form the icon URL, or null. */
  icon: string | null;
  description: string | null;
  ownerId: string;
  approximateMemberCount?: number;
  approximatePresenceCount?: number;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  url?: string | null;
  /** Discord expects color as a 24-bit integer; we accept hex and convert. */
  colorHex?: string | null;
}

export interface SendChannelMessageResult {
  /** Discord message id (snowflake). */
  id: string;
  channelId: string;
  /** ISO timestamp the message was created. */
  timestamp: string;
}

export interface CreateScheduledEventParams {
  /** 1-100 chars. */
  name: string;
  /** 1-1000 chars. */
  description: string;
  /** ISO 8601 string. */
  startTimeIso: string;
  /** ISO 8601 string, optional. Required when entityType=EXTERNAL. */
  endTimeIso?: string | null;
  /** Where the event happens — URL or place description. */
  externalLocation: string;
  /** Privacy level. Discord currently only supports 2=GUILD_ONLY. */
  privacyLevel?: 2;
}

export interface CreateScheduledEventResult {
  id: string;
  guildId: string;
  name: string;
  scheduledStartTime: string;
  scheduledEndTime: string | null;
}

export interface CreateWebhookMessageParams {
  webhookUrl: string;
  content: string;
  /** Optional override of the webhook's default username. */
  username?: string;
  /** Optional override of the webhook's default avatar. */
  avatarUrl?: string;
  embeds?: DiscordEmbed[];
}

export interface CreateWebhookMessageResult {
  /** Discord doesn't always return a body — when it does, this is the message id. */
  id: string | null;
}

// ─── Discord API error ───────────────────────────────────────────────────────

export class DiscordApiError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly endpoint: string;
  readonly responseBody: string;

  constructor(endpoint: string, status: number, code: number | null, responseBody: string) {
    super(`Discord API ${endpoint} failed: HTTP ${status}${code !== null ? ` (code=${code})` : ''}`);
    this.name = 'DiscordApiError';
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
    this.responseBody = responseBody;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

interface DiscordErrorResponse {
  code?: number;
  message?: string;
}

async function parseErrorBody(text: string): Promise<{ code: number | null; message: string }> {
  await Promise.resolve();
  try {
    const parsed = JSON.parse(text) as DiscordErrorResponse;
    return {
      code: typeof parsed.code === 'number' ? parsed.code : null,
      message: typeof parsed.message === 'string' ? parsed.message : text,
    };
  } catch {
    return { code: null, message: text };
  }
}

/**
 * Convert "#RRGGBB" to the 24-bit integer Discord wants in embed.color.
 * Returns undefined when input is null/undefined or malformed.
 */
function hexColorToInt(hex: string | null | undefined): number | undefined {
  if (!hex) { return undefined; }
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) { return undefined; }
  return parseInt(m[1], 16);
}

interface DiscordEmbedWire {
  title: string;
  description: string;
  url?: string;
  color?: number;
}

function toWireEmbed(embed: DiscordEmbed): DiscordEmbedWire {
  const wire: DiscordEmbedWire = {
    title: embed.title,
    description: embed.description,
  };
  if (embed.url) { wire.url = embed.url; }
  const color = hexColorToInt(embed.colorHex);
  if (color !== undefined) { wire.color = color; }
  return wire;
}

async function discordFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${DISCORD_API_BASE}${path}`, init);
}

async function readErrorAndThrow(endpoint: string, resp: Response): Promise<never> {
  const text = await resp.text();
  const { code, message } = await parseErrorBody(text);
  throw new DiscordApiError(endpoint, resp.status, code, message);
}

// ─── Public service class ────────────────────────────────────────────────────

export class DiscordPostingService {
  private readonly botToken: string;

  constructor(botToken: string) {
    if (!botToken || botToken.trim().length === 0) {
      throw new Error('DiscordPostingService: botToken is required');
    }
    this.botToken = botToken;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bot ${this.botToken}`,
      'Content-Type': 'application/json',
    };
  }

  // ── Read: guild metadata ───────────────────────────────────────────────────

  async getGuildInfo(guildId: string): Promise<DiscordGuildInfo> {
    if (!guildId) { throw new Error('getGuildInfo: guildId is required'); }
    const endpoint = `/guilds/${encodeURIComponent(guildId)}?with_counts=true`;
    const resp = await discordFetch(endpoint, { headers: this.authHeaders() });
    if (!resp.ok) { await readErrorAndThrow(endpoint, resp); }

    interface GuildResponse {
      id: string;
      name: string;
      icon: string | null;
      description: string | null;
      owner_id: string;
      approximate_member_count?: number;
      approximate_presence_count?: number;
    }

    const data = (await resp.json()) as GuildResponse;
    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      description: data.description,
      ownerId: data.owner_id,
      approximateMemberCount: data.approximate_member_count,
      approximatePresenceCount: data.approximate_presence_count,
    };
  }

  // ── Read: text channels for the channel picker ──────────────────────────────

  async getChannels(guildId: string): Promise<DiscordChannel[]> {
    if (!guildId) { throw new Error('getChannels: guildId is required'); }
    const endpoint = `/guilds/${encodeURIComponent(guildId)}/channels`;
    const resp = await discordFetch(endpoint, { headers: this.authHeaders() });
    if (!resp.ok) { await readErrorAndThrow(endpoint, resp); }

    const raw = (await resp.json()) as DiscordChannel[];

    // Filter to channel types the brand can post into via a bot:
    //   0  = GUILD_TEXT
    //   5  = GUILD_ANNOUNCEMENT
    //  15  = GUILD_FORUM (post = thread)
    // Drop NSFW and any thread types (those are 10/11/12 — separate flow).
    return raw
      .filter((c) => (c.type === 0 || c.type === 5 || c.type === 15) && c.nsfw !== true)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  // ── Write: send a channel message ─────────────────────────────────────────

  async sendChannelMessage(
    channelId: string,
    content: string,
    embeds?: DiscordEmbed[],
  ): Promise<SendChannelMessageResult> {
    if (!channelId) { throw new Error('sendChannelMessage: channelId is required'); }
    if (content.length > 2000) {
      throw new Error(`sendChannelMessage: content exceeds 2000-char Discord limit (got ${content.length})`);
    }
    if ((!content || content.trim().length === 0) && (!embeds || embeds.length === 0)) {
      throw new Error('sendChannelMessage: content or at least one embed is required');
    }

    const body: { content: string; embeds?: DiscordEmbedWire[] } = { content };
    if (embeds && embeds.length > 0) {
      body.embeds = embeds.map(toWireEmbed);
    }

    const endpoint = `/channels/${encodeURIComponent(channelId)}/messages`;
    const resp = await discordFetch(endpoint, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) { await readErrorAndThrow(endpoint, resp); }

    interface MessageResponse {
      id: string;
      channel_id: string;
      timestamp: string;
    }

    const data = (await resp.json()) as MessageResponse;
    return {
      id: data.id,
      channelId: data.channel_id,
      timestamp: data.timestamp,
    };
  }

  // ── Write: create a guild scheduled event ─────────────────────────────────

  async createScheduledEvent(
    guildId: string,
    params: CreateScheduledEventParams,
  ): Promise<CreateScheduledEventResult> {
    if (!guildId) { throw new Error('createScheduledEvent: guildId is required'); }
    if (params.name.length === 0 || params.name.length > 100) {
      throw new Error(`createScheduledEvent: name must be 1-100 chars (got ${params.name.length})`);
    }
    if (params.description.length === 0 || params.description.length > 1000) {
      throw new Error(`createScheduledEvent: description must be 1-1000 chars (got ${params.description.length})`);
    }

    // Discord requires entity_metadata.location and scheduled_end_time when
    // entity_type=3 (EXTERNAL). End time defaults to start + 1h when null.
    const startMs = Date.parse(params.startTimeIso);
    if (Number.isNaN(startMs)) {
      throw new Error(`createScheduledEvent: startTimeIso is not a valid ISO timestamp: ${params.startTimeIso}`);
    }
    const endIso = params.endTimeIso ?? new Date(startMs + 60 * 60 * 1000).toISOString();
    const endMs = Date.parse(endIso);
    if (Number.isNaN(endMs)) {
      throw new Error(`createScheduledEvent: endTimeIso is not a valid ISO timestamp: ${endIso}`);
    }
    if (endMs <= startMs) {
      throw new Error('createScheduledEvent: endTimeIso must be after startTimeIso');
    }

    const body = {
      name: params.name,
      description: params.description,
      scheduled_start_time: params.startTimeIso,
      scheduled_end_time: endIso,
      privacy_level: params.privacyLevel ?? 2,
      entity_type: 3, // EXTERNAL
      entity_metadata: { location: params.externalLocation },
    };

    const endpoint = `/guilds/${encodeURIComponent(guildId)}/scheduled-events`;
    const resp = await discordFetch(endpoint, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) { await readErrorAndThrow(endpoint, resp); }

    interface ScheduledEventResponse {
      id: string;
      guild_id: string;
      name: string;
      scheduled_start_time: string;
      scheduled_end_time: string | null;
    }

    const data = (await resp.json()) as ScheduledEventResponse;
    return {
      id: data.id,
      guildId: data.guild_id,
      name: data.name,
      scheduledStartTime: data.scheduled_start_time,
      scheduledEndTime: data.scheduled_end_time,
    };
  }
}

// ─── Webhook posting (no bot token) ──────────────────────────────────────────

/**
 * Post a message via an incoming-webhook URL. No bot token required —
 * the webhook URL itself is the credential.
 *
 * Webhook URLs look like:
 *   https://discord.com/api/webhooks/<id>/<token>
 *
 * Pass `wait=true` to get back the created message id.
 */
export async function createWebhookMessage(
  params: CreateWebhookMessageParams,
): Promise<CreateWebhookMessageResult> {
  if (!params.webhookUrl) { throw new Error('createWebhookMessage: webhookUrl is required'); }
  if (params.content.length > 2000) {
    throw new Error(`createWebhookMessage: content exceeds 2000-char Discord limit (got ${params.content.length})`);
  }
  if ((!params.content || params.content.trim().length === 0) && (!params.embeds || params.embeds.length === 0)) {
    throw new Error('createWebhookMessage: content or at least one embed is required');
  }

  // Validate the URL is a Discord webhook (defensive — surfaces typos early).
  let parsed: URL;
  try {
    parsed = new URL(params.webhookUrl);
  } catch {
    throw new Error(`createWebhookMessage: webhookUrl is not a valid URL: ${params.webhookUrl}`);
  }
  if (parsed.host !== 'discord.com' && parsed.host !== 'discordapp.com') {
    throw new Error(`createWebhookMessage: webhookUrl host must be discord.com (got ${parsed.host})`);
  }

  const body: {
    content: string;
    username?: string;
    avatar_url?: string;
    embeds?: DiscordEmbedWire[];
  } = { content: params.content };
  if (params.username) { body.username = params.username; }
  if (params.avatarUrl) { body.avatar_url = params.avatarUrl; }
  if (params.embeds && params.embeds.length > 0) {
    body.embeds = params.embeds.map(toWireEmbed);
  }

  // Append wait=true so Discord returns the created message id.
  const url = new URL(params.webhookUrl);
  url.searchParams.set('wait', 'true');

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    const { code, message } = await parseErrorBody(text);
    throw new DiscordApiError('webhook POST', resp.status, code, message);
  }

  // 204 No Content when wait was ignored; otherwise the response is the message.
  if (resp.status === 204) {
    return { id: null };
  }
  interface WebhookMessageResponse { id?: string }
  const data = (await resp.json()) as WebhookMessageResponse;
  return { id: typeof data.id === 'string' ? data.id : null };
}
