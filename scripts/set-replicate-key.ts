/**
 * One-shot: write the Replicate API token into the apiKeys Firestore doc.
 *
 * Usage:
 *   REPLICATE_KEY="r8_..." npx tsx scripts/set-replicate-key.ts
 *
 * Reads the key from env so it never lands in git history. Merges into
 * the existing `audio.replicate.apiKey` slot — does not overwrite other
 * audio-section credentials.
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
  if (!fs.existsSync(sakPath)) {
    throw new Error('No serviceAccountKey.json at repo root');
  }
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

async function main(): Promise<void> {
  const key = process.env.REPLICATE_KEY;
  if (!key || key.length < 10) {
    console.error('REPLICATE_KEY env var not set (or too short).');
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';
  const ref = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);

  await ref.set(
    {
      audio: {
        replicate: {
          apiKey: key,
        },
      },
    },
    { merge: true },
  );

  console.log(`Replicate API key saved (length=${key.length}, preview=${key.slice(0, 6)}...${key.slice(-4)})`);
  console.log('Path: organizations/rapid-compliance-root/apiKeys/rapid-compliance-root → audio.replicate.apiKey');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
