/**
 * Persist Google Business Profile credentials to apiKeys/social.google_business.
 *
 * The GoogleBusinessService (src/lib/integrations/google-business-service.ts) needs:
 *   $env:GOOGLE_BUSINESS_ACCESS_TOKEN="ya29..."     # OAuth access token
 *   $env:GOOGLE_BUSINESS_REFRESH_TOKEN="1//..."     # optional but recommended (auto-refresh)
 *   $env:GOOGLE_BUSINESS_ACCOUNT_ID="..."           # numeric Account resource ID
 *   $env:GOOGLE_BUSINESS_LOCATION_ID="..."          # numeric Location resource ID
 *
 * IMPORTANT: Google Business Profile (formerly Google My Business) requires:
 *   - A claimed and verified business listing on Google Maps.
 *   - Google Cloud project with Business Profile API access (must be requested
 *     from Google — see https://developers.google.com/my-business/content/prereqs).
 *   - OAuth 2.0 with the https://www.googleapis.com/auth/business.manage scope.
 *
 * How to obtain credentials:
 *   1. Go to https://console.cloud.google.com → create/select a project.
 *   2. Submit the Business Profile API access request form (Google reviews this —
 *      can take days to weeks). API will not be enabled in your project until approved.
 *   3. Once approved, enable: Business Profile API, My Business Account Management API,
 *      My Business Business Information API.
 *   4. Set up OAuth consent screen (External, with the business.manage scope listed).
 *   5. Create OAuth client ID credentials (Type: Desktop or Web app).
 *   6. Send the brand operator through the standard Google OAuth flow with scope:
 *        https://www.googleapis.com/auth/business.manage
 *   7. Exchange the auth code for refresh_token + access_token.
 *   8. Look up the Account ID:
 *        GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts
 *      Response.accounts[].name = "accounts/{accountId}" — extract the numeric ID.
 *   9. Look up the Location ID:
 *        GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations
 *          ?readMask=name,title,storefrontAddress
 *      Response.locations[].name = "locations/{locationId}" — extract numeric ID.
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
  const accessToken = process.env.GOOGLE_BUSINESS_ACCESS_TOKEN;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;
  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;

  if (!accessToken || !accountId || !locationId) {
    console.error('GOOGLE_BUSINESS_ACCESS_TOKEN, GOOGLE_BUSINESS_ACCOUNT_ID, and GOOGLE_BUSINESS_LOCATION_ID env vars required');
    console.error('See script header for the OAuth + lookup flow.');
    process.exit(1);
  }

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const existingGb = (existingSocial.google_business && typeof existingSocial.google_business === 'object'
    ? (existingSocial.google_business as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const gbPayload: Record<string, unknown> = {
    ...existingGb,
    accessToken,
    accountId,
    locationId,
    ...(refreshToken ? { refreshToken } : {}),
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        google_business: gbPayload,
      },
      updatedAt: now,
      updatedBy: 'save-google-business-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyGb = (verifySocial.google_business ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved Google Business Profile credentials at apiKeys/${PLATFORM_ID}.social.google_business`);
  console.log('  fields:');
  console.log(`    accessToken: ${redact(String(verifyGb.accessToken ?? ''))}`);
  if (typeof verifyGb.refreshToken === 'string' && verifyGb.refreshToken.length > 0) {
    console.log(`    refreshToken: ${redact(verifyGb.refreshToken)}`);
  }
  console.log(`    accountId: ${String(verifyGb.accountId ?? '(missing)')}`);
  console.log(`    locationId: ${String(verifyGb.locationId ?? '(missing)')}`);
  console.log(`  savedAt: ${String(verifyGb.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-google-business-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
