/**
 * Update apiKeys/{PLATFORM_ID} with proper Twilio config — fix mislabeled
 * accountSid (was holding an SK... API Key SID) and add the phone number.
 *
 * Reads from env vars so secrets never appear in shell history:
 *   $env:TWILIO_ACCOUNT_SID="ACxxx"
 *   $env:TWILIO_AUTH_TOKEN="..."           (or API Key Secret)
 *   $env:TWILIO_API_KEY_SID="SKxxx"        (optional — if using API Key auth)
 *   $env:TWILIO_API_KEY_SECRET="..."       (optional — if using API Key auth)
 *   $env:TWILIO_PHONE_NUMBER="+1XXXXXXXXXX"
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

async function main(): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !accountSid.startsWith('AC')) {
    console.error('TWILIO_ACCOUNT_SID env var must be set and start with AC');
    process.exit(1);
  }
  if (!phoneNumber || !phoneNumber.startsWith('+')) {
    console.error('TWILIO_PHONE_NUMBER env var must be set in E.164 format (+1XXXXXXXXXX)');
    process.exit(1);
  }
  if (!authToken && !(apiKeySid && apiKeySecret)) {
    console.error('Provide either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET');
    process.exit(1);
  }

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSms = (existing.sms && typeof existing.sms === 'object'
    ? (existing.sms as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const twilioConfig: Record<string, unknown> = {
    accountSid,
    phoneNumber,
  };
  if (authToken) { twilioConfig.authToken = authToken; }
  if (apiKeySid) { twilioConfig.apiKeySid = apiKeySid; }
  if (apiKeySecret) { twilioConfig.apiKeySecret = apiKeySecret; }

  const updatedSms = {
    ...existingSms,
    twilio: twilioConfig,
  };

  const nowIso = new Date().toISOString();
  const writePayload: Record<string, unknown> = {
    sms: updatedSms,
    updatedAt: nowIso,
    updatedBy: 'save-twilio-config-script',
  };
  if (!snap.exists) { writePayload.createdAt = nowIso; }

  await docRef.set(writePayload, { merge: true });

  console.log('Twilio config saved');
  console.log(`  accountSid:  ${accountSid.slice(0, 6)}...${accountSid.slice(-4)}`);
  console.log(`  phoneNumber: ${phoneNumber}`);
  if (authToken) { console.log(`  authToken:   ${authToken.slice(0, 6)}...${authToken.slice(-4)}`); }
  if (apiKeySid) { console.log(`  apiKeySid:   ${apiKeySid.slice(0, 6)}...${apiKeySid.slice(-4)}`); }
  if (apiKeySecret) { console.log(`  apiKeySecret: ${apiKeySecret.slice(0, 6)}...${apiKeySecret.slice(-4)}`); }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
