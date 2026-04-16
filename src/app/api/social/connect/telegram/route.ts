/**
 * API Route: Connect Telegram Bot
 *
 * POST /api/social/connect/telegram
 * Validates a Telegram Bot token and chat ID against the Bot API, then stores
 * the credentials in Firestore.
 *
 * Body: { botToken: string, chatId: string }
 *   - botToken: Token from @BotFather
 *   - chatId:   Numeric chat/channel ID the bot will post to
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { TelegramCredentials, SocialAccountStatus } from '@/types/social';

export const dynamic = 'force-dynamic';

const SOCIAL_ACCOUNTS_COLLECTION = getSubCollection('social_accounts');

const connectTelegramSchema = z.object({
  botToken: z
    .string()
    .min(1, 'Bot token is required')
    .regex(/^\d+:[A-Za-z0-9_-]+$/, 'Invalid bot token format'),
  chatId: z.string().min(1, 'Chat ID is required'),
});

interface TelegramGetMeResponse {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  description?: string;
}

interface TelegramGetChatResponse {
  ok: boolean;
  result?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = connectTelegramSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { botToken, chatId } = validation.data;

    // Step 1: Validate the bot token via getMe
    let botUsername: string;
    try {
      const getMeResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      const getMeData = (await getMeResponse.json()) as TelegramGetMeResponse;

      if (!getMeData.ok || !getMeData.result) {
        logger.warn('Telegram Connect: getMe failed', {
          description: getMeData.description ?? 'Unknown error',
        });
        return NextResponse.json(
          { success: false, error: 'Invalid bot token' },
          { status: 401 }
        );
      }

      botUsername = getMeData.result.username ?? getMeData.result.first_name;
    } catch (fetchError) {
      logger.error(
        'Telegram Connect: Network error calling getMe',
        fetchError instanceof Error ? fetchError : new Error(String(fetchError))
      );
      return NextResponse.json(
        { success: false, error: 'Could not reach Telegram servers. Please try again.' },
        { status: 502 }
      );
    }

    // Step 2: Validate the chat ID via getChat
    try {
      const getChatResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`
      );
      const getChatData = (await getChatResponse.json()) as TelegramGetChatResponse;

      if (!getChatData.ok) {
        logger.warn('Telegram Connect: getChat failed', {
          chatId,
          description: getChatData.description ?? 'Unknown error',
        });
        return NextResponse.json(
          {
            success: false,
            error: `Invalid chat ID. Make sure the bot has been added to the chat. (${getChatData.description ?? 'Unknown error'})`,
          },
          { status: 400 }
        );
      }
    } catch (fetchError) {
      logger.error(
        'Telegram Connect: Network error calling getChat',
        fetchError instanceof Error ? fetchError : new Error(String(fetchError))
      );
      return NextResponse.json(
        { success: false, error: 'Could not verify chat ID. Please try again.' },
        { status: 502 }
      );
    }

    // Build the credential object
    const credentials: TelegramCredentials = {
      botToken,
      chatId,
      botUsername,
    };

    // Store in Firestore
    const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const status: SocialAccountStatus = 'active';

    await AdminFirestoreService.set(
      SOCIAL_ACCOUNTS_COLLECTION,
      accountId,
      {
        id: accountId,
        platform: 'telegram',
        accountName: `@${botUsername}`,
        handle: `@${botUsername}`,
        isDefault: false,
        status,
        credentials,
        addedAt: now,
        connectedBy: authResult.user.uid,
      },
      false
    );

    logger.info('Telegram Connect: Bot connected', {
      accountId,
      botUsername,
      chatId,
      userId: authResult.user.uid,
    });

    return NextResponse.json({ success: true, botUsername });
  } catch (error: unknown) {
    logger.error(
      'Telegram Connect: POST failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { success: false, error: 'Failed to connect Telegram bot' },
      { status: 500 }
    );
  }
}
