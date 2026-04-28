/**
 * Persist Instagram Business credentials to apiKeys/social.instagram.
 *
 * The InstagramService (src/lib/integrations/instagram-service.ts) needs:
 *   $env:INSTAGRAM_ACCESS_TOKEN="..."         # IG Graph API token (long-lived)
 *   $env:INSTAGRAM_ACCOUNT_ID="..."           # IG Business Account ID (NOT the IG handle)
 *
 * IMPORTANT: Instagram posting requires an Instagram BUSINESS or CREATOR account
 * linked to a Facebook Page. Personal Instagram accounts cannot post via the API.
 *
 * How to obtain the credentials:
 *   1. Convert the Instagram account to a Business or Creator profile (in the IG app:
 *      Settings > Account > Switch to Professional Account).
 *   2. Link the IG account to a Facebook Page (also in IG app, Account > Linked Accounts).
 *   3. In Meta Business Suite, ensure the Page and IG account are both managed by your app.
 *   4. Generate an access token with scopes:
 *        instagram_basic, instagram_content_publish, pages_read_engagement, pages_show_list
 *      Use the long-lived Page Access Token from your Facebook integration — Instagram
 *      uses the same token system.
 *   5. Look up the IG Business Account ID:
 *        GET /{page-id}?fields=instagram_business_account&access_token={page-token}
 *      The response contains `instagram_business_account.id` — that's your INSTAGRAM_ACCOUNT_ID.
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
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!accessToken || !instagramAccountId) {
    console.error('INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID env vars required');
    console.error('See script header for the OAuth + lookup flow.');
    process.exit(1);
  }

  // Validate the credentials against the Graph API BEFORE writing them.
  console.log(`Validating token for IG account ${instagramAccountId}...`);
  const verifyResp = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(instagramAccountId)}?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`Instagram auth failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const profile = await verifyResp.json() as { id?: string; username?: string; name?: string };
  if (!profile.id || profile.id !== instagramAccountId) {
    console.error(`IG account ID mismatch: expected ${instagramAccountId}, got ${String(profile.id)}`);
    process.exit(3);
  }
  console.log(`✓ Authenticated as @${profile.username ?? '(unknown)'} (${profile.name ?? '(no display name)'}) — id=${profile.id}`);

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const instagramPayload = {
    accessToken,
    instagramAccountId,
    username: profile.username ?? null,
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        instagram: instagramPayload,
      },
      updatedAt: now,
      updatedBy: 'save-instagram-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyInstagram = (verifySocial.instagram ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved Instagram credentials at apiKeys/${PLATFORM_ID}.social.instagram`);
  console.log('  fields:');
  console.log(`    accessToken: ${redact(String(verifyInstagram.accessToken ?? ''))}`);
  console.log(`    instagramAccountId: ${String(verifyInstagram.instagramAccountId ?? '(missing)')}`);
  console.log(`    username: ${String(verifyInstagram.username ?? '(none)')}`);
  console.log(`  savedAt: ${String(verifyInstagram.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-instagram-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
