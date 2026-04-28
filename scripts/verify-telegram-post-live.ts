/**
 * Live verify: send a real message to the brand's Telegram channel/group
 * via the saved Bot API token.
 *
 * Exercises:
 *   1. apiKeyService.getServiceKey('telegram') reads the saved config
 *   2. createTelegramService() builds a configured service instance
 *   3. TelegramService.sendMessage() POSTs to /sendMessage
 *   4. Telegram returns the new message id
 *
 * WARNING: This script creates a REAL message in the live channel/group.
 * The message will be visible to all members. After running, MANUALLY DELETE
 * the message from Telegram — pinned/timeline pollution looks unprofessional.
 * Run from D:\Future Rapid Compliance: npx tsx scripts/verify-telegram-post-live.ts
 *
 * Usage:
 *   npx tsx scripts/verify-telegram-post-live.ts
 *   npx tsx scripts/verify-telegram-post-live.ts --chat @SalesVelocityChannel
 *   npx tsx scripts/verify-telegram-post-live.ts --chat -1001234567890 --text "Custom"
 *
 * If --chat is omitted, falls back to the saved defaultChatId. If that's
 * also missing, the script exits with an error (Telegram requires a target).
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
