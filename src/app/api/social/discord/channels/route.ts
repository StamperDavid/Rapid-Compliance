/**
 * Discord Channels API
 * GET /api/social/discord/channels?guildId=<id>
 *
 * Returns the list of text/announcement/forum channels the bot can see in
 * the given guild, used by DiscordComposer's channel-picker dropdown.
 *
 * Auth: requireAuth — the caller must be a logged-in operator.
 * Bot token: read from `apiKeys/social.discord.botToken` (encrypted at rest
 * via the same path BlueskyService uses).
 *
 * If `guildId` is omitted, falls back to the connected default guild from
 * `social_accounts/{platform=discord, isDefault=true}` so the composer can
 * load channels without the operator passing a guild id.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { SocialAccountService } from '@/lib/social/social-account-service';
import { DiscordPostingService } from '@/lib/social/discord-posting-service';
import { decryptToken } from '@/lib/security/token-encryption';
import type { DiscordCredentials } from '@/types/social';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  guildId: z.string().min(1).max(64).optional(),
});

interface ChannelDTO {
  id: string;
  name: string;
  type: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/discord/channels');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({
      guildId: searchParams.get('guildId') ?? undefined,
    });
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'guildId must be a non-empty string' },
        { status: 400 },
      );
    }

    let guildId = validation.data.guildId;

    // 1. Resolve bot token. Prefer the central app's bot token from apiKeys
    // (used for SalesVelocity's own brand account); fall back to the
    // per-tenant DiscordCredentials.botToken when the connected account
    // stores it directly.
    const apiKeysEntry = await apiKeyService.getServiceKey(PLATFORM_ID, 'discord');
    const apiKeysDiscord = apiKeysEntry as { botToken?: string; guildId?: string } | null;
    let botToken = apiKeysDiscord?.botToken ?? '';

    guildId ??= apiKeysDiscord?.guildId ?? '';

    // 2. If still missing, look at the connected social_account row.
    if (!botToken || !guildId) {
      const accounts = await SocialAccountService.listAccounts('discord');
      const active = accounts.find((a) => a.status === 'active' && a.isDefault) ?? accounts[0];
      if (active && 'botToken' in active.credentials) {
        const creds = active.credentials as DiscordCredentials;
        if (!botToken && creds.botToken) {
          // Bot token may be encrypted at rest — try decrypt; fall back to raw.
          try {
            botToken = decryptToken(creds.botToken);
          } catch {
            botToken = creds.botToken;
          }
        }
        if (!guildId) {
          guildId = creds.guildId;
        }
      }
    }

    if (!botToken) {
      return NextResponse.json(
        { success: false, error: 'Discord is not connected. Save the bot token via scripts/save-discord-config.ts or finish OAuth.' },
        { status: 409 },
      );
    }

    if (!guildId) {
      return NextResponse.json(
        { success: false, error: 'No Discord guild (server) is configured. Pass ?guildId=... or connect a default server.' },
        { status: 400 },
      );
    }

    // 3. Call Discord REST.
    const discord = new DiscordPostingService(botToken);
    const channels = await discord.getChannels(guildId);

    const dto: ChannelDTO[] = channels.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));

    return NextResponse.json({ success: true, channels: dto, guildId });
  } catch (error) {
    logger.error(
      'Discord channels route error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/social/discord/channels' },
    );
    const message = error instanceof Error ? error.message : 'Failed to fetch Discord channels';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
