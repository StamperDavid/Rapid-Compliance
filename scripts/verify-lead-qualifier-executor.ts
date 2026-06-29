/**
 * Real-path proof that the Lead Qualifier is now an EXECUTOR: it records a real
 * qualification decision on a CRM lead (status change + activity log), maps each
 * decision to the correct Lead.status, refuses an already-terminal lead, AND
 * fails closed without operator approval.
 *
 * Drives the LeadQualifierSpecialist DIRECTLY (the manager `RevenueDirector`
 * can't be imported under tsx — its module graph pulls a `server-only`-marked
 * coordinator). The hands + the approval gate both live in the specialist, so
 * this proves the safety-critical behavior end-to-end. The thin manager/Jasper
 * hop (which only threads `viaApprovedMissionStep === true` down to this
 * payload, and is set true ONLY by the mission step-runner for an
 * operator-approved step) is verified by code review.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-lead-qualifier-executor.ts
 *
 * NOTE: hits OpenRouter (the Lead Qualifier authors the activity note via its
 * Golden Master) + real Firestore. Seed the GM first:
 *   node scripts/seed-lead-qualifier-gm.js
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { AgentMessage, AgentReport } from '@/lib/agents/types';

interface ExecutedShape {
  rationale?: string;
  mutated?: boolean;
  approvalRequired?: boolean;
  executed?: {
    leadId: string;
    previousStatus: string;
    newStatus: string;
    activityId: string | null;
    leadUpdated: boolean;
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

async function runRecordQualification(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_recqual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'REVENUE_DIRECTOR',
    to: 'LEAD_QUALIFIER',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'record_qualification', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

async function main(): Promise<void> {
  const { createLead, getLead, updateLead, deleteLead } = await import('@/lib/crm/lead-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { LeadQualifierSpecialist } = await import('@/lib/agents/sales/qualifier/specialist');

  const specialist = new LeadQualifierSpecialist();
  await specialist.initialize();

  console.log('1) Creating a throwaway lead at status "new"…');
  const lead = await createLead(
    {
      firstName: 'Verify',
      lastName: `Qualifier ${Date.now()}`,
      email: `verify-qualifier-${Date.now()}@example.com`,
      company: 'Verify Co',
      title: 'VP Sales',
      status: 'new',
      source: 'verify-script',
    },
    { autoEnrich: false, skipDuplicateCheck: true, useAdminSdk: true },
  );
  console.log('   lead id:', lead.id, '| status:', lead.status);

  try {
    // ── Run 0: APPROVAL GATE — an UNAPPROVED record_qualification must NOT mutate ──
    console.log('\n2a) UNAPPROVED run (no operator approval → must NOT mutate)…');
    const unapprovedReport = await runRecordQualification(specialist, {
      leadId: lead.id,
      decision: 'qualified',
      callNotes: 'unapproved direct call',
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapprovedReport.data as ExecutedShape;
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired', unapprovedData?.approvalRequired === true);
    const afterUnapproved = await getLead(lead.id, { useAdminSdk: true });
    assert('lead status UNCHANGED after unapproved run (still "new")', afterUnapproved?.status === 'new');

    // ── Run 1: qualified (APPROVED) → status 'qualified' + activity ──────────
    console.log('\n2) QUALIFIED run (new → qualified)…');
    const qualifiedReport = await runRecordQualification(specialist, {
      leadId: lead.id,
      decision: 'qualified',
      score: 82,
      callNotes: 'budget confirmed, decision-maker, buying this quarter',
      viaApprovedMissionStep: true,
    });
    const qualifiedData = qualifiedReport.data as ExecutedShape;

    assert('qualified report status COMPLETED', qualifiedReport.status === 'COMPLETED');
    assert('qualified report authored by LEAD_QUALIFIER', qualifiedReport.agentId === 'LEAD_QUALIFIER');
    assert('qualified data.executed.leadUpdated === true', qualifiedData?.executed?.leadUpdated === true);

    const afterQualified = await getLead(lead.id, { useAdminSdk: true });
    assert('lead status is now "qualified"', afterQualified?.status === 'qualified');

    const activitiesAfterQualified = await getActivities(
      { entityType: 'lead', entityId: lead.id },
      { pageSize: 20 },
    );
    const qualActivity = activitiesAfterQualified.data.find(
      (a) => a.createdBy === 'LEAD_QUALIFIER' && a.type === 'lead_status_changed',
    );
    assert('a lead_status_changed activity authored by LEAD_QUALIFIER exists', Boolean(qualActivity));

    // ── Run 2: disqualified → status 'lost' ──────────────────────────────────
    // Reset to a non-terminal status first so the decision can land.
    console.log('\n3) DISQUALIFIED run (→ lost)…');
    await updateLead(lead.id, { status: 'contacted' }, { useAdminSdk: true });
    const disqualReport = await runRecordQualification(specialist, {
      leadId: lead.id,
      decision: 'disqualified',
      callNotes: 'no budget this fiscal year, wrong ICP',
      viaApprovedMissionStep: true,
    });
    assert('disqualified report status COMPLETED', disqualReport.status === 'COMPLETED');
    const afterDisqual = await getLead(lead.id, { useAdminSdk: true });
    assert('lead status is now "lost" (disqualified → lost)', afterDisqual?.status === 'lost');

    // ── Run 3: nurture → status 'contacted' ──────────────────────────────────
    // Reset off the terminal 'lost' so the nurture decision can land.
    console.log('\n4) NURTURE run (→ contacted)…');
    await updateLead(lead.id, { status: 'new' }, { useAdminSdk: true });
    const nurtureReport = await runRecordQualification(specialist, {
      leadId: lead.id,
      decision: 'nurture',
      callNotes: 'interested but not ready until next quarter',
      viaApprovedMissionStep: true,
    });
    assert('nurture report status COMPLETED', nurtureReport.status === 'COMPLETED');
    const afterNurture = await getLead(lead.id, { useAdminSdk: true });
    assert('lead status is now "contacted" (nurture → contacted)', afterNurture?.status === 'contacted');

    // ── Run 4: terminal guard — a 'converted' lead is rejected unchanged ──────
    console.log('\n5) TERMINAL GUARD run (record_qualification on a converted lead)…');
    await updateLead(lead.id, { status: 'converted' }, { useAdminSdk: true });
    const terminalReport = await runRecordQualification(specialist, {
      leadId: lead.id,
      decision: 'qualified',
      callNotes: 'should be rejected',
      viaApprovedMissionStep: true,
    });
    assert('terminal-guard report status FAILED', terminalReport.status === 'FAILED');
    const afterTerminal = await getLead(lead.id, { useAdminSdk: true });
    assert('lead status unchanged (still converted)', afterTerminal?.status === 'converted');
  } finally {
    // ── Cleanup: delete activities first, then the lead ──
    console.log('\n6) Cleaning up…');
    const leftover = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 50 });
    for (const a of leftover.data) {
      await deleteActivity(a.id);
    }
    try {
      await deleteLead(lead.id);
      console.log('   lead + activities deleted');
    } catch (e) {
      console.warn('   cleanup warning:', e instanceof Error ? e.message : String(e));
    }
  }

  if (failures === 0) {
    console.log('\nPASS ✅ — Lead Qualifier executor: fails closed without approval, records qualification, maps decision→status, logs the call, refuses terminal leads.');
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
