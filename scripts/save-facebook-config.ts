/**
 * Persist Facebook Page credentials to apiKeys/social.facebook.
 *
 * The FacebookService (src/lib/integrations/facebook-service.ts) needs:
 *   $env:FACEBOOK_PAGE_ACCESS_TOKEN="..."  # long-lived Page Access Token
 *   $env:FACEBOOK_PAGE_ID="..."            # numeric Page ID
 *
 * How to obtain a long-lived Page Access Token:
 *   1. Go to https://developers.facebook.com → Apps → your app → Tools → Graph API Explorer.
 *   2. Select your app, generate a User Access Token with scopes:
 *        pages_show_list, pages_read_engagement, pages_manage_posts, pages_read_user_content
 *   3. Exchange for long-lived user token:
 *        GET /oauth/access_token?grant_type=fb_exchange_token
 *           &client_id={app-id}&client_secret={app-secret}
 *           &fb_exchange_token={short-lived-user-token}
 *   4. Get the Page Access Token (which is also long-lived when derived from a long-lived
 *      user token):
 *        GET /me/accounts?access_token={long-lived-user-token}
 *      Find your page in the response and copy its `access_token`.
 *   5. The Page ID is in the same response (`id` field of your page).
 *
 * Long-lived Page Tokens do not expire as long as the app remains installed and the user
 * who granted them keeps the connection. Re-run this script if the token is regenerated.
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
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!pageAccessToken || !pageId) {
    console.error('FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID env vars required');
    console.error('See script header for the OAuth flow that produces these.');
    process.exit(1);
  }

  // Validate the token against the Graph API BEFORE writing it.
  console.log(`Validating token for page ${pageId}...`);
  const verifyResp = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?fields=id,name,category&access_token=${encodeURIComponent(pageAccessToken)}`,
  );
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`Facebook auth failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const profile = await verifyResp.json() as { id?: string; name?: string; category?: string };
  if (!profile.id || profile.id !== pageId) {
    console.error(`Page ID mismatch: expected ${pageId}, got ${String(profile.id)}`);
    process.exit(3);
  }
  console.log(`✓ Authenticated as ${profile.name ?? '(unknown)'} (id=${profile.id}, category=${profile.category ?? '(none)'})`);

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const facebookPayload = {
    pageAccessToken,
    pageId,
    pageName: profile.name ?? null,
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        facebook: facebookPayload,
      },
      updatedAt: now,
      updatedBy: 'save-facebook-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyFacebook = (verifySocial.facebook ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved Facebook credentials at apiKeys/${PLATFORM_ID}.social.facebook`);
  console.log('  fields:');
  console.log(`    pageAccessToken: ${redact(String(verifyFacebook.pageAccessToken ?? ''))}`);
  console.log(`    pageId: ${String(verifyFacebook.pageId ?? '(missing)')}`);
  console.log(`    pageName: ${String(verifyFacebook.pageName ?? '(none)')}`);
  console.log(`  savedAt: ${String(verifyFacebook.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-facebook-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
