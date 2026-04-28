/**
 * Audit social-platform credentials in dev Firestore.
 *
 * For each of the 14 supported social platforms, reports:
 *   - whether a credential blob exists at apiKeys/social.<platform>
 *   - whether the minimum fields each platform service needs are present
 *   - the last-saved timestamp (from the parent doc's updatedAt)
 *
 * READ-ONLY. Does not modify Firestore. Does not post anything live.
 *
 * Usage:
 *   npx tsx scripts/audit-social-credentials.ts
 *
 * Output: per-platform single-line status (READY / PARTIAL / MISSING) plus
 * a one-line summary at the bottom. Exit code 0 always (this is a report,
 * not a gate).
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ─── env + admin bootstrap (mirrors save-*-config.ts pattern) ──────────────

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
    return;
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey } as admin.ServiceAccount),
    });
    return;
  }
  throw new Error('No serviceAccountKey.json and no FIREBASE_ADMIN_* env vars found');
}

initAdmin();

// ─── platform definitions ──────────────────────────────────────────────────

type PlatformStatus = 'READY' | 'PARTIAL' | 'MISSING';

interface PlatformSpec {
  /** Platform key as it appears in apiKeys/social.<key>. */
  key: string;
  /** Required fields the *-service.ts isConfigured() check needs. */
  requiredFields: ReadonlyArray<string>;
  /** Optional aliases. If a required field is missing, an alias of the same
   *  semantic role can satisfy it (e.g. Twitter accepts bearerToken OR the
   *  full OAuth1 quartet). When `aliasGroups` is set, requiredFields is
   *  ignored and we instead require ANY of the alias groups to be fully
   *  present.
   */
  aliasGroups?: ReadonlyArray<ReadonlyArray<string>>;
  /** One-line human description of what's needed when MISSING. */
  setupHint: string;
}

const PLATFORMS: ReadonlyArray<PlatformSpec> = [
  {
    key: 'twitter',
    requiredFields: [],
    // Twitter posts via OAuth 2.0 (bearerToken or accessToken+clientId).
    // DM send (live today) needs the OAuth 1.0a quartet. Either group counts as READY.
    aliasGroups: [
      ['bearerToken'],
      ['accessToken', 'clientId'],
      ['consumerKey', 'consumerSecret', 'accessToken', 'accessTokenSecret'],
    ],
    setupHint: 'Run save-twitter-config.ts after creating an X dev app; OAuth1 quartet for DM send',
  },
  {
    key: 'linkedin',
    requiredFields: [],
    // LinkedIn supports official OAuth (accessToken + URN) OR RapidAPI.
    aliasGroups: [
      ['accessToken', 'personUrn'],
      ['accessToken', 'organizationUrn'],
      ['rapidApiKey'],
    ],
    setupHint: 'Marketing Developer Platform OAuth approval required (multi-week), or RapidAPI key as interim',
  },
  {
    key: 'facebook',
    requiredFields: ['pageAccessToken', 'pageId'],
    setupHint: 'Create Facebook Page, generate long-lived Page Access Token via Meta dev console',
  },
  {
    key: 'instagram',
    requiredFields: ['accessToken', 'instagramAccountId'],
    setupHint: 'Convert IG to Business/Creator, link to FB Page, generate IG Graph API token via Meta dev console',
  },
  {
    key: 'youtube',
    requiredFields: [],
    aliasGroups: [
      ['accessToken'],
      ['clientId', 'clientSecret', 'refreshToken'],
    ],
    setupHint: 'Google Cloud project + YouTube Data API v3 + OAuth consent screen + youtube.upload scope',
  },
  {
    key: 'tiktok',
    requiredFields: [],
    aliasGroups: [
      ['accessToken'],
      ['clientKey', 'clientSecret', 'refreshToken'],
    ],
    setupHint: 'TikTok for Developers app + Content Posting API approval + OAuth user consent',
  },
  {
    key: 'bluesky',
    requiredFields: ['identifier', 'password'],
    setupHint: 'Bluesky Settings > App Passwords; run save-bluesky-config.ts',
  },
  {
    key: 'mastodon',
    requiredFields: ['accessToken'],
    setupHint: 'Pick instance, register app via /api/v1/apps, run save-mastodon-config.ts',
  },
  {
    key: 'threads',
    requiredFields: ['accessToken', 'userId'],
    setupHint: 'Threads API access via Meta dev console (linked to IG/FB Page)',
  },
  {
    key: 'telegram',
    requiredFields: ['botToken'],
    setupHint: '@BotFather on Telegram → /newbot → save token (no OAuth required)',
  },
  {
    key: 'reddit',
    requiredFields: [],
    aliasGroups: [
      ['accessToken'],
      ['clientId', 'clientSecret', 'refreshToken'],
    ],
    setupHint: 'Reddit prefs/apps → create script app → OAuth code exchange',
  },
  {
    key: 'pinterest',
    requiredFields: ['accessToken'],
    setupHint: 'Pinterest Developer Portal → app → OAuth code exchange (Business account required)',
  },
  {
    key: 'whatsapp_business',
    requiredFields: ['accessToken', 'phoneNumberId'],
    setupHint: 'Meta Business Suite → WhatsApp Business Platform → phone number registration + token',
  },
  {
    key: 'google_business',
    requiredFields: ['accessToken', 'accountId', 'locationId'],
    setupHint: 'Google Business Profile (claimed listing) + GCP OAuth + Business Profile API access',
  },
];

// ─── audit ─────────────────────────────────────────────────────────────────

interface PlatformReport {
  key: string;
  status: PlatformStatus;
  presentFields: ReadonlyArray<string>;
  missingFields: ReadonlyArray<string>;
  satisfiedGroup?: ReadonlyArray<string>;
  setupHint: string;
}

function fieldHasValue(blob: Record<string, unknown>, field: string): boolean {
  const v = blob[field];
  if (v === undefined || v === null) { return false; }
  if (typeof v === 'string') { return v.trim().length > 0; }
  if (typeof v === 'number') { return true; }
  if (typeof v === 'boolean') { return true; }
  if (typeof v === 'object') { return Object.keys(v).length > 0; }
  return Boolean(v);
}

function evaluatePlatform(spec: PlatformSpec, social: Record<string, unknown>): PlatformReport {
  const raw = social[spec.key];
  if (!raw || typeof raw !== 'object') {
    return {
      key: spec.key,
      status: 'MISSING',
      presentFields: [],
      missingFields: spec.aliasGroups ? [`(any of: ${spec.aliasGroups.map((g) => g.join('+')).join(' OR ')})`] : spec.requiredFields,
      setupHint: spec.setupHint,
    };
  }
  const blob = raw as Record<string, unknown>;
  const presentFields = Object.keys(blob).filter((k) => fieldHasValue(blob, k));

  if (spec.aliasGroups && spec.aliasGroups.length > 0) {
    // Find the first alias group fully satisfied.
    for (const group of spec.aliasGroups) {
      const allPresent = group.every((f) => fieldHasValue(blob, f));
      if (allPresent) {
        return {
          key: spec.key,
          status: 'READY',
          presentFields,
          missingFields: [],
          satisfiedGroup: group,
          setupHint: spec.setupHint,
        };
      }
    }
    // No group fully satisfied; flag PARTIAL if at least ONE field of any group is present.
    const anyFieldPresent = spec.aliasGroups.flat().some((f) => fieldHasValue(blob, f));
    return {
      key: spec.key,
      status: anyFieldPresent ? 'PARTIAL' : 'MISSING',
      presentFields,
      missingFields: [`(any of: ${spec.aliasGroups.map((g) => g.join('+')).join(' OR ')})`],
      setupHint: spec.setupHint,
    };
  }

  // Simple required-fields path.
  const missing = spec.requiredFields.filter((f) => !fieldHasValue(blob, f));
  if (missing.length === 0) {
    return {
      key: spec.key,
      status: 'READY',
      presentFields,
      missingFields: [],
      setupHint: spec.setupHint,
    };
  }
  return {
    key: spec.key,
    status: presentFields.length > 0 ? 'PARTIAL' : 'MISSING',
    presentFields,
    missingFields: missing,
    setupHint: spec.setupHint,
  };
}

async function main(): Promise<void> {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);

  console.log(`Reading organizations/${PLATFORM_ID}/apiKeys/${PLATFORM_ID} ...`);
  let snap;
  try {
    snap = await docRef.get();
  } catch (err) {
    console.error('Failed to read Firestore:', err instanceof Error ? err.message : String(err));
    console.error('');
    console.error('FALLBACK: cannot audit live state. Showing what each service requires from src/lib/integrations:');
    for (const spec of PLATFORMS) {
      const required = spec.aliasGroups
        ? `(any of: ${spec.aliasGroups.map((g) => g.join('+')).join(' OR ')})`
        : spec.requiredFields.join(', ');
      console.log(`  ${spec.key.padEnd(20)} requires: ${required}`);
    }
    process.exit(0);
  }

  if (!snap.exists) {
    console.log('apiKeys doc does not exist. All platforms MISSING.');
    process.exit(0);
  }

  const data = snap.data() ?? {};
  const updatedAtRaw = data.updatedAt;
  const docUpdatedAt = typeof updatedAtRaw === 'string'
    ? updatedAtRaw
    : updatedAtRaw && typeof updatedAtRaw === 'object' && 'toDate' in updatedAtRaw && typeof (updatedAtRaw as { toDate: () => Date }).toDate === 'function'
      ? (updatedAtRaw as { toDate: () => Date }).toDate().toISOString()
      : null;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;

  console.log(`apiKeys doc updatedAt: ${docUpdatedAt ?? '(unknown)'}`);
  console.log(`social keys present:   [${Object.keys(social).join(', ') || '(none)'}]`);
  console.log('');
  console.log('═══ PER-PLATFORM CREDENTIAL STATUS ═══');
  console.log('');

  const reports: PlatformReport[] = [];
  for (const spec of PLATFORMS) {
    const report = evaluatePlatform(spec, social);
    reports.push(report);

    const statusBadge = report.status === 'READY'
      ? 'READY  '
      : report.status === 'PARTIAL'
        ? 'PARTIAL'
        : 'MISSING';

    let detail = '';
    if (report.status === 'READY') {
      const groupNote = report.satisfiedGroup ? `[${report.satisfiedGroup.join('+')}] ` : '';
      detail = `${groupNote}all required fields present`;
    } else if (report.status === 'PARTIAL') {
      detail = `present: [${report.presentFields.join(', ')}]; missing: ${report.missingFields.join(', ')}`;
    } else {
      detail = `no creds — ${report.setupHint}`;
    }

    console.log(`  ${report.key.padEnd(20)} ${statusBadge}  ${detail}`);
  }

  console.log('');
  const ready = reports.filter((r) => r.status === 'READY').length;
  const partial = reports.filter((r) => r.status === 'PARTIAL').length;
  const missing = reports.filter((r) => r.status === 'MISSING').length;
  console.log(`Summary: ${ready} READY, ${partial} PARTIAL, ${missing} MISSING (of ${reports.length} platforms)`);
  console.log('');
  console.log('READY platforms (live-test candidates):');
  for (const r of reports.filter((x) => x.status === 'READY')) {
    console.log(`  - ${r.key}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('audit-social-credentials.ts failed:', err);
    process.exit(1);
  });
