/**
 * Persist Discord bot credentials to apiKeys/social.discord and create/update
 * the matching social_accounts row that the dashboard reads.
 *
 * Reads from env so secrets don't appear in shell history:
 *   $env:DISCORD_BOT_TOKEN="xxxxx.xxxx.xxxxxxxxxxxxxx"
 *   $env:DISCORD_APPLICATION_ID="123456789012345678"
 *   $env:DISCORD_GUILD_ID="123456789012345678"
 *
 * The bot token is created at https://discord.com/developers/applications
 * → your app → Bot → Reset Token. Use a dedicated token per environment so
 * it can be revoked.
 *
 * The script validates the token by calling Discord REST GET /users/@me
 * BEFORE persisting — if the call fails, nothing is written.
 *
 * After saving, validate by running scripts/verify-discord-post-live.ts
 * (operator builds that script in a follow-up session).
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface DiscordBotUser {
  id: string;
  username: string;
  global_name?: string | null;
  discriminator?: string;
  avatar?: string | null;
}

interface DiscordGuild {
  id: string;
  name: string;
  owner_id?: string;
  description?: string | null;
}

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

async function main(): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!botToken || !applicationId || !guildId) {
    console.error('DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, and DISCORD_GUILD_ID env vars required');
    process.exit(1);
  }

  // ── 1. Validate the bot token by calling /users/@me ──────────────────────
  console.log('Validating bot token against Discord REST...');
  const meResp = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!meResp.ok) {
    const errText = await meResp.text();
    console.error(`Discord token validation failed: HTTP ${meResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const me = (await meResp.json()) as DiscordBotUser;
  if (!me.id || !me.username) {
    console.error('Discord /users/@me returned a response without id/username');
    process.exit(3);
  }
  const botDisplayName = me.global_name ?? me.username;
  console.log(`✓ Authenticated as bot ${botDisplayName} (id=${me.id})`);

  // ── 2. Best-effort fetch of the guild for display metadata ───────────────
  let guildName: string | null = null;
  const guildResp = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (guildResp.ok) {
    const guild = (await guildResp.json()) as DiscordGuild;
    guildName = guild.name ?? null;
    console.log(`✓ Bot is in guild "${guildName}" (id=${guild.id})`);
  } else {
    const errText = await guildResp.text();
    console.warn(`! Could not fetch guild ${guildId} (HTTP ${guildResp.status}): ${errText.slice(0, 200)}`);
    console.warn('  Saving credentials anyway. Make sure the bot has been invited to that guild before posting.');
  }

  // ── 3. Persist to apiKeys/social.discord ─────────────────────────────────
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  await docRef.set(
    {
      social: {
        ...existingSocial,
        discord: {
          botToken,
          applicationId,
          guildId,
          guildName,
          botUserId: me.id,
          botUsername: me.username,
          botDisplayName,
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'save-discord-config-script',
    },
    { merge: true },
  );

  console.log('✓ Saved apiKeys/social.discord');
  console.log(`  applicationId: ${applicationId}`);
  console.log(`  guildId:       ${guildId}`);
  console.log(`  guildName:     ${guildName ?? '(unknown — bot may not be in guild yet)'}`);
  console.log(`  botToken:      ${botToken.slice(0, 6)}...${botToken.slice(-4)}`);

  // ── 4. Create/update the social_accounts row that the dashboard reads ────
  const accountHandle = guildName ?? `guild-${guildId}`;
  const accountName = botDisplayName;
  const accountsRef = db.collection(`organizations/${PLATFORM_ID}/social_accounts`);
  const existingActive = await accountsRef
    .where('platform', '==', 'discord')
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (existingActive.empty) {
    const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await accountsRef.doc(accountId).set({
      id: accountId,
      platform: 'discord',
      accountName,
      handle: accountHandle,
      isDefault: true,
      status: 'active',
      credentials: { storedIn: 'apiKeys.social.discord' },
      addedAt: new Date().toISOString(),
    });
    console.log(`✓ Created social_accounts/${accountId} for dashboard visibility`);
  } else {
    const existingId = existingActive.docs[0].id;
    await accountsRef.doc(existingId).set({
      accountName,
      handle: accountHandle,
      lastUsedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`✓ Updated existing social_accounts/${existingId}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
