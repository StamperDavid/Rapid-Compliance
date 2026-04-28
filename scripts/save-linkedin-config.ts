/**
 * Persist LinkedIn credentials to apiKeys/social.linkedin.
 *
 * The LinkedInService (src/lib/integrations/linkedin-service.ts) supports two modes:
 *
 *   1) Official LinkedIn Marketing API — requires:
 *        $env:LINKEDIN_ACCESS_TOKEN="..."             # OAuth 2.0 (3-legged)
 *        $env:LINKEDIN_PERSON_URN="urn:li:person:..." # OR
 *        $env:LINKEDIN_ORGANIZATION_URN="urn:li:organization:..."
 *
 *      Marketing Developer Platform approval is required (multi-week process).
 *      Get the access token via the standard LinkedIn OAuth 3-legged flow with
 *      scopes: r_liteprofile w_member_social (or w_organization_social for pages).
 *
 *   2) RapidAPI proxy (interim option, no approval) — requires:
 *        $env:LINKEDIN_RAPIDAPI_KEY="..."
 *
 *      Sign up at rapidapi.com → search "linkedin-api" → subscribe.
 *
 * You may set both — the service prefers RapidAPI when its key is present.
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
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;
  const organizationUrn = process.env.LINKEDIN_ORGANIZATION_URN;
  const rapidApiKey = process.env.LINKEDIN_RAPIDAPI_KEY;

  const officialModeReady = Boolean(accessToken && (personUrn ?? organizationUrn));
  const rapidApiModeReady = Boolean(rapidApiKey);

  if (!officialModeReady && !rapidApiModeReady) {
    console.error('LinkedIn credentials missing. Set ONE of these env-var groups:');
    console.error('  Official: LINKEDIN_ACCESS_TOKEN + (LINKEDIN_PERSON_URN OR LINKEDIN_ORGANIZATION_URN)');
    console.error('  RapidAPI: LINKEDIN_RAPIDAPI_KEY');
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
  const existingLinkedin = (existingSocial.linkedin && typeof existingSocial.linkedin === 'object'
    ? (existingSocial.linkedin as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const linkedinPayload: Record<string, unknown> = {
    ...existingLinkedin,
    ...(accessToken ? { accessToken } : {}),
    ...(personUrn ? { personUrn } : {}),
    ...(organizationUrn ? { organizationUrn } : {}),
    ...(rapidApiKey ? { rapidApiKey, mode: 'rapidapi' } : {}),
    ...(officialModeReady && !rapidApiKey ? { mode: 'official' } : {}),
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        linkedin: linkedinPayload,
      },
      updatedAt: now,
      updatedBy: 'save-linkedin-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyLinkedin = (verifySocial.linkedin ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved LinkedIn credentials at apiKeys/${PLATFORM_ID}.social.linkedin`);
  console.log('  fields:');
  if (typeof verifyLinkedin.accessToken === 'string' && verifyLinkedin.accessToken.length > 0) {
    console.log(`    accessToken: ${redact(verifyLinkedin.accessToken)}`);
  }
  if (typeof verifyLinkedin.personUrn === 'string' && verifyLinkedin.personUrn.length > 0) {
    console.log(`    personUrn: ${verifyLinkedin.personUrn}`);
  }
  if (typeof verifyLinkedin.organizationUrn === 'string' && verifyLinkedin.organizationUrn.length > 0) {
    console.log(`    organizationUrn: ${verifyLinkedin.organizationUrn}`);
  }
  if (typeof verifyLinkedin.rapidApiKey === 'string' && verifyLinkedin.rapidApiKey.length > 0) {
    console.log(`    rapidApiKey: ${redact(verifyLinkedin.rapidApiKey)}`);
  }
  if (typeof verifyLinkedin.mode === 'string') {
    console.log(`    mode: ${verifyLinkedin.mode}`);
  }
  console.log(`  savedAt: ${String(verifyLinkedin.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-linkedin-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
