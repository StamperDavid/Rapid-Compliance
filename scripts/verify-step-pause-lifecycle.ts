/**
 * Verify the M3 per-step pause lifecycle end-to-end against real Firestore.
 *
 * Walks the full happy path AND the rerun path using `query_docs` as
 * the test tool — query_docs is a local Firestore lookup, no LLM call,
 * so the test runs in seconds and burns zero OpenRouter credits. The
 * lifecycle being verified is the state machine and the step runner,
 * not Jasper's reasoning.
 *
 * Happy path:
 *   1. Create a draft plan with 2 query_docs steps
 *   2. Run step 1 via runOneStep — verify it parks in AWAITING_APPROVAL
 *   3. Approve step 1 via markStepApproved + runOneStep on step 2
 *   4. Verify step 2 parks in AWAITING_APPROVAL
 *   5. Approve step 2 via markStepApproved
 *   6. Verify findNextProposedStep returns null (mission done)
 *   7. finalizeMission COMPLETED
 *
 * Rerun path:
 *   1. Create another plan with 1 step
 *   2. Run step 1 — parks in AWAITING_APPROVAL
 *   3. rerunMissionStep with edited toolArgs
 *   4. Verify step is back in PROPOSED with new args, prior result stripped
 *   5. Run again via runOneStep
 *   6. Verify step parks in AWAITING_APPROVAL with new result
 *
 * Cleanup: deletes both test missions in finally.
 *
 * Standing rules respected:
 *   - No GM changes (Standing Rule #2)
 *   - No Brand DNA touched (Standing Rule #1)
 *   - Real Firestore writes proven, not just compile-time checks
 *
 * Usage: npx tsx scripts/verify-step-pause-lifecycle.ts
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
  toolResult?: string;
  durationMs?: number;
  error?: string;
}

interface Mission {
  missionId: string;
  status: string;
  steps: Step[];
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

  const {
    createMissionWithPlan,
    markStepApproved,
    rerunMissionStep,
    findNextProposedStep,
    finalizeMission,
  } = await import('../src/lib/orchestrator/mission-persistence');
  const { runOneStep } = await import('../src/lib/orchestrator/step-runner');

  const happyMissionId = `verify_steppause_happy_${Date.now()}`;
  const rerunMissionId = `verify_steppause_rerun_${Date.now()}`;

  let happyOk = false;
  let rerunOk = false;

  try {
    console.log('━'.repeat(60));
    console.log('PART 1 — Happy path (run → pause → approve → next)');
    console.log('━'.repeat(60));

    console.log('\n[1] Create plan with 2 query_docs steps');
    await createMissionWithPlan({
      missionId: happyMissionId,
      conversationId: 'verify_test',
      title: 'Verify M3 step pause (happy path)',
      userPrompt: 'TEST — verify per-step pause runner',
      plannedSteps: [
        {
          order: 1,
          toolName: 'query_docs',
          toolArgs: { query: 'agents', section: 'agents' },
          summary: 'Step 1 — query agents docs',
        },
        {
          order: 2,
          toolName: 'query_docs',
          toolArgs: { query: 'features', section: 'features' },
          summary: 'Step 2 — query features docs',
        },
      ],
    });

    let mission = await readMission(db, happyMissionId);
    assert(mission !== null, 'mission created');
    assert(mission!.status === 'PLAN_PENDING_APPROVAL', 'mission in PLAN_PENDING_APPROVAL');
    assert(mission!.steps.length === 2, 'has 2 steps');
    assert(mission!.steps.every((s) => s.status === 'PROPOSED'), 'every step is PROPOSED');
    const step1Id = mission!.steps[0].stepId;
    const step2Id = mission!.steps[1].stepId;

    console.log('\n[2] Run step 1 via runOneStep — should park in AWAITING_APPROVAL');
    const r1 = await runOneStep({
      missionId: happyMissionId,
      stepId: step1Id,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });
    assert(r1.success, 'step 1 ran successfully');
    assert(r1.mission !== null, 'mission returned from runOneStep');

    mission = await readMission(db, happyMissionId);
    const persistedStep1 = mission!.steps.find((s) => s.stepId === step1Id)!;
    assert(persistedStep1.status === 'AWAITING_APPROVAL', 'step 1 parked in AWAITING_APPROVAL');
    assert(persistedStep1.toolResult !== undefined, 'step 1 has toolResult captured');
    assert(persistedStep1.durationMs !== undefined && persistedStep1.durationMs > 0, 'step 1 duration recorded');
    assert(mission!.status === 'AWAITING_APPROVAL', 'mission status is AWAITING_APPROVAL');
    assert(mission!.steps[1].status === 'PROPOSED', 'step 2 still PROPOSED (not run yet)');

    console.log('\n[3] Approve step 1 via markStepApproved');
    const approvedMission = await markStepApproved(happyMissionId, step1Id);
    assert(approvedMission !== null, 'markStepApproved returned the mission');
    assert(approvedMission!.steps[0].status === 'COMPLETED', 'step 1 is now COMPLETED');

    const nextStep = findNextProposedStep(approvedMission!);
    assert(nextStep !== null, 'findNextProposedStep returned step 2');
    assert(nextStep!.stepId === step2Id, 'next step is step 2');

    console.log('\n[4] Run step 2 — should park in AWAITING_APPROVAL');
    const r2 = await runOneStep({
      missionId: happyMissionId,
      stepId: step2Id,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });
    assert(r2.success, 'step 2 ran successfully');

    mission = await readMission(db, happyMissionId);
    const persistedStep2 = mission!.steps.find((s) => s.stepId === step2Id)!;
    assert(persistedStep2.status === 'AWAITING_APPROVAL', 'step 2 parked in AWAITING_APPROVAL');
    assert(mission!.steps[0].status === 'COMPLETED', 'step 1 still COMPLETED');

    console.log('\n[5] Approve step 2 — should be no next step');
    const finalApproved = await markStepApproved(happyMissionId, step2Id);
    assert(finalApproved !== null, 'markStepApproved returned the mission');
    assert(finalApproved!.steps[1].status === 'COMPLETED', 'step 2 is now COMPLETED');
    const noNext = findNextProposedStep(finalApproved!);
    assert(noNext === null, 'findNextProposedStep returned null (no more PROPOSED)');

    console.log('\n[6] Finalize mission COMPLETED');
    await finalizeMission(happyMissionId, 'COMPLETED');
    mission = await readMission(db, happyMissionId);
    assert(mission!.status === 'COMPLETED', 'mission status is COMPLETED');
    assert(mission!.steps.every((s) => s.status === 'COMPLETED'), 'every step is COMPLETED');

    happyOk = true;

    console.log('\n' + '━'.repeat(60));
    console.log('PART 2 — Rerun path (run → pause → rerun with edits → re-pause)');
    console.log('━'.repeat(60));

    console.log('\n[1] Create plan with 1 query_docs step');
    await createMissionWithPlan({
      missionId: rerunMissionId,
      conversationId: 'verify_test',
      title: 'Verify M3 rerun path',
      userPrompt: 'TEST — verify rerun',
      plannedSteps: [
        {
          order: 1,
          toolName: 'query_docs',
          toolArgs: { query: 'agents', section: 'agents' },
          summary: 'Step 1 — initial args',
        },
      ],
    });
    let rerunMission = await readMission(db, rerunMissionId);
    const rerunStepId = rerunMission!.steps[0].stepId;

    console.log('\n[2] Run step 1 — parks in AWAITING_APPROVAL');
    const initial = await runOneStep({
      missionId: rerunMissionId,
      stepId: rerunStepId,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });
    assert(initial.success, 'initial run succeeded');
    rerunMission = await readMission(db, rerunMissionId);
    let rerunStep = rerunMission!.steps[0];
    assert(rerunStep.status === 'AWAITING_APPROVAL', 'step parked in AWAITING_APPROVAL');
    const initialResultText = rerunStep.toolResult;
    assert(initialResultText !== undefined, 'initial result captured');

    console.log('\n[3] rerunMissionStep with edited toolArgs');
    const reset = await rerunMissionStep(rerunMissionId, rerunStepId, {
      newToolArgs: { query: 'features', section: 'features' },
    });
    assert(reset !== null, 'rerunMissionStep returned the reset step');
    assert(reset!.status === 'PROPOSED', 'step reset to PROPOSED');
    assert(
      (reset!.toolArgs as Record<string, unknown>).query === 'features',
      'toolArgs.query updated',
    );
    assert(reset!.completedAt === undefined, 'completedAt stripped');
    assert(reset!.toolResult === undefined, 'toolResult stripped');
    assert(reset!.durationMs === undefined, 'durationMs stripped');

    console.log('\n[4] Run again with new args — should park in AWAITING_APPROVAL with new result');
    const second = await runOneStep({
      missionId: rerunMissionId,
      stepId: rerunStepId,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });
    assert(second.success, 'second run succeeded');
    rerunMission = await readMission(db, rerunMissionId);
    rerunStep = rerunMission!.steps[0];
    assert(rerunStep.status === 'AWAITING_APPROVAL', 'step re-parked in AWAITING_APPROVAL');
    assert(rerunStep.toolResult !== undefined, 'new result captured');
    assert(
      rerunStep.toolResult !== initialResultText,
      'new result differs from initial result (different query produced different output)',
    );

    rerunOk = true;
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
      await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(rerunMissionId).delete();
      console.log(`  · deleted ${rerunMissionId}`);
    } catch { /* ignore */ }
  }

  console.log('\n' + '━'.repeat(60));
  if (happyOk && rerunOk) {
    console.log('✓ ALL CHECKS PASSED — M3 per-step pause works end-to-end');
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
