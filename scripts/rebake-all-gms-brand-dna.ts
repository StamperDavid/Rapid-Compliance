/**
 * RE-BAKE ALL GOLDEN MASTERS — bake the CURRENT org Brand DNA into EVERY active
 * Golden Master (all specialists + all managers) using the PROVEN surgical
 * re-bake path. The surgical re-bake swaps ONLY the trailing Brand DNA block of
 * each GM's systemPrompt (Standing Rule #1) and leaves the industry base body
 * AND any human training edits BYTE-IDENTICAL (Standing Rule #2). It is the same
 * production primitive proven end-to-end by `scripts/verify-brand-rebake-live.ts`.
 *
 * What it does:
 *   1. Read the current org Brand DNA via getBrandDNA(). Abort if null.
 *   2. Enumerate every ACTIVE GM directly from Firestore:
 *        - specialists: organizations/rapid-compliance-root/specialistGoldenMasters
 *          where isActive == true  → { specialistId, industryKey, brandDNASnapshot }
 *        - managers:    organizations/rapid-compliance-root/managerGoldenMasters
 *          where isActive == true  → { managerId,   industryKey, brandDNASnapshot }
 *   3. IDEMPOTENT SKIP: if a target's active brandDNASnapshot already deep-equals
 *      the current Brand DNA (normalized JSON compare), it is SKIPPED — no new
 *      version is created.
 *   4. For each non-skipped target call the matching create*FromBrandRebake(...)
 *      then deploy the returned version. Each target is wrapped in its own
 *      try/catch — one failure never aborts the rest.
 *   5. Bounded concurrency: at most 5 targets processed at a time.
 *   6. Prints a final summary (total / rebaked / skipped / failed) and lists any
 *      failures with their error.
 *
 * SAFETY: --dry-run is the DEFAULT. With no flag the script lists every target
 * and whether it WOULD re-bake or skip, and writes NOTHING. Only `--apply`
 * performs the create + deploy.
 *
 * NOTE — Jasper (the orchestrator GM in the `goldenMasters` collection) is NOT
 * handled here. It has a different doc shape / version scheme and is re-baked
 * separately.
 *
 * Usage:
 *   npx tsx scripts/rebake-all-gms-brand-dna.ts            # DRY RUN (default)
 *   npx tsx scripts/rebake-all-gms-brand-dna.ts --apply    # actually re-bake
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(sakPath)) {
      const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      throw new Error('Missing FIREBASE_ADMIN_* env vars and no serviceAccountKey.json');
    }
  }
}

// Init BEFORE importing services — the admin module reads env at import time.
initAdmin();

import { getBrandDNA, type BrandDNA } from '../src/lib/brand/brand-dna-service';
import {
  createIndustryGMVersionFromBrandRebake,
  deployIndustryGMVersion,
  invalidateIndustryGMCache,
} from '../src/lib/training/specialist-golden-master-service';
import {
  createManagerGMVersionFromBrandRebake,
  deployManagerGMVersion,
  invalidateManagerGMCache,
} from '../src/lib/training/manager-golden-master-service';

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------

const PLATFORM_ID = 'rapid-compliance-root';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const MANAGER_GM_COLLECTION = `organizations/${PLATFORM_ID}/managerGoldenMasters`;
const CREATED_BY = 'rebake-all-gms-brand-dna';
const MAX_CONCURRENCY = 5;

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY; // dry-run is the default; only --apply mutates

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

type AgentKind = 'specialist' | 'manager';

interface Target {
  kind: AgentKind;
  /** specialistId or managerId */
  agentId: string;
  industryKey: string;
  currentVersion: number;
  currentSnapshot: BrandDNA | null;
}

type ResultStatus = 'rebaked' | 'skipped' | 'failed';

interface RebakeResult {
  id: string;            // `${kind}:${agentId}:${industryKey}`
  status: ResultStatus;
  fromVersion: number;
  toVersion?: number;
  error?: string;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

/**
 * Normalize a Brand DNA object to a stable string for deep-equality. Mutable
 * metadata (`updatedAt`, `updatedBy`) is dropped — only the semantic voice
 * fields matter for "is the bake already current?". Arrays are kept in order
 * (order is meaningful for keyPhrases / avoidPhrases as the operator entered
 * them), keys are sorted so JSON layout differences never cause a false diff.
 */
function normalizeBrandDNA(dna: BrandDNA | null): string {
  if (!dna) { return 'null'; }
  const semantic: Record<string, unknown> = {
    companyDescription: dna.companyDescription ?? '',
    uniqueValue: dna.uniqueValue ?? '',
    targetAudience: dna.targetAudience ?? '',
    toneOfVoice: dna.toneOfVoice ?? '',
    communicationStyle: dna.communicationStyle ?? '',
    keyPhrases: Array.isArray(dna.keyPhrases) ? dna.keyPhrases : [],
    avoidPhrases: Array.isArray(dna.avoidPhrases) ? dna.avoidPhrases : [],
    industry: dna.industry ?? '',
    competitors: Array.isArray(dna.competitors) ? dna.competitors : [],
  };
  const sortedKeys = Object.keys(semantic).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of sortedKeys) { ordered[k] = semantic[k]; }
  return JSON.stringify(ordered);
}

function brandDNAEquals(a: BrandDNA | null, b: BrandDNA | null): boolean {
  return normalizeBrandDNA(a) === normalizeBrandDNA(b);
}

function id(t: Target): string {
  return `${t.kind}:${t.agentId}:${t.industryKey}`;
}

/** Process items in chunks of at most `size`, awaiting each chunk fully. */
async function inChunks<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const results = await Promise.all(chunk.map(fn));
    out.push(...results);
  }
  return out;
}

// ----------------------------------------------------------------------------
// ENUMERATION
// ----------------------------------------------------------------------------

async function enumerateSpecialists(db: admin.firestore.Firestore): Promise<Target[]> {
  const snap = await db.collection(SPECIALIST_GM_COLLECTION).where('isActive', '==', true).get();
  const targets: Target[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as {
      specialistId?: string;
      industryKey?: string;
      version?: number;
      brandDNASnapshot?: BrandDNA;
    };
    if (!data.specialistId || !data.industryKey) {
      console.warn(`  ⚠️  skipping malformed specialist GM ${doc.id} (missing specialistId/industryKey)`);
      continue;
    }
    targets.push({
      kind: 'specialist',
      agentId: data.specialistId,
      industryKey: data.industryKey,
      currentVersion: typeof data.version === 'number' ? data.version : 0,
      currentSnapshot: data.brandDNASnapshot ?? null,
    });
  }
  return targets;
}

async function enumerateManagers(db: admin.firestore.Firestore): Promise<Target[]> {
  const snap = await db.collection(MANAGER_GM_COLLECTION).where('isActive', '==', true).get();
  const targets: Target[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as {
      managerId?: string;
      industryKey?: string;
      version?: number;
      brandDNASnapshot?: BrandDNA;
    };
    if (!data.managerId || !data.industryKey) {
      console.warn(`  ⚠️  skipping malformed manager GM ${doc.id} (missing managerId/industryKey)`);
      continue;
    }
    targets.push({
      kind: 'manager',
      agentId: data.managerId,
      industryKey: data.industryKey,
      currentVersion: typeof data.version === 'number' ? data.version : 0,
      currentSnapshot: data.brandDNASnapshot ?? null,
    });
  }
  return targets;
}

// ----------------------------------------------------------------------------
// PER-TARGET PROCESSING
// ----------------------------------------------------------------------------

async function processTarget(target: Target, brandDNA: BrandDNA): Promise<RebakeResult> {
  const label = id(target);
  const base: RebakeResult = { id: label, status: 'skipped', fromVersion: target.currentVersion };

  // [3] Idempotent skip — already baked with the current Brand DNA.
  if (brandDNAEquals(target.currentSnapshot, brandDNA)) {
    console.log(`  ⏭️  SKIP   ${label} (v${target.currentVersion}) — brandDNASnapshot already current`);
    return base;
  }

  if (DRY_RUN) {
    console.log(`  📝 WOULD  ${label} (v${target.currentVersion} → v${target.currentVersion + 1}) — re-bake current Brand DNA`);
    return { ...base, status: 'rebaked', toVersion: target.currentVersion + 1 };
  }

  // [4] APPLY — create the inactive re-baked version, then deploy it.
  try {
    if (target.kind === 'specialist') {
      const created = await createIndustryGMVersionFromBrandRebake(
        target.agentId, target.industryKey, brandDNA, CREATED_BY,
      );
      if (!created) {
        return { ...base, status: 'failed', error: 'createIndustryGMVersionFromBrandRebake returned null (no active GM or missing Brand DNA marker)' };
      }
      const deploy = await deployIndustryGMVersion(target.agentId, target.industryKey, created.version);
      if (!deploy.success) {
        return { ...base, status: 'failed', error: `deploy failed: ${deploy.error ?? 'unknown'}` };
      }
      invalidateIndustryGMCache(target.agentId, target.industryKey);
      console.log(`  ✅ REBAKE ${label} (v${target.currentVersion} → v${created.version})`);
      return { ...base, status: 'rebaked', toVersion: created.version };
    }

    // manager
    const created = await createManagerGMVersionFromBrandRebake(
      target.agentId, target.industryKey, brandDNA, CREATED_BY,
    );
    if (!created) {
      return { ...base, status: 'failed', error: 'createManagerGMVersionFromBrandRebake returned null (no active GM or missing Brand DNA marker)' };
    }
    const deploy = await deployManagerGMVersion(target.agentId, target.industryKey, created.version);
    if (!deploy.success) {
      return { ...base, status: 'failed', error: `deploy failed: ${deploy.error ?? 'unknown'}` };
    }
    invalidateManagerGMCache(target.agentId, target.industryKey);
    console.log(`  ✅ REBAKE ${label} (v${target.currentVersion} → v${created.version})`);
    return { ...base, status: 'rebaked', toVersion: created.version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ FAIL   ${label} — ${message}`);
    return { ...base, status: 'failed', error: message };
  }
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const db = admin.firestore();

  console.log('========================================================================');
  console.log('  RE-BAKE ALL GOLDEN MASTERS — current Brand DNA → every active GM');
  console.log(`  mode: ${DRY_RUN ? 'DRY RUN (default — writes NOTHING; pass --apply to commit)' : 'APPLY (will create + deploy new GM versions)'}`);
  console.log('  Jasper: not included (handled separately)');
  console.log('========================================================================');

  // [1] Read current org Brand DNA.
  console.log('\n[1] Read org Brand DNA via getBrandDNA()...');
  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    console.error('  ❌ getBrandDNA() returned null — no Brand DNA configured on the org. Aborting.');
    process.exit(1);
    return;
  }
  const keyPhrases = Array.isArray(brandDNA.keyPhrases) ? brandDNA.keyPhrases : [];
  console.log(`  industry: ${brandDNA.industry}`);
  console.log(`  keyPhrases: [${keyPhrases.join(', ')}]`);

  // [2] Enumerate active targets.
  console.log('\n[2] Enumerate active Golden Masters...');
  const [specialists, managers] = await Promise.all([
    enumerateSpecialists(db),
    enumerateManagers(db),
  ]);
  const targets = [...specialists, ...managers];
  console.log(`  specialists: ${specialists.length} active`);
  console.log(`  managers   : ${managers.length} active`);
  console.log(`  total      : ${targets.length} targets`);

  if (targets.length === 0) {
    console.log('\n  Nothing to do — no active Golden Masters found.');
    process.exit(0);
    return;
  }

  // [3-5] Process targets, bounded to MAX_CONCURRENCY at a time.
  console.log(`\n[3] ${DRY_RUN ? 'Planning' : 'Re-baking'} (max ${MAX_CONCURRENCY} at a time)...`);
  const results = await inChunks(targets, MAX_CONCURRENCY, (t) => processTarget(t, brandDNA));

  // [6] Summary.
  const rebaked = results.filter((r) => r.status === 'rebaked');
  const skipped = results.filter((r) => r.status === 'skipped');
  const failed = results.filter((r) => r.status === 'failed');

  console.log('\n========================================================================');
  console.log('  SUMMARY');
  console.log('------------------------------------------------------------------------');
  console.log(`  total   : ${results.length}`);
  console.log(`  ${DRY_RUN ? 'would re-bake' : 'rebaked'}: ${rebaked.length}`);
  console.log(`  skipped : ${skipped.length} (brandDNASnapshot already current)`);
  console.log(`  failed  : ${failed.length}`);
  console.log('========================================================================');

  if (failed.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of failed) {
      console.log(`    ❌ ${f.id} (from v${f.fromVersion}) — ${f.error ?? 'unknown error'}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n  DRY RUN — no changes were written. Re-run with --apply to commit.');
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
