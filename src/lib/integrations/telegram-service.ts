/**
 * Telegram Service — Telegram Bot API integration
 * Sends messages to channels/groups via Bot API
 *
 * Auth: Bot token (from @BotFather)
 * API: https://api.telegram.org/bot{token}/
 *
 * @module integrations/telegram-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TelegramConfig {
  botToken?: string;
  defaultChatId?: string;
}

export interface TelegramPostRequest {
  text: string;
  chatId?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
}

export interface TelegramPostResponse {
  success: boolean;
  messageId?: number;
  error?: string;
}

interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class TelegramService {
  private config: TelegramConfig;
  private apiBase: string;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.apiBase = `https://api.telegram.org/bot${config.botToken ?? ''}`;
  }

  isConfigured(): boolean {
    return Boolean(this.config.botToken);
  }

  async sendMessage(request: TelegramPostRequest): Promise<TelegramPostResponse> {
    try {
      if (!this.config.botToken) {
        return { success: false, error: 'Telegram bot not configured' };
      }

      const chatId = request.chatId ?? this.config.defaultChatId;
      if (!chatId) {
        return { success: false, error: 'No chat ID specified' };
      }

      const response = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: request.text,
          parse_mode: request.parseMode ?? 'HTML',
          disable_web_page_preview: request.disableWebPagePreview ?? false,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
        description?: string;
      };

      if (!data.ok) {
        return { success: false, error: data.description ?? 'Telegram message failed' };
      }

      return { success: true, messageId: data.result?.message_id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[TelegramService] Send failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getBotInfo(): Promise<TelegramBotInfo | null> {
    try {
      if (!this.config.botToken) {
        return null;
      }

      const res = await fetch(`${this.apiBase}/getMe`);
      const data = (await res.json()) as { ok?: boolean; result?: TelegramBotInfo };
      return data.ok ? (data.result ?? null) : null;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createTelegramService(): Promise<TelegramService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'telegram') as TelegramConfig | null;
  if (!keys) {
    return null;
  }
  const service = new TelegramService(keys);
  return service.isConfigured() ? service : null;
}
