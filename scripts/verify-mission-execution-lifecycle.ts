/**
 * Verify the corrected M3 mission execution lifecycle (M3.6 + M3.7)
 * end-to-end against real Firestore.
 *
 * The model being verified:
 *   - Operator approves every step in the plan view (or clicks
 *     "Approve all steps") before execution starts
 *   - Once approved, the runner walks every approved step in plan
 *     order, sequentially, without pausing for human gates
 *   - Each step gets ONE auto-retry on failure
 *   - On second failure, the mission halts at AWAITING_APPROVAL
 *   - Operator can rerun a halted step (optionally with edited args),
 *     mission resumes from where it stopped
 *
 * Test tools: query_docs is the workhorse because it's a local
 * Firestore lookup with no LLM cost. Failure cases use query_docs
 * with a missing required `query` argument — the tool returns an
 * error, the runner sees it, retries once, and the same arg failure
 * happens again.
 *
 * Cleanup runs in finally — every test mission deleted.
 *
 * Usage: npx tsx scripts/verify-mission-execution-lifecycle.ts
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
  operatorApproved?: boolean;
}

interface Mission {
  missionId: string;
  status: string;
  steps: Step[];
  approvalRequired?: boolean;
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
    approvePlanStep,
    approveAllPlanSteps,
    rerunMissionStep,
  } = await import('../src/lib/orchestrator/mission-persistence');
  const { runMissionToCompletion } = await import('../src/lib/orchestrator/step-runner');

  const happyMissionId = `verify_exec_happy_${Date.now()}`;
  const gateMissionId = `verify_exec_gate_${Date.now()}`;
  const haltMissionId = `verify_exec_halt_${Date.now()}`;

  let happyOk = false;
  let gateOk = false;
  let haltOk = false;

  try {
    console.log('━'.repeat(60));
    console.log('PART 1 — Happy path (all approved → run to completion)');
    console.log('━'.repeat(60));

    console.log('\n[1] Create plan with 2 query_docs steps');
    await createMissionWithPlan({
      missionId: happyMissionId,
      conversationId: 'verify_test',
      title: 'Verify M3 happy path',
      userPrompt: 'TEST',
      plannedSteps: [
        {
          order: 1,
          toolName: 'query_docs',
          toolArgs: { query: 'agents', section: 'agents' },
          summary: 'Step 1 — query agents',
        },
        {
          order: 2,
          toolName: 'query_docs',
          toolArgs: { query: 'features', section: 'features' },
          summary: 'Step 2 — query features',
        },
      ],
    });

    console.log('\n[2] Approve all steps via approveAllPlanSteps');
    const allApprovedOk = await approveAllPlanSteps(happyMissionId);
    assert(allApprovedOk, 'approveAllPlanSteps returned true');
    let happyMission = await readMission(db, happyMissionId);
    assert(happyMission!.steps.every((s) => s.operatorApproved === true), 'every step is operatorApproved');

    console.log('\n[3] Manually flip mission to IN_PROGRESS (simulating /plan/approve)');
    await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(happyMissionId).update({
      status: 'IN_PROGRESS',
    });

    console.log('\n[4] Run mission to completion — both steps should run sequentially without pause');
    const happyResult = await runMissionToCompletion({
      missionId: happyMissionId,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });
    assert(happyResult.success, 'happy mission ran successfully');
    assert(happyResult.finalStatus === 'COMPLETED', 'finalStatus is COMPLETED');
    assert(happyResult.stepsRun === 2, 'ran 2 steps');
    assert(happyResult.stepsFailed === 0, 'no failures');

    happyMission = await readMission(db, happyMissionId);
    assert(happyMission!.status === 'COMPLETED', 'mission status is COMPLETED');
    assert(happyMission!.steps.every((s) => s.status === 'COMPLETED'), 'every step COMPLETED');
    assert(happyMission!.steps.every((s) => s.toolResult !== undefined), 'every step has a result');

    happyOk = true;

    console.log('\n' + '━'.repeat(60));
    console.log('PART 2 — Gate test (runner skips unapproved steps)');
    console.log('━'.repeat(60));

    console.log('\n[1] Create plan with 2 steps — only approve the second one');
    await createMissionWithPlan({
      missionId: gateMissionId,
      conversationId: 'verify_test',
      title: 'Verify M3 gate',
      userPrompt: 'TEST',
      plannedSteps: [
        {
          order: 1,
          toolName: 'query_docs',
          toolArgs: { query: 'agents' },
          summary: 'Step 1 — UNAPPROVED, runner should skip',
        },
        {
          order: 2,
          toolName: 'query_docs',
          toolArgs: { query: 'features' },
          summary: 'Step 2 — approved, runner should run this',
        },
      ],
    });

    let gateMission = await readMission(db, gateMissionId);
    const step2Id = gateMission!.steps[1].stepId;
    const ok = await approvePlanStep(gateMissionId, step2Id);
    assert(ok, 'approvePlanStep on step 2 succeeded');

    gateMission = await readMission(db, gateMissionId);
    assert(gateMission!.steps[0].operatorApproved !== true, 'step 1 is NOT approved');
    assert(gateMission!.steps[1].operatorApproved === true, 'step 2 is approved');

    console.log('\n[2] Flip mission to IN_PROGRESS and run');
    await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(gateMissionId).update({
      status: 'IN_PROGRESS',
    });
    const gateResult = await runMissionToCompletion({
      missionId: gateMissionId,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });

    console.log('\n[3] Verify only the approved step ran');
    assert(gateResult.stepsRun === 1, 'runner ran exactly 1 step (only the approved one)');
    gateMission = await readMission(db, gateMissionId);
    assert(gateMission!.steps[0].status === 'PROPOSED', 'unapproved step 1 is still PROPOSED (skipped)');
    assert(gateMission!.steps[1].status === 'COMPLETED', 'approved step 2 is COMPLETED');

    gateOk = true;

    console.log('\n' + '━'.repeat(60));
    console.log('PART 3 — Halt path (failure twice → halt → rerun → resume)');
    console.log('━'.repeat(60));

    console.log('\n[1] Create plan with 2 steps. Step 1 will fail (missing required arg).');
    await createMissionWithPlan({
      missionId: haltMissionId,
      conversationId: 'verify_test',
      title: 'Verify M3 halt path',
      userPrompt: 'TEST',
      plannedSteps: [
        {
          order: 1,
          toolName: 'query_docs',
          toolArgs: {}, // missing `query` — query_docs returns an error
          summary: 'Step 1 — will fail twice (missing required query arg)',
        },
        {
          order: 2,
          toolName: 'query_docs',
          toolArgs: { query: 'features' },
          summary: 'Step 2 — should NOT run because step 1 halts the mission',
        },
      ],
    });

    await approveAllPlanSteps(haltMissionId);
    await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(haltMissionId).update({
      status: 'IN_PROGRESS',
    });
    let haltMission = await readMission(db, haltMissionId);
    const haltStep1Id = haltMission!.steps[0].stepId;
    const haltStep2Id = haltMission!.steps[1].stepId;

    console.log('\n[2] Run mission — should fail step 1 twice and halt');
    const haltResult = await runMissionToCompletion({
      missionId: haltMissionId,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });
    assert(!haltResult.success, 'mission did not succeed');
    assert(haltResult.finalStatus === 'AWAITING_APPROVAL', 'finalStatus is AWAITING_APPROVAL (halted)');
    assert(haltResult.stepsFailed >= 1, 'at least one step failed');
    assert(haltResult.haltedAtStepId === haltStep1Id, 'haltedAtStepId is step 1');

    haltMission = await readMission(db, haltMissionId);
    assert(haltMission!.status === 'AWAITING_APPROVAL', 'mission status is AWAITING_APPROVAL');
    assert(haltMission!.steps[0].status === 'FAILED', 'step 1 is FAILED');
    assert(haltMission!.steps[1].status === 'PROPOSED', 'step 2 is still PROPOSED (never ran)');
    assert(haltMission!.approvalRequired === true, 'approvalRequired flag set');

    console.log('\n[3] Rerun step 1 with corrected toolArgs (the missing query)');
    const reset = await rerunMissionStep(haltMissionId, haltStep1Id, {
      newToolArgs: { query: 'agents', section: 'agents' },
    });
    assert(reset !== null, 'rerunMissionStep returned the reset step');
    assert(reset!.status === 'PROPOSED', 'step reset to PROPOSED');
    assert((reset!.toolArgs as Record<string, unknown>).query === 'agents', 'toolArgs.query updated');

    console.log('\n[4] Run mission again — should resume from step 1, complete step 2');
    const resumeResult = await runMissionToCompletion({
      missionId: haltMissionId,
      userId: 'verify-test-uid',
      conversationId: 'verify_test',
      userPrompt: 'TEST',
    });
    assert(resumeResult.success, 'resumed mission ran successfully');
    assert(resumeResult.finalStatus === 'COMPLETED', 'resumed finalStatus is COMPLETED');
    assert(resumeResult.stepsRun === 2, 'ran both steps on resume');

    haltMission = await readMission(db, haltMissionId);
    assert(haltMission!.status === 'COMPLETED', 'mission status is COMPLETED after resume');
    assert(haltMission!.steps[0].status === 'COMPLETED', 'step 1 now COMPLETED');
    assert(haltMission!.steps[1].status === 'COMPLETED', 'step 2 now COMPLETED');
    assert(haltStep2Id === haltMission!.steps[1].stepId, 'step 2 ID unchanged');

    haltOk = true;
  } catch (err) {
    console.error('\n✗ TEST FAILED');
    console.error(err);
    process.exitCode = 1;
  } finally {
    console.log('\n' + '━'.repeat(60));
    console.log('CLEANUP');
    console.log('━'.repeat(60));
    for (const id of [happyMissionId, gateMissionId, haltMissionId]) {
      try {
        await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(id).delete();
        console.log(`  · deleted ${id}`);
      } catch { /* ignore */ }
    }
  }

  console.log('\n' + '━'.repeat(60));
  if (happyOk && gateOk && haltOk) {
    console.log('✓ ALL CHECKS PASSED — M3.6 + M3.7 mission execution works end-to-end');
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
