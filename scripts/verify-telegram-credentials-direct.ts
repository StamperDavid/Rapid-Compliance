/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - Telegram's Bot API /sendMessage endpoint accepts our saved Bot API token
 *     from apiKeyService.getServiceKey('telegram')
 *   - TelegramService.sendMessage() constructs a valid request and returns
 *     the new message id
 *
 * What this does NOT test:
 *   - The product path through Jasper → SocialMediaManager → TelegramExpert
 *     → social_post tool → Mission Control
 *   - Whether TelegramExpert.execute() (the function the orchestrator actually
 *     calls) handles the response correctly. This script bypasses it entirely.
 *
 * Renamed Apr 29 2026 from `verify-telegram-post-live.ts` because the old name
 * implied end-to-end coverage. NOTE: Telegram is marked for deletion
 * (US SMB market doesn't use it per project decision). No orchestrated
 * product-path verify exists or will be built.
 *
 * Real product path: KNOWN GAP — Telegram marked for deletion, no orchestrated verify.
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createTelegramService } from '@/lib/integrations/telegram-service';

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i > 0 && process.argv[i + 1]) { return process.argv[i + 1]; }
  return undefined;
}

async function main(): Promise<void> {
  const chatId = getArg('--chat');
  const text = getArg('--text')
    ?? `[SalesVelocity.ai pipeline test ${new Date().toISOString()}] If you can read this, the Telegram posting path is wired end-to-end.`;

  console.log('[verify-telegram-post] loading service config from Firestore...');
  const service = await createTelegramService();
  if (!service) {
    console.error('FAIL — Telegram service not configured. Save credentials via the integrations UI first.');
    process.exit(1);
  }

  // Sanity-check the bot token before sending.
  const botInfo = await service.getBotInfo();
  if (!botInfo) {
    console.error('FAIL — Telegram getMe fetch failed. Bot token may be invalid or revoked.');
    process.exit(2);
  }
  console.log(`Authenticated as @${botInfo.username} (${botInfo.first_name}, bot id ${botInfo.id})`);

  console.log(`\nSending message${chatId ? ` to ${chatId}` : ' (using defaultChatId from config)'}:`);
  console.log(`  "${text}"`);
  console.log('');

  const result = await service.sendMessage({
    text,
    ...(chatId ? { chatId } : {}),
    parseMode: 'HTML',
  });

  if (!result.success) {
    console.error(`FAIL — send rejected: ${result.error}`);
    if (result.error?.includes('chat ID')) {
      console.error('Hint: pass --chat <chatId> or set defaultChatId in the saved config.');
    }
    process.exit(3);
  }

  console.log('PASS — message sent');
  console.log(`  message id: ${result.messageId ?? '(none)'}`);
  console.log('  (Telegram does not return a public URL via Bot API. Check the chat directly.)');
  console.log('\nRemember to manually delete this message from Telegram when done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
