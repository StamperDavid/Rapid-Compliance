/**
 * Read the current Twilio config from Firestore apiKeys/{PLATFORM_ID}.
 * Prints redacted preview only.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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

function preview(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) { return '<missing>'; }
  if (value.length < 12) { return `<short: ${value.length} chars>`; }
  return `${value.slice(0, 6)}...${value.slice(-4)}  (len=${value.length})`;
}

async function main(): Promise<void> {
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';
  const doc = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  if (!doc.exists) {
    console.log('No apiKeys doc');
    process.exit(0);
  }
  const data = doc.data() as Record<string, unknown>;

  // Twilio can live in two places — flat top-level `twilio` OR nested `sms.twilio`.
  console.log('Top-level data.twilio:');
  const flat = data.twilio as Record<string, unknown> | undefined;
  if (flat) {
    for (const [k, v] of Object.entries(flat)) {
      console.log(`  ${k}: ${preview(v)}`);
    }
  } else {
    console.log('  <not set>');
  }

  console.log('\nNested data.sms.twilio:');
  const sms = data.sms as Record<string, unknown> | undefined;
  const nested = sms?.twilio as Record<string, unknown> | undefined;
  if (nested) {
    for (const [k, v] of Object.entries(nested)) {
      console.log(`  ${k}: ${preview(v)}`);
    }
  } else {
    console.log('  <not set>');
  }

  console.log('\nFull data.sms keys:', sms ? Object.keys(sms) : '<sms not set>');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
