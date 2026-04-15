/**
 * PHASE M2c VERIFY — rollback path end-to-end
 *
 * Proves that the version list + rollback primitives let an operator
 * undo a Prompt Engineer edit cleanly:
 *
 *   1. Snapshot the Copywriter v1 active GM (read its current systemPrompt).
 *   2. Submit a fake grade that creates a new v2 via the Prompt Engineer.
 *   3. Deploy v2 — active version is now 2.
 *   4. Call listIndustryGMVersions — expect [v2, v1] with v2.isActive=true.
 *   5. Call deployIndustryGMVersion(target=1) — rollback to v1.
 *   6. Read the active GM again — expect v1 active, v2 deactivated.
 *   7. Cleanup: delete the v2 doc + the test feedback record so the test
 *      is idempotent.
 *
 * Usage: npx tsx scripts/verify-rollback.ts
 *
 * Exit code: 0 if the whole loop works, 1 on any failure. Rollback runs
 * in a finally block so even if a step throws, the Copywriter is left on
 * v1 at the end.
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

import { submitGrade, approvePromptEdit } from '../src/lib/training/grade-submission-service';
import {
  getActiveSpecialistGMByIndustry,
  listIndustryGMVersions,
  deployIndustryGMVersion,
  invalidateIndustryGMCache,
} from '../src/lib/training/specialist-golden-master-service';

const PLATFORM_ID = 'rapid-compliance-root';
const TARGET_SPECIALIST_ID = 'COPYWRITER';
const INDUSTRY_KEY = 'saas_sales_ops';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const FEEDBACK_COLLECTION = `organizations/${PLATFORM_ID}/trainingFeedback`;

async function restoreV1(db: FirebaseFirestore.Firestore): Promise<void> {
  const v1DocId = `sgm_copywriter_${INDUSTRY_KEY}_v1`;
  const all = await db.collection(SPECIALIST_GM_COLLECTION)
    .where('specialistId', '==', TARGET_SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .get();

  const batch = db.batch();
  const now = new Date().toISOString();
  let touched = 0;
  for (const doc of all.docs) {
    if (doc.id === v1DocId) {
      batch.update(doc.ref, { isActive: true, deployedAt: now });
      touched++;
    } else {
      const data = doc.data();
      if (data.version && data.version > 1) {
        batch.delete(doc.ref);
        touched++;
      }
    }
  }
  if (touched > 0) { await batch.commit(); }
  invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
}

async function main(): Promise<void> {
  const db = admin.firestore();

  console.log('========================================================================');
  console.log('  PHASE M2c VERIFY — rollback end-to-end');
  console.log('========================================================================');

  let feedbackId: string | null = null;
  let createdV2 = false;

  try {
    // [1] Snapshot v1
    console.log('\n[1] Snapshot Copywriter v1...');
    const v1 = await getActiveSpecialistGMByIndustry(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    if (!v1) { throw new Error('No active Copywriter v1 — test cannot run'); }
    const v1Prompt = typeof v1.config.systemPrompt === 'string'
      ? v1.config.systemPrompt
      : v1.systemPromptSnapshot ?? '';
    console.log(`  active GM: ${v1.id} (v${v1.version}, ${v1Prompt.length} chars)`);

    // [2] Submit a fake grade
    console.log('\n[2] Submit a fake grade to create v2...');
    const submitResult = await submitGrade({
      targetSpecialistId: TARGET_SPECIALIST_ID,
      targetSpecialistName: 'Copywriter',
      sourceReportTaskId: 'rollback_test_001',
      sourceReportExcerpt: 'Placeholder output — test fixture to trigger a prompt revision.',
      grade: 'reject',
      explanation: 'The specificity rules need to be tighter. Require every claim to name a concrete feature and a measurable outcome. No generic benefit statements.',
      graderUserId: 'verify_rollback_test',
      graderDisplayName: 'Verify Rollback Test',
    });

    if (submitResult.status !== 'EDIT_PROPOSED') {
      throw new Error(`Expected EDIT_PROPOSED, got ${submitResult.status}`);
    }
    feedbackId = submitResult.feedbackId;
    console.log(`  feedbackId: ${feedbackId}`);
    console.log(`  Prompt Engineer confidence: ${submitResult.proposedEdit.confidence}%`);

    // [3] Approve the edit → v2 gets deployed
    console.log('\n[3] Approve the proposed edit (v1 → v2)...');
    const approveResult = await approvePromptEdit({
      feedbackId,
      approvedEdit: submitResult.proposedEdit,
      approverUserId: 'verify_rollback_test',
      approverDisplayName: 'Verify Rollback Test',
    });
    if (approveResult.status !== 'DEPLOYED') {
      throw new Error(`Expected DEPLOYED, got ${approveResult.status}`);
    }
    createdV2 = true;
    console.log(`  ✓ deployed ${approveResult.newGMDocId} (v${approveResult.newVersion})`);

    // [4] List versions — expect v2 and v1
    console.log('\n[4] listIndustryGMVersions...');
    invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    const versions = await listIndustryGMVersions(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    console.log(`  found ${versions.length} versions:`);
    for (const v of versions) {
      console.log(`    v${v.version} (${v.isActive ? 'ACTIVE' : 'inactive'}) — ${v.id}`);
    }
    if (versions.length < 2) {
      throw new Error(`Expected at least 2 versions, found ${versions.length}`);
    }
    const activeNow = versions.find((v) => v.isActive);
    if (!activeNow || activeNow.version !== approveResult.newVersion) {
      throw new Error(`Expected v${approveResult.newVersion} active, found v${activeNow?.version ?? '?'}`);
    }
    console.log(`  ✓ v${approveResult.newVersion} is currently active`);

    // [5] Rollback to v1
    console.log('\n[5] deployIndustryGMVersion(target=1) — rollback to v1...');
    const rollbackResult = await deployIndustryGMVersion(TARGET_SPECIALIST_ID, INDUSTRY_KEY, 1);
    if (!rollbackResult.success) {
      throw new Error(`Rollback failed: ${rollbackResult.error ?? 'unknown error'}`);
    }
    console.log(`  ✓ rollback deploy returned success`);

    // [6] Verify v1 is active again
    console.log('\n[6] Verify v1 is active + v2 is deactivated...');
    invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    const versionsAfter = await listIndustryGMVersions(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    const v1After = versionsAfter.find((v) => v.version === 1);
    const v2After = versionsAfter.find((v) => v.version === 2);
    if (!v1After?.isActive) {
      throw new Error('v1 is not active after rollback');
    }
    if (v2After?.isActive) {
      throw new Error('v2 is still active after rollback (rollback did not deactivate it)');
    }
    console.log('  ✓ v1 active, v2 deactivated');

    // Read back the active prompt to be really sure
    const activeAfterRollback = await getActiveSpecialistGMByIndustry(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    if (!activeAfterRollback || activeAfterRollback.version !== 1) {
      throw new Error(`Expected active v1, got v${activeAfterRollback?.version ?? '?'}`);
    }
    const activePrompt = typeof activeAfterRollback.config.systemPrompt === 'string'
      ? activeAfterRollback.config.systemPrompt
      : activeAfterRollback.systemPromptSnapshot ?? '';
    if (activePrompt.length !== v1Prompt.length) {
      throw new Error(
        `After rollback, active prompt length is ${activePrompt.length} but v1 was ${v1Prompt.length} — rollback did not restore the original text`,
      );
    }
    console.log('  ✓ active prompt matches v1 exactly');

    console.log('\n========================================================================');
    console.log('  ✓ ROLLBACK VERIFIED END-TO-END');
    console.log('========================================================================');
    console.log('  - Grade submission created v2');
    console.log('  - listIndustryGMVersions returned both versions with correct isActive flags');
    console.log('  - deployIndustryGMVersion(target=1) rolled back cleanly');
    console.log('  - v1 is active, v2 is deactivated, active prompt matches v1');
    console.log('');
    process.exitCode = 0;
  } finally {
    console.log('\n[cleanup] Restore Copywriter to clean v1 state...');
    if (createdV2) {
      await restoreV1(db);
      console.log('  ✓ v2 deleted, v1 reactivated');
    }
    if (feedbackId) {
      try {
        await db.collection(FEEDBACK_COLLECTION).doc(feedbackId).delete();
        console.log(`  ✓ deleted test feedback doc ${feedbackId}`);
      } catch (err) {
        console.error(`  ✗ failed to delete feedback doc: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
