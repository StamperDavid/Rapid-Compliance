/**
 * Real-path proof that the Deal Closer is now an EXECUTOR: it moves a real CRM
 * deal forward / marks it won, logs the call as an activity, refuses an
 * already-closed deal, AND fails closed without operator approval.
 *
 * Drives the DealCloserSpecialist DIRECTLY (the manager `RevenueDirector` can't be
 * imported under tsx — its module graph pulls a `server-only`-marked coordinator).
 * The hands + the approval gate both live in the specialist, so this proves the
 * safety-critical behavior end-to-end. The thin manager/Jasper hop (which only
 * threads `viaApprovedMissionStep === true` down to this payload, and is set true
 * ONLY by the mission step-runner for an operator-approved step) is verified by
 * code review.
 *
 *   npx tsx scripts/verify-deal-closer-execute.ts
 *
 * NOTE: hits OpenRouter (the Deal Closer authors the activity note via its Golden
 * Master) + real Firestore. Seed the GM first: node scripts/seed-deal-closer-gm.js
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { AgentMessage, AgentReport } from '@/lib/agents/types';

interface ExecutedShape {
  rationale?: string;
  mutated?: boolean;
  approvalRequired?: boolean;
  executed?: {
    dealId: string;
    previousStage: string;
    newStage: string;
    activityId: string | null;
    dealMoved: boolean;
  };
}

let failures = 0;
function assert(label: string, cond: boolean): void {
  if (cond) {
    console.log(`  PASS ✅ ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ❌ ${label}`);
  }
}

async function runExecuteClose(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'REVENUE_DIRECTOR',
    to: 'DEAL_CLOSER',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'execute_close', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

async function main(): Promise<void> {
  const { createDeal, getDeal, deleteDeal } = await import('@/lib/crm/deal-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { DealCloserSpecialist } = await import('@/lib/agents/sales/deal-closer/specialist');

  const specialist = new DealCloserSpecialist();
  await specialist.initialize();

  console.log('1) Creating a deal at stage "proposal"…');
  const deal = await createDeal({
    name: `VERIFY execute_close ${Date.now()}`,
    company: 'Verify Co',
    companyName: 'Verify Co',
    value: 25000,
    stage: 'proposal',
    probability: 40,
  });
  console.log('   deal id:', deal.id, '| stage:', deal.stage);

  try {
    // ── Run 0: APPROVAL GATE — an UNAPPROVED execute_close must NOT mutate ────
    console.log('\n2a) UNAPPROVED run (no operator approval → must NOT mutate)…');
    const unapprovedReport = await runExecuteClose(specialist, {
      dealId: deal.id,
      decision: 'advance',
      callNotes: 'unapproved direct call',
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapprovedReport.data as ExecutedShape;
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired', unapprovedData?.approvalRequired === true);
    const afterUnapproved = await getDeal(deal.id);
    assert('deal stage UNCHANGED after unapproved run (still "proposal")', afterUnapproved?.stage === 'proposal');

    // ── Run 1: advance (APPROVED) ────────────────────────────────────────────
    console.log('\n2) ADVANCE run (proposal → negotiation)…');
    const advanceReport = await runExecuteClose(specialist, {
      dealId: deal.id,
      decision: 'advance',
      callNotes: 'agreed terms',
      viaApprovedMissionStep: true,
    });
    const advanceData = advanceReport.data as ExecutedShape;

    assert('advance report status COMPLETED', advanceReport.status === 'COMPLETED');
    assert('advance report authored by DEAL_CLOSER', advanceReport.agentId === 'DEAL_CLOSER');
    assert('advance data.executed.dealMoved === true', advanceData?.executed?.dealMoved === true);

    const afterAdvance = await getDeal(deal.id);
    assert('deal stage is now "negotiation"', afterAdvance?.stage === 'negotiation');

    const activitiesAfterAdvance = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 20 });
    const advanceActivity = activitiesAfterAdvance.data.find((a) => a.createdBy === 'DEAL_CLOSER');
    assert('an activity authored by DEAL_CLOSER exists on the deal', Boolean(advanceActivity));

    // ── Run 2: won ──────────────────────────────────────────────────────────
    console.log('\n3) WON run (negotiation → closed_won)…');
    const wonReport = await runExecuteClose(specialist, {
      dealId: deal.id,
      decision: 'won',
      callNotes: 'signed the contract',
      viaApprovedMissionStep: true,
    });
    assert('won report status COMPLETED', wonReport.status === 'COMPLETED');

    const afterWon = await getDeal(deal.id);
    assert('deal stage is now "closed_won"', afterWon?.stage === 'closed_won');

    // ── Run 3: idempotency on a closed deal ─────────────────────────────────
    console.log('\n4) IDEMPOTENCY run (execute_close on an already-closed deal)…');
    const idempReport = await runExecuteClose(specialist, {
      dealId: deal.id,
      decision: 'advance',
      callNotes: 'should be rejected',
      viaApprovedMissionStep: true,
    });
    assert('idempotency report status FAILED', idempReport.status === 'FAILED');

    const afterIdemp = await getDeal(deal.id);
    assert('deal stage unchanged (still closed_won)', afterIdemp?.stage === 'closed_won');
  } finally {
    // ── Cleanup: delete activities first (deal delete refuses if linked), then the deal ──
    console.log('\n5) Cleaning up…');
    const leftover = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 50 });
    for (const a of leftover.data) {
      await deleteActivity(a.id);
    }
    try {
      await deleteDeal(deal.id);
      console.log('   deal + activities deleted');
    } catch (e) {
      console.warn('   cleanup warning:', e instanceof Error ? e.message : String(e));
    }
  }

  if (failures === 0) {
    console.log('\nPASS ✅ — Deal Closer executor: fails closed without approval, advances stage, logs the call, marks won, refuses closed deals.');
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
