/**
 * Verify the M4 mission plan lifecycle end-to-end against real Firestore.
 *
 * Walks the full happy path:
 *   1. Create a mission with a draft plan via createMissionWithPlan
 *   2. Read it back, verify status = PLAN_PENDING_APPROVAL with N PROPOSED steps
 *   3. Edit step 1's summary + tool args via updatePlannedStep
 *   4. Move step 1 to the end via reorderPlannedSteps
 *   5. Delete what is now step 2 via deletePlannedStep
 *   6. Approve the plan via approvePlan (status flips to IN_PROGRESS)
 *   7. Read it back, verify status = IN_PROGRESS
 *
 * Then walks the reject path on a fresh mission:
 *   1. Create another draft plan
 *   2. Reject it via rejectPlan
 *   3. Verify status = FAILED with reason recorded
 *
 * Cleanup: deletes both test missions in a finally block so the script
 * leaves the system in the same state it found it.
 *
 * Standing rules respected:
 *   - No GM changes (Standing Rule #2 — no grades, no changes)
 *   - No Brand DNA touched (Standing Rule #1)
 *   - Real Firestore writes proven, not just "the code compiled"
 *
 * Usage: npx tsx scripts/verify-mission-plan-lifecycle.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const PLATFORM_ID = 'rapid-compliance-root';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
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

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials in .env.local');
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

interface Step {
  stepId: string;
  toolName: string;
  status: string;
  summary?: string;
  toolArgs?: Record<string, unknown>;
}

interface Mission {
  missionId: string;
  status: string;
  steps: Step[];
  error?: string;
}

async function readMission(db: admin.firestore.Firestore, missionId: string): Promise<Mission | null> {
  const doc = await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(missionId).get();
  if (!doc.exists) { return null; }
  return doc.data() as Mission;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();

  // We'll import the helper functions from the persistence module via
  // dynamic require so the script can be run as standalone tsx.
  const {
    createMissionWithPlan,
    updatePlannedStep,
    reorderPlannedSteps,
    deletePlannedStep,
    approvePlan,
    rejectPlan,
  } = await import('../src/lib/orchestrator/mission-persistence');

  const happyMissionId = `verify_plan_happy_${Date.now()}`;
  const rejectMissionId = `verify_plan_reject_${Date.now()}`;

  let happyOk = false;
  let rejectOk = false;

  try {
    console.log('━'.repeat(60));
    console.log('PART 1 — Happy path (edit → reorder → delete → approve)');
    console.log('━'.repeat(60));

    console.log('\n[1/7] Create draft plan with 3 steps');
    await createMissionWithPlan({
      missionId: happyMissionId,
      conversationId: 'verify_test',
      title: 'Verify M4 plan lifecycle (happy path)',
      userPrompt: 'TEST — verify plan lifecycle helpers',
      plannedSteps: [
        {
          order: 1,
          toolName: 'delegate_to_intelligence',
          toolArgs: { researchType: 'competitors', industry: 'verify-test' },
          summary: 'Step 1 — research competitors',
        },
        {
          order: 2,
          toolName: 'delegate_to_content',
          toolArgs: { contentType: 'blog', topic: 'verify test' },
          summary: 'Step 2 — write blog',
        },
        {
          order: 3,
          toolName: 'social_post',
          toolArgs: { platform: 'twitter', content: 'verify test' },
          summary: 'Step 3 — post promo',
        },
      ],
    });

    console.log('\n[2/7] Read back and verify shape');
    let mission = await readMission(db, happyMissionId);
    assert(mission !== null, 'mission was created');
    assert(mission!.status === 'PLAN_PENDING_APPROVAL', 'status is PLAN_PENDING_APPROVAL');
    assert(mission!.steps.length === 3, 'has 3 steps');
    assert(mission!.steps.every((s) => s.status === 'PROPOSED'), 'every step is PROPOSED');
    const originalIds = mission!.steps.map((s) => s.stepId);
    console.log(`  · step IDs: ${originalIds.join(', ')}`);

    console.log('\n[3/7] Edit step 1 summary and tool args');
    const editOk = await updatePlannedStep(happyMissionId, originalIds[0], {
      summary: 'EDITED — researching the top 3 competitors only',
      toolArgs: { researchType: 'competitors', industry: 'verify-test', count: 3 },
    });
    assert(editOk, 'updatePlannedStep returned true');
    mission = await readMission(db, happyMissionId);
    const step1 = mission!.steps.find((s) => s.stepId === originalIds[0])!;
    assert(step1.summary === 'EDITED — researching the top 3 competitors only', 'summary updated');
    assert((step1.toolArgs as Record<string, unknown>).count === 3, 'toolArgs.count = 3');

    console.log('\n[4/7] Reorder: move step 1 to the end');
    const reorderedIds = [originalIds[1], originalIds[2], originalIds[0]];
    const reorderOk = await reorderPlannedSteps(happyMissionId, reorderedIds);
    assert(reorderOk, 'reorderPlannedSteps returned true');
    mission = await readMission(db, happyMissionId);
    assert(mission!.steps[0].stepId === originalIds[1], 'first step is now original step 2');
    assert(mission!.steps[1].stepId === originalIds[2], 'second step is now original step 3');
    assert(mission!.steps[2].stepId === originalIds[0], 'third step is now the edited original step 1');
    assert(mission!.steps[2].summary === 'EDITED — researching the top 3 competitors only', 'edit survived reorder');

    console.log('\n[5/7] Delete the new step 2 (original step 3)');
    const deleteOk = await deletePlannedStep(happyMissionId, originalIds[2]);
    assert(deleteOk, 'deletePlannedStep returned true');
    mission = await readMission(db, happyMissionId);
    assert(mission!.steps.length === 2, 'now has 2 steps');
    assert(!mission!.steps.some((s) => s.stepId === originalIds[2]), 'deleted step is gone');

    console.log('\n[6/7] Try to delete the second-to-last step (should still work — only blocks at 1)');
    const deleteAgainOk = await deletePlannedStep(happyMissionId, mission!.steps[0].stepId);
    assert(deleteAgainOk, 'second delete also worked');
    mission = await readMission(db, happyMissionId);
    assert(mission!.steps.length === 1, 'now has 1 step');

    console.log('\n[6b/7] Try to delete the LAST step (should refuse)');
    const lastDeleteOk = await deletePlannedStep(happyMissionId, mission!.steps[0].stepId);
    assert(!lastDeleteOk, 'deletePlannedStep refused to delete the last remaining step');
    mission = await readMission(db, happyMissionId);
    assert(mission!.steps.length === 1, 'still has 1 step');

    console.log('\n[7/7] Approve plan — status flips to IN_PROGRESS');
    const approveOk = await approvePlan(happyMissionId);
    assert(approveOk, 'approvePlan returned true');
    mission = await readMission(db, happyMissionId);
    assert(mission!.status === 'IN_PROGRESS', 'status is now IN_PROGRESS');

    console.log('\n[7b/7] Try to edit a step after approval (should refuse)');
    const editAfterApproveOk = await updatePlannedStep(happyMissionId, mission!.steps[0].stepId, {
      summary: 'should not stick',
    });
    assert(!editAfterApproveOk, 'updatePlannedStep refused after approval');
    mission = await readMission(db, happyMissionId);
    assert(mission!.steps[0].summary !== 'should not stick', 'summary did not change after approval');

    happyOk = true;

    console.log('\n' + '━'.repeat(60));
    console.log('PART 2 — Reject path');
    console.log('━'.repeat(60));

    console.log('\n[1/3] Create a second draft plan');
    await createMissionWithPlan({
      missionId: rejectMissionId,
      conversationId: 'verify_test',
      title: 'Verify M4 plan lifecycle (reject path)',
      userPrompt: 'TEST — verify reject path',
      plannedSteps: [
        {
          order: 1,
          toolName: 'delegate_to_intelligence',
          toolArgs: { researchType: 'verify' },
          summary: 'Step that will be rejected',
        },
      ],
    });

    let rejectMission = await readMission(db, rejectMissionId);
    assert(rejectMission !== null, 'reject test mission created');
    assert(rejectMission!.status === 'PLAN_PENDING_APPROVAL', 'status is PLAN_PENDING_APPROVAL');

    console.log('\n[2/3] Reject the plan with a reason');
    const rejectOkResult = await rejectPlan(rejectMissionId, 'Verify test — rejecting on purpose');
    assert(rejectOkResult, 'rejectPlan returned true');
    rejectMission = await readMission(db, rejectMissionId);
    assert(rejectMission!.status === 'FAILED', 'status is now FAILED');
    assert(
      rejectMission!.error === 'Verify test — rejecting on purpose',
      'rejection reason recorded',
    );

    console.log('\n[3/3] Try to approve the rejected mission (should refuse)');
    const lateApproveOk = await approvePlan(rejectMissionId);
    assert(!lateApproveOk, 'approvePlan refused on a FAILED mission');

    rejectOk = true;
  } catch (err) {
    console.error('\n✗ TEST FAILED');
    console.error(err);
    process.exitCode = 1;
  } finally {
    console.log('\n' + '━'.repeat(60));
    console.log('CLEANUP');
    console.log('━'.repeat(60));
    try {
      await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(happyMissionId).delete();
      console.log(`  · deleted ${happyMissionId}`);
    } catch { /* ignore */ }
    try {
      await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(rejectMissionId).delete();
      console.log(`  · deleted ${rejectMissionId}`);
    } catch { /* ignore */ }
  }

  console.log('\n' + '━'.repeat(60));
  if (happyOk && rejectOk) {
    console.log('✓ ALL CHECKS PASSED — M4 plan lifecycle works end-to-end');
  } else {
    console.log('✗ SOME CHECKS FAILED');
    process.exitCode = 1;
  }
  console.log('━'.repeat(60));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
