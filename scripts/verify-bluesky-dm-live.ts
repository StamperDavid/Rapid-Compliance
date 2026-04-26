/**
 * Live verify: send a direct message from the brand Bluesky account
 * (`@salesvelocity.bsky.social`) to a recipient and confirm the AT
 * Protocol chat service accepts it.
 *
 * Usage:
 *   $env:BLUESKY_DM_TARGET="rapidcompliance.bsky.social"
 *   $env:BLUESKY_DM_TEXT="Optional override text"
 *   npx tsx scripts/verify-bluesky-dm-live.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { BlueskyService } from '@/lib/integrations/bluesky-service';

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

interface BlueskyCreds { identifier?: string; password?: string; pdsUrl?: string }

async function loadCreds(): Promise<BlueskyCreds> {
  const PLATFORM_ID = 'rapid-compliance-root';
  const snap = await admin.firestore().collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const social = ((snap.data()?.social as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const bluesky = (social.bluesky ?? {}) as BlueskyCreds;
  if (!bluesky.identifier || !bluesky.password) {
    throw new Error('apiKeys/social.bluesky missing identifier/password — run scripts/save-bluesky-config.ts first');
  }
  return bluesky;
}

async function main(): Promise<void> {
  const target = process.env.BLUESKY_DM_TARGET;
  if (!target) {
    console.error('BLUESKY_DM_TARGET env var required (recipient handle, e.g. rapidcompliance.bsky.social)');
    process.exit(1);
  }
  const text = process.env.BLUESKY_DM_TEXT
    ?? `[SalesVelocity.ai DM pipeline test ${new Date().toISOString()}] If you got this, the Bluesky DM path is wired end-to-end.`;

  const creds = await loadCreds();
  const service = new BlueskyService({
    identifier: creds.identifier,
    password: creds.password,
    pdsUrl: creds.pdsUrl,
  });

  console.log(`Sending DM from ${creds.identifier} → ${target}`);
  console.log(`  text: ${text}`);

  const result = await service.sendDirectMessage({ recipient: target, text });
  if (!result.success) {
    console.error(`FAIL — ${result.error}`);
    process.exit(2);
  }
  console.log(`PASS — DM sent`);
  console.log(`  convoId:   ${result.convoId}`);
  console.log(`  messageId: ${result.messageId}`);
  console.log(`\nCheck @${target}'s DM inbox — the message should be there.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
