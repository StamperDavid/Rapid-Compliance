/**
 * Persist Telegram Bot credentials to apiKeys/social.telegram.
 *
 * The TelegramService (src/lib/integrations/telegram-service.ts) needs:
 *   $env:TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."     # bot token from @BotFather
 *   $env:TELEGRAM_DEFAULT_CHAT_ID="..."             # optional default chat/channel/group ID
 *
 * Telegram is the SIMPLEST integration — no OAuth, no app approval, just a bot token.
 *
 * How to obtain a bot token:
 *   1. In Telegram, search for @BotFather and start a chat.
 *   2. Send /newbot.
 *   3. Choose a display name (shown in chats).
 *   4. Choose a username ending in "bot" (e.g. salesvelocity_brand_bot).
 *   5. BotFather replies with the bot token (format: 123456789:ABC-DEFghi...).
 *      This token never expires unless you rotate it via /revoke.
 *
 * How to find a chat ID for the default chat:
 *   - For a public channel: just use @channelname (e.g. "@salesvelocity_news").
 *   - For a private chat/group: add the bot to the group, send any message, then
 *     fetch updates: GET https://api.telegram.org/bot{token}/getUpdates
 *     The numeric chat.id (negative for groups) is the chat ID.
 *   - For a 1-on-1 chat: the user must message the bot first, then getUpdates returns
 *     the user's positive numeric chat ID.
 *
 * IMPORTANT: The bot must be a member of (or admin in) any group/channel it posts to.
 *
 * After saving, validate by running scripts/audit-social-credentials.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

function redact(value: string): string {
  if (value.length <= 10) { return '***'; }
  return `set, length: ${value.length}`;
}

async function main(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;

  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN env var required');
    console.error('Get one from @BotFather on Telegram (see script header).');
    process.exit(1);
  }

  // Validate the token against the Telegram API BEFORE writing it.
  console.log('Validating Telegram bot token...');
  const verifyResp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`Telegram auth failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const data = await verifyResp.json() as {
    ok?: boolean;
    result?: { id?: number; username?: string; first_name?: string; is_bot?: boolean };
    description?: string;
  };
  if (!data.ok || !data.result?.is_bot) {
    console.error(`Telegram getMe failed: ${data.description ?? 'unknown error'}`);
    process.exit(3);
  }
  console.log(`✓ Authenticated as @${data.result.username ?? '(unknown)'} (${data.result.first_name ?? '(no name)'}) — id=${data.result.id}`);

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const existingTelegram = (existingSocial.telegram && typeof existingSocial.telegram === 'object'
    ? (existingSocial.telegram as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const telegramPayload: Record<string, unknown> = {
    ...existingTelegram,
    botToken,
    ...(defaultChatId ? { defaultChatId } : {}),
    botUsername: data.result.username ?? null,
    botId: data.result.id ?? null,
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        telegram: telegramPayload,
      },
      updatedAt: now,
      updatedBy: 'save-telegram-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyTelegram = (verifySocial.telegram ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved Telegram credentials at apiKeys/${PLATFORM_ID}.social.telegram`);
  console.log('  fields:');
  console.log(`    botToken: ${redact(String(verifyTelegram.botToken ?? ''))}`);
  if (typeof verifyTelegram.defaultChatId === 'string' && verifyTelegram.defaultChatId.length > 0) {
    console.log(`    defaultChatId: ${verifyTelegram.defaultChatId}`);
  }
  console.log(`    botUsername: @${String(verifyTelegram.botUsername ?? '(none)')}`);
  console.log(`    botId: ${String(verifyTelegram.botId ?? '(none)')}`);
  console.log(`  savedAt: ${String(verifyTelegram.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-telegram-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
