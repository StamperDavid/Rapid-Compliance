/**
 * Apply the correction proposals drafted by propose-matrix-corrections.ts.
 *
 * Reads D:/rapid-dev/correction-proposals.json and, for each proposal:
 *   - Jasper (orchestrator):
 *       createJasperGMVersionFromEdit → deployJasperGMVersion → invalidate cache
 *   - Intent Expander (specialist):
 *       createIndustryGMVersionFromEdit → deployIndustryGMVersion
 *
 * Atomically swaps the active GM. Old versions are preserved with isActive=false
 * so rollback is a one-call operation (rollbackJasperGMToVersion / equivalent
 * for specialists).
 *
 * Flags:
 *   --only=1,3   apply only proposals at indices 1 and 3 (1-based)
 *   --dry-run    log what would be applied without writing anything
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
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import {
  createJasperGMVersionFromEdit,
  deployJasperGMVersion,
} from '../src/lib/training/jasper-golden-master-service';
import {
  createIndustryGMVersionFromEdit,
  deployIndustryGMVersion,
} from '../src/lib/training/specialist-golden-master-service';
import { invalidateJasperGMCache } from '../src/lib/orchestrator/jasper-golden-master';

interface Proposal {
  id: string;
  targetAgent: string;
  targetGMId: string;
  targetGMVersion: string | number;
  targetGMCollection: 'specialistGoldenMasters' | 'goldenMasters';
  failingPrompts: string[];
  observedBehavior: string;
  correctionInstruction: string;
  beforeSection: string;
  afterSection: string;
  changeDescription: string;
  fullRevisedPrompt: string;
}

async function applyJasperProposal(p: Proposal, dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log(`   DRY RUN — would create new Jasper GM version from edit (source: matrix-correction-${p.id})`);
    return;
  }
  const newVersion = await createJasperGMVersionFromEdit(
    {
      currentText: p.beforeSection,
      proposedText: p.afterSection,
      rationale: `Matrix training target — ${p.changeDescription}`,
      sourceFeedbackId: `matrix-correction-${p.id}`,
    },
    'claude-assistant-matrix-corrections',
  );
  if (!newVersion) { throw new Error('createJasperGMVersionFromEdit returned null'); }
  console.log(`   new Jasper GM version created: v${newVersion.versionNumber} (${newVersion.id})`);

  const deployResult = await deployJasperGMVersion(newVersion.versionNumber);
  if (!deployResult.success) { throw new Error(`Deploy failed: ${deployResult.error}`); }
  console.log(`   ✓ deployed v${newVersion.version}`);
  invalidateJasperGMCache();
  console.log(`   ✓ Jasper GM cache invalidated`);
}

async function applyIntentExpanderProposal(p: Proposal, dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log(`   DRY RUN — would create new INTENT_EXPANDER specialist GM version`);
    return;
  }
  const INDUSTRY_KEY = 'saas_sales_ops';
  const newVersion = await createIndustryGMVersionFromEdit(
    'INTENT_EXPANDER',
    INDUSTRY_KEY,
    {
      currentText: p.beforeSection,
      proposedText: p.afterSection,
      rationale: `Matrix training target — ${p.changeDescription}`,
      sourceTrainingFeedbackId: `matrix-correction-${p.id}`,
    },
    'claude-assistant-matrix-corrections',
  );
  if (!newVersion) { throw new Error('createIndustryGMVersionFromEdit returned null'); }
  console.log(`   new specialist GM version created: v${newVersion.version} (${newVersion.id})`);

  const deployResult = await deployIndustryGMVersion(
    'INTENT_EXPANDER',
    INDUSTRY_KEY,
    newVersion.version,
  );
  if (!deployResult.success) { throw new Error(`Deploy failed: ${deployResult.error}`); }
  console.log(`   ✓ deployed v${newVersion.version}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const dryRun = args.includes('--dry-run');
  const filter = onlyArg
    ? new Set(onlyArg.split('=')[1].split(',').map((s) => parseInt(s.trim(), 10) - 1))
    : null;

  const proposalsPath = 'D:/rapid-dev/correction-proposals.json';
  if (!fs.existsSync(proposalsPath)) {
    console.error(`Proposals file not found at ${proposalsPath}`);
    console.error('Run scripts/propose-matrix-corrections.ts first');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(proposalsPath, 'utf-8')) as { proposals: Proposal[] };

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Applying ${filter ? `${filter.size} of ` : ''}${raw.proposals.length} proposals${dryRun ? ' (DRY RUN)' : ''}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < raw.proposals.length; i++) {
    const p = raw.proposals[i];
    if (filter && !filter.has(i)) {
      console.log(`${i + 1}/${raw.proposals.length}  ${p.id}  — skipped (not in --only filter)`);
      skipped++;
      continue;
    }

    console.log(`${i + 1}/${raw.proposals.length}  ${p.id}`);
    console.log(`   target: ${p.targetAgent} (${p.targetGMId} v${p.targetGMVersion})`);
    console.log(`   change: ${p.changeDescription}`);

    try {
      if (p.targetGMCollection === 'goldenMasters') {
        await applyJasperProposal(p, dryRun);
      } else if (p.targetGMCollection === 'specialistGoldenMasters') {
        await applyIntentExpanderProposal(p, dryRun);
      } else {
        throw new Error(`Unknown targetGMCollection: ${String(p.targetGMCollection)}`);
      }
      applied++;
    } catch (err) {
      console.log(`   ✗ FAILED: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  ${applied} applied · ${skipped} skipped · ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('apply-matrix-corrections failed:', err);
  process.exit(1);
});
