/**
 * Intent Expander behavioral verification harness
 *
 * Runs the fixtures in scripts/intent-expander-fixtures.json against the
 * currently-active Intent Expander Golden Master (loaded from Firestore) and
 * asserts the MUST constraints per fixture. Use before deploying a model
 * upgrade or a prompt edit to prove no behavioral regression.
 *
 * Usage:
 *   npx tsx scripts/verify-intent-expander-behavior.ts
 *     — runs all fixtures against the current active GM. Exits 0 on all pass.
 *
 *   npx tsx scripts/verify-intent-expander-behavior.ts --proposed-model=claude-haiku-4.5
 *     — temporarily writes a v999 test GM with the proposed model, invalidates
 *       cache, runs fixtures, ROLLS BACK in finally (no state drift). Use to
 *       pre-flight a model upgrade without touching the real active GM.
 *
 *   npx tsx scripts/verify-intent-expander-behavior.ts --fixture=A1-read-leads
 *     — runs a single fixture by id (for quick iteration).
 *
 * Exit code: 0 if all run fixtures pass their must constraints, 1 otherwise.
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
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { expandIntent, type ClassifierHint } from '../src/lib/orchestrator/intent-expander';
import {
  getActiveSpecialistGMByIndustry,
  invalidateIndustryGMCache,
} from '../src/lib/training/specialist-golden-master-service';

const PLATFORM_ID = 'rapid-compliance-root';
const SPECIALIST_ID = 'INTENT_EXPANDER';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const TEST_GM_ID = `sgm_intent_expander_${INDUSTRY_KEY}_v999_test`;

// ============================================================================
// Fixture types
// ============================================================================

interface FixtureMust {
  toolsAllowed?: string[];
  toolsForbidden?: string[];
  toolsRequired?: string[];
  isAdvisory?: boolean;
  isComplex?: boolean;
  toolCount?: number;
  toolCountAtLeast?: number;
  scrapeUrlContains?: string;
}

interface Fixture {
  id: string;
  bucket: 'A' | 'B' | 'C';
  note?: string;
  input: string;
  classifierHint: ClassifierHint | null;
  must: FixtureMust;
}

interface FixtureFile {
  version: number;
  description: string;
  fixtures: Fixture[];
}

interface FixtureResult {
  id: string;
  passed: boolean;
  failures: string[];
  actual: {
    tools: string[];
    scrapeUrls: string[];
    isAdvisory: boolean;
    isComplex: boolean;
    reasoning: string;
  } | null;
  durationMs: number;
}

// ============================================================================
// Assertion engine
// ============================================================================

function evaluateFixture(
  fixture: Fixture,
  actual: { tools: string[]; scrapeUrls: string[]; isAdvisory: boolean; isComplex: boolean; reasoning: string } | null,
): string[] {
  const failures: string[] = [];
  if (!actual) {
    failures.push('expander returned null (no result)');
    return failures;
  }
  const m = fixture.must;

  if (m.toolsAllowed !== undefined) {
    const extras = actual.tools.filter((t) => !m.toolsAllowed!.includes(t));
    if (extras.length > 0) {
      failures.push(`tools outside toolsAllowed=[${m.toolsAllowed.join(',')}]: [${extras.join(',')}]`);
    }
  }
  if (m.toolsForbidden !== undefined) {
    const violations = actual.tools.filter((t) => m.toolsForbidden!.includes(t));
    if (violations.length > 0) {
      failures.push(`contains forbidden tools: [${violations.join(',')}]`);
    }
  }
  if (m.toolsRequired !== undefined) {
    const missing = m.toolsRequired.filter((t) => !actual.tools.includes(t));
    if (missing.length > 0) {
      failures.push(`missing required tools: [${missing.join(',')}]`);
    }
  }
  if (m.isAdvisory !== undefined && actual.isAdvisory !== m.isAdvisory) {
    failures.push(`isAdvisory=${actual.isAdvisory}, expected ${m.isAdvisory}`);
  }
  if (m.isComplex !== undefined && actual.isComplex !== m.isComplex) {
    failures.push(`isComplex=${actual.isComplex}, expected ${m.isComplex}`);
  }
  if (m.toolCount !== undefined && actual.tools.length !== m.toolCount) {
    failures.push(`toolCount=${actual.tools.length}, expected exactly ${m.toolCount}`);
  }
  if (m.toolCountAtLeast !== undefined && actual.tools.length < m.toolCountAtLeast) {
    failures.push(`toolCount=${actual.tools.length}, expected at least ${m.toolCountAtLeast}`);
  }
  if (m.scrapeUrlContains !== undefined) {
    const match = actual.scrapeUrls.some((u) => u.includes(m.scrapeUrlContains!));
    if (!match) {
      failures.push(`no scrapeUrl contains '${m.scrapeUrlContains}' (got: [${actual.scrapeUrls.join(',')}])`);
    }
  }
  return failures;
}

// ============================================================================
// Proposed-model override (temporary v999 test GM)
// ============================================================================

async function installProposedModelGM(
  db: FirebaseFirestore.Firestore,
  proposedModel: string,
): Promise<void> {
  const current = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY_KEY);
  if (!current) {
    throw new Error('No active Intent Expander GM. Run scripts/seed-intent-expander-gm.js first.');
  }
  const now = new Date().toISOString();

  // Deactivate the current GM temporarily.
  const currentRef = db.collection(GM_COLLECTION).doc(current.id);
  const batch = db.batch();
  batch.update(currentRef, { isActive: false });

  // Insert v999 test doc with the proposed model, same prompt.
  const testDoc = {
    ...current,
    id: TEST_GM_ID,
    version: 999,
    config: {
      ...(current.config as Record<string, unknown>),
      model: proposedModel,
    },
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'verify-intent-expander-behavior',
    notes: `TEMPORARY test GM with proposedModel=${proposedModel}. Should be rolled back automatically.`,
  };
  batch.set(db.collection(GM_COLLECTION).doc(TEST_GM_ID), testDoc);
  await batch.commit();
  invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);
  console.log(`  ✓ Installed temporary v999 test GM with model=${proposedModel}`);
  console.log(`    (original GM ${current.id} temporarily deactivated — will be restored)`);
}

async function rollbackProposedModelGM(db: FirebaseFirestore.Firestore): Promise<void> {
  const allVersions = await db.collection(GM_COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .get();

  const batch = db.batch();
  const now = new Date().toISOString();
  let touched = 0;

  for (const doc of allVersions.docs) {
    const data = doc.data();
    if (doc.id === TEST_GM_ID || data.version === 999) {
      // Delete test docs — they should never persist.
      batch.delete(doc.ref);
      touched++;
    } else if (data.version === 1) {
      batch.update(doc.ref, { isActive: true, deployedAt: now });
      touched++;
    }
  }

  if (touched > 0) {
    await batch.commit();
  }
  invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);
  console.log(`  ✓ Rolled back test GM (touched ${touched} docs)`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const proposedModelArg = args.find((a) => a.startsWith('--proposed-model='));
  const fixtureArg = args.find((a) => a.startsWith('--fixture='));
  const proposedModel = proposedModelArg ? proposedModelArg.split('=')[1] : null;
  const fixtureFilter = fixtureArg ? fixtureArg.split('=')[1] : null;

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Intent Expander Behavioral Verification');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const fixturesPath = path.resolve(process.cwd(), 'scripts/intent-expander-fixtures.json');
  const fixtureFile = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8')) as FixtureFile;
  const fixtures = fixtureFilter
    ? fixtureFile.fixtures.filter((f) => f.id === fixtureFilter)
    : fixtureFile.fixtures;

  if (fixtures.length === 0) {
    console.error(`No fixtures matched filter: ${fixtureFilter ?? '(all)'}`);
    process.exit(1);
  }

  const db = admin.firestore();
  let cleanupRequired = false;

  try {
    if (proposedModel) {
      console.log(`[setup] Installing temporary GM with model=${proposedModel}`);
      await installProposedModelGM(db, proposedModel);
      cleanupRequired = true;
    } else {
      const gm = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY_KEY);
      if (!gm) {
        throw new Error('No active Intent Expander GM. Run scripts/seed-intent-expander-gm.js first.');
      }
      const model = (gm.config as Record<string, unknown>).model;
      console.log(`[setup] Using current active GM: ${gm.id} (v${gm.version}, model=${String(model)})`);
    }

    console.log(`\n[run] Executing ${fixtures.length} fixture(s)...\n`);

    const results: FixtureResult[] = [];
    for (const fixture of fixtures) {
      const startMs = Date.now();
      const hint: ClassifierHint | undefined = fixture.classifierHint ?? undefined;
      const actual = await expandIntent(fixture.input, hint);
      const durationMs = Date.now() - startMs;
      const failures = evaluateFixture(fixture, actual);
      const passed = failures.length === 0;
      results.push({
        id: fixture.id,
        passed,
        failures,
        actual: actual
          ? {
              tools: actual.tools,
              scrapeUrls: actual.scrapeUrls,
              isAdvisory: actual.isAdvisory,
              isComplex: actual.isComplex,
              reasoning: actual.reasoning,
            }
          : null,
        durationMs,
      });

      const icon = passed ? '✓' : '✗';
      const color = passed ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(
        `  ${color}${icon}${reset} ${fixture.id.padEnd(24)} [${fixture.bucket}] ${passed ? 'PASS' : 'FAIL'} (${durationMs}ms)`,
      );
      if (!passed) {
        console.log(`      input: "${fixture.input}"${fixture.classifierHint ? ` [hint=${fixture.classifierHint}]` : ''}`);
        console.log(`      actual: tools=[${actual?.tools.join(',') ?? 'null'}] adv=${actual?.isAdvisory} complex=${actual?.isComplex}`);
        for (const fail of failures) {
          console.log(`      · ${fail}`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    const passCount = results.filter((r) => r.passed).length;
    const failCount = results.length - passCount;
    const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
    console.log(`  Results: ${passCount}/${results.length} passed, ${failCount} failed (${totalMs}ms total)`);
    if (proposedModel) {
      console.log(`  Mode: proposed-model=${proposedModel} (test GM will be rolled back)`);
    }
    console.log('═══════════════════════════════════════════════════════════════════\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (cleanupRequired) {
      console.log('[teardown] Rolling back temporary test GM...');
      try {
        await rollbackProposedModelGM(db);
      } catch (err) {
        console.error('Rollback failed — MANUAL CLEANUP REQUIRED:', err);
        console.error(`  Check Firestore collection ${GM_COLLECTION} for orphan docs with version=999.`);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
