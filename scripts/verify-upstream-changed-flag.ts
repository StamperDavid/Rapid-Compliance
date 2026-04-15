/**
 * Verify the M5 downstream-changed flag behavior on real Firestore.
 *
 * Tests:
 *   1. Create plan with 3 steps, approve all, run mission to completion
 *   2. All 3 steps end in COMPLETED, no upstreamChanged flags
 *   3. Rerun step 2 → upstreamChanged should appear on step 3 (not step 1, not step 2 itself)
 *   4. clearStepUpstreamFlag on step 3 → flag clears, output preserved
 *   5. Rerun step 1 → upstreamChanged should appear on step 2 AND step 3
 *
 * Cleanup in finally.
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
  status: string;
  upstreamChanged?: boolean;
}

interface Mission {
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
    approveAllPlanSteps,
    rerunMissionStep,
    clearStepUpstreamFlag,
  } = await import('../src/lib/orchestrator/mission-persistence');
  const { runMissionToCompletion } = await import('../src/lib/orchestrator/step-runner');

  const missionId = `verify_upstream_${Date.now()}`;
  let ok = false;

  try {
    console.log('━'.repeat(60));
    console.log('Verify M5 — downstream-changed flag');
    console.log('━'.repeat(60));

    console.log('\n[1] Create plan with 3 query_docs steps');
    await createMissionWithPlan({
      missionId,
      conversationId: 'verify_test',
      title: 'Verify M5 upstream flag',
      userPrompt: 'TEST',
      plannedSteps: [
        { order: 1, toolName: 'query_docs', toolArgs: { query: 'agents' }, summary: 'Step 1' },
        { order: 2, toolName: 'query_docs', toolArgs: { query: 'features' }, summary: 'Step 2' },
        { order: 3, toolName: 'query_docs', toolArgs: { query: 'integrations' }, summary: 'Step 3' },
      ],
    });
    await approveAllPlanSteps(missionId);
    await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(missionId).update({ status: 'IN_PROGRESS' });

    let mission = await readMission(db, missionId);
    const step1Id = mission!.steps[0].stepId;
    const step2Id = mission!.steps[1].stepId;
    const step3Id = mission!.steps[2].stepId;

    console.log('\n[2] Run mission to completion');
    const r1 = await runMissionToCompletion({
      missionId, userId: 'verify-test-uid', conversationId: 'verify_test', userPrompt: 'TEST',
    });
    assert(r1.success, 'mission ran successfully');
    mission = await readMission(db, missionId);
    assert(mission!.steps.every((s) => s.status === 'COMPLETED'), 'all 3 steps COMPLETED');
    assert(mission!.steps.every((s) => s.upstreamChanged !== true), 'no upstream flags after first run');

    console.log('\n[3] Rerun step 2 → step 3 should get the flag, step 1 should not');
    await rerunMissionStep(missionId, step2Id);
    mission = await readMission(db, missionId);
    assert(mission!.steps[0].upstreamChanged !== true, 'step 1 has NO flag (it is upstream of the rerun)');
    assert(mission!.steps[1].upstreamChanged !== true, 'step 2 has NO flag (it IS the rerun source)');
    assert(mission!.steps[2].upstreamChanged === true, 'step 3 HAS the flag (it is downstream)');

    // After rerunMissionStep, step 2 is in PROPOSED waiting for the runner.
    // Run it.
    console.log('\n[4] Run mission again to finish step 2');
    await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(missionId).update({ status: 'IN_PROGRESS' });
    await runMissionToCompletion({
      missionId, userId: 'verify-test-uid', conversationId: 'verify_test', userPrompt: 'TEST',
    });
    mission = await readMission(db, missionId);
    assert(mission!.steps[1].status === 'COMPLETED', 'step 2 is COMPLETED again');
    assert(mission!.steps[2].upstreamChanged === true, 'step 3 STILL has the flag (rerunning step 2 does not auto-clear it)');

    console.log('\n[5] Clear the flag on step 3 — operator says "still good"');
    const cleared = await clearStepUpstreamFlag(missionId, step3Id);
    assert(cleared, 'clearStepUpstreamFlag returned true');
    mission = await readMission(db, missionId);
    assert(mission!.steps[2].upstreamChanged !== true, 'step 3 flag is cleared');
    assert(mission!.steps[2].status === 'COMPLETED', 'step 3 still COMPLETED (output preserved, not rerun)');

    console.log('\n[6] Rerun step 1 → BOTH step 2 and step 3 should get the flag');
    await rerunMissionStep(missionId, step1Id);
    mission = await readMission(db, missionId);
    assert(mission!.steps[1].upstreamChanged === true, 'step 2 HAS the flag (downstream of step 1 rerun)');
    assert(mission!.steps[2].upstreamChanged === true, 'step 3 HAS the flag (downstream of step 1 rerun)');
    // step 1 itself is now PROPOSED — no flag (it IS the source)
    assert(mission!.steps[0].upstreamChanged !== true, 'step 1 has NO flag (it is the rerun source)');

    void step1Id;
    ok = true;
  } catch (err) {
    console.error('\n✗ TEST FAILED');
    console.error(err);
    process.exitCode = 1;
  } finally {
    console.log('\n' + '━'.repeat(60));
    console.log('CLEANUP');
    console.log('━'.repeat(60));
    try {
      await db.collection(`organizations/${PLATFORM_ID}/missions`).doc(missionId).delete();
      console.log(`  · deleted ${missionId}`);
    } catch { /* ignore */ }
  }

  console.log('\n' + '━'.repeat(60));
  if (ok) {
    console.log('✓ ALL CHECKS PASSED — M5 upstream-changed flag works');
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
