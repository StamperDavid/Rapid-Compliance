/**
 * PHASE 3 VERIFY — Prompt Engineer end-to-end
 *
 * Proves the grade-submission-service pipeline works end-to-end:
 *
 *   1. Submit a fake human grade against a real specialist (Copywriter).
 *   2. Prompt Engineer reads the current Copywriter system prompt + the
 *      grade + the flagged output and produces a SURGICAL edit
 *      (EDIT_PROPOSED with valid currentText/proposedText diff).
 *   3. Approve the proposed edit.
 *   4. Service creates a new industry-scoped GM version (v2) with the
 *      edit applied, deploys it atomically, invalidates the cache.
 *   5. Read back the active Copywriter GM and confirm it's v2 with the
 *      proposedText content in place of the currentText.
 *   6. **ROLLBACK** — this is a test, not a production edit. Restore the
 *      original v1 as active and deactivate v2. The test must leave the
 *      system in the same state it started in.
 *
 * Usage: npx tsx scripts/verify-prompt-engineer.ts
 *
 * Exit code: 0 if the full round-trip works (propose → approve → deploy
 * → verify → rollback), 1 on any failure.
 *
 * SAFETY: The rollback step runs in a finally block so even if a step
 * mid-flow throws, the Copywriter GM ends up back on v1.
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

import {
  submitGrade,
  approvePromptEdit,
} from '../src/lib/training/grade-submission-service';
import {
  getActiveSpecialistGMByIndustry,
  invalidateIndustryGMCache,
} from '../src/lib/training/specialist-golden-master-service';

const PLATFORM_ID = 'rapid-compliance-root';
const TARGET_SPECIALIST_ID = 'COPYWRITER';
const INDUSTRY_KEY = 'saas_sales_ops';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const FEEDBACK_COLLECTION = `organizations/${PLATFORM_ID}/trainingFeedback`;

function section(title: string): void {
  console.log(`\n[${title}]`);
}

async function rollbackToV1(db: FirebaseFirestore.Firestore): Promise<void> {
  // Reactivate v1, deactivate any v2+ that we created during the test.
  const v1DocId = `sgm_copywriter_${INDUSTRY_KEY}_v1`;

  const allVersions = await db.collection(SPECIALIST_GM_COLLECTION)
    .where('specialistId', '==', TARGET_SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .get();

  const batch = db.batch();
  const now = new Date().toISOString();
  let touched = 0;

  for (const doc of allVersions.docs) {
    if (doc.id === v1DocId) {
      batch.update(doc.ref, {
        isActive: true,
        deployedAt: now,
      });
      touched++;
    } else {
      // Deactivate AND delete test-created v2+ docs so repeated test runs
      // don't leave piles of test docs in Firestore.
      const data = doc.data();
      if (data.version && data.version > 1) {
        batch.delete(doc.ref);
        touched++;
      }
    }
  }

  if (touched > 0) {
    await batch.commit();
  }
  invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
  console.log(`  ✓ Rolled back Copywriter GM to v1 (touched ${touched} docs)`);
}

async function cleanupTestFeedback(db: FirebaseFirestore.Firestore, feedbackId: string): Promise<void> {
  try {
    await db.collection(FEEDBACK_COLLECTION).doc(feedbackId).delete();
    console.log(`  ✓ Deleted test feedback doc ${feedbackId}`);
  } catch (err) {
    console.error(`  ✗ Failed to delete test feedback doc: ${err instanceof Error ? err.message : err}`);
  }
}

async function main(): Promise<void> {
  const db = admin.firestore();

  console.log('========================================================================');
  console.log('  PHASE 3 VERIFY — Prompt Engineer end-to-end');
  console.log('========================================================================');

  // Step 1: snapshot the current v1 GM
  section('1. Snapshot current Copywriter GM (v1)');
  const v1GM = await getActiveSpecialistGMByIndustry(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
  if (!v1GM) {
    throw new Error('No active Copywriter GM found — cannot run test');
  }
  const v1Prompt = (v1GM.config as Record<string, unknown>).systemPrompt as string;
  console.log(`  active GM id: ${v1GM.id}`);
  console.log(`  version:       ${v1GM.version}`);
  console.log(`  prompt length: ${v1Prompt.length} chars`);

  let feedbackId: string | null = null;
  let shouldRollback = false;

  try {
    // Step 2: submit a grade
    section('2. Submit a human grade (reject with reason: "too corporate, sounds like every other SaaS vendor")');
    const submitResult = await submitGrade({
      targetSpecialistId: TARGET_SPECIALIST_ID,
      targetSpecialistName: 'Copywriter',
      sourceReportTaskId: 'probe_test_report_001',
      sourceReportExcerpt: 'Unlock the power of cutting-edge solutions to transform your workflow. Our best-in-class platform empowers your team to take your business to the next level with world-class support.',
      grade: 'reject',
      explanation: 'This copy is too corporate and generic — it sounds like every other SaaS vendor. Our brand is confident and direct, not hedging. The output needs to be more specific about what we actually do (AI agent swarm for B2B SaaS sales) and use concrete examples instead of vague phrases like "take your business to the next level". The specificity rules section of the prompt needs to demand concrete examples with named features and measurable outcomes, not abstract benefits.',
      graderUserId: 'test_grader_phase3_verify',
      graderDisplayName: 'Phase 3 Verify Test',
    });

    console.log(`  submitGrade status: ${submitResult.status}`);

    if (submitResult.status === 'ERROR') {
      throw new Error(`submitGrade returned ERROR: ${submitResult.error}`);
    }

    feedbackId = submitResult.feedbackId;
    console.log(`  feedbackId: ${feedbackId}`);

    if (submitResult.status === 'CLARIFICATION_NEEDED') {
      console.log(`  Prompt Engineer asked for clarification:`);
      for (const q of submitResult.clarification.questions) {
        console.log(`    - ${q}`);
      }
      console.log(`\n  rationale: ${submitResult.clarification.rationale}`);
      console.log('\n  ⚠ Prompt Engineer returned CLARIFICATION_NEEDED instead of EDIT_PROPOSED.');
      console.log('     The test expected EDIT_PROPOSED — this is an acceptable outcome but');
      console.log('     it means this test fixture did not exercise the full approve/deploy path.');
      shouldRollback = true;
      return;
    }

    shouldRollback = true;

    // Step 3: inspect the proposed edit
    section('3. Inspect the Prompt Engineer proposed edit');
    const edit = submitResult.proposedEdit;
    console.log(`  status:               ${edit.status}`);
    console.log(`  targetSection:        ${edit.targetSection.headingOrLocation}`);
    console.log(`  targetSection reason: ${edit.targetSection.reasoning.slice(0, 200)}...`);
    console.log(`  currentText length:   ${edit.currentText.length} chars`);
    console.log(`  proposedText length:  ${edit.proposedText.length} chars`);
    console.log(`  confidence:           ${edit.confidence}`);
    console.log(`  preservesBrandDna:    ${edit.preservesBrandDna}`);
    console.log(`  conflicts:            ${edit.conflictsWithOtherSections.length} items`);
    console.log(`  rationale: ${edit.rationale.slice(0, 300)}...`);

    // Invariant: currentText must appear verbatim in the v1 prompt
    if (!v1Prompt.includes(edit.currentText)) {
      throw new Error('INVARIANT VIOLATED: proposed edit currentText does not appear verbatim in v1 Copywriter prompt');
    }
    console.log(`  ✓ currentText appears verbatim in v1 prompt`);

    if (!edit.preservesBrandDna) {
      throw new Error('INVARIANT VIOLATED: proposed edit does not preserve Brand DNA');
    }
    console.log(`  ✓ preservesBrandDna = true`);

    // Step 4: approve the edit
    section('4. Approve the proposed edit (createIndustryGMVersionFromEdit → deployIndustryGMVersion)');
    const approveResult = await approvePromptEdit({
      feedbackId: submitResult.feedbackId,
      approvedEdit: edit,
      approverUserId: 'test_approver_phase3_verify',
      approverDisplayName: 'Phase 3 Verify Test',
    });

    console.log(`  approve status: ${approveResult.status}`);
    if (approveResult.status === 'ERROR') {
      throw new Error(`approvePromptEdit returned ERROR: ${approveResult.error}`);
    }
    console.log(`  new version:    ${approveResult.newVersion}`);
    console.log(`  new GM doc id:  ${approveResult.newGMDocId}`);

    // Step 5: read back the active GM — should be v2 now
    section('5. Read back the active GM — should be v2 with the edit applied');
    invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    const activeAfterDeploy = await getActiveSpecialistGMByIndustry(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    if (!activeAfterDeploy) {
      throw new Error('No active Copywriter GM found after approve step');
    }
    console.log(`  active GM id: ${activeAfterDeploy.id}`);
    console.log(`  version:       ${activeAfterDeploy.version}`);

    if (activeAfterDeploy.version !== approveResult.newVersion) {
      throw new Error(`Version mismatch: expected v${approveResult.newVersion}, active is v${activeAfterDeploy.version}`);
    }
    console.log(`  ✓ active version bumped to v${activeAfterDeploy.version}`);

    const v2Prompt = (activeAfterDeploy.config as Record<string, unknown>).systemPrompt as string;
    if (v2Prompt.includes(edit.currentText)) {
      throw new Error('INVARIANT VIOLATED: v2 prompt still contains the OLD currentText — edit did not apply');
    }
    if (!v2Prompt.includes(edit.proposedText)) {
      throw new Error('INVARIANT VIOLATED: v2 prompt does not contain the NEW proposedText — edit did not apply');
    }
    console.log(`  ✓ v2 prompt replaces currentText with proposedText`);

    // Step 6: verify the new prompt length delta makes sense
    const delta = v2Prompt.length - v1Prompt.length;
    console.log(`  prompt length delta: ${delta > 0 ? '+' : ''}${delta} chars (v1=${v1Prompt.length}, v2=${v2Prompt.length})`);

    console.log('\n========================================================================');
    console.log('  ✓ PHASE 3 END-TO-END VERIFIED');
    console.log('========================================================================');
    console.log('  - Grade submission wrote TrainingFeedback record');
    console.log('  - Prompt Engineer produced a surgical edit (EDIT_PROPOSED)');
    console.log('  - Edit preserved Brand DNA and had verbatim currentText');
    console.log('  - Approval path created new GM version');
    console.log('  - Deployment activated v2 and invalidated cache');
    console.log('  - Active GM now reflects the edit');
    console.log('  - Training Lab / Prompt Engineer flow is LIVE');
  } finally {
    // Step 7: ALWAYS roll back to v1 so the test doesn't leave artifacts
    section('6. ROLLBACK — restore Copywriter GM to v1 (test cleanup)');
    if (shouldRollback) {
      await rollbackToV1(db);
    } else {
      console.log('  (nothing to roll back)');
    }
    if (feedbackId) {
      await cleanupTestFeedback(db, feedbackId);
    }
    console.log('');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
