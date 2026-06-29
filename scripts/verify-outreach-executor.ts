/**
 * Real-path proof that the Sales Outreach Specialist is now an EXECUTOR for the
 * log_outreach_touch action: it logs an outbound outreach touch as a CRM
 * activity and bumps a brand-new lead `new → contacted`, NEVER downgrades a more
 * advanced lead, refuses a terminal lead, AND fails closed without operator
 * approval.
 *
 * SCOPE NOTE: this action LOGS the touch + bumps the lead status. It does NOT
 * send email/SMS/DMs — delivery belongs to the Outreach department's Email / SMS
 * specialists. This proof asserts the log + status behavior only.
 *
 * Drives the OutreachSpecialist DIRECTLY (the manager `RevenueDirector` can't be
 * imported under tsx — its module graph pulls a `server-only`-marked
 * coordinator). The hands + the approval gate both live in the specialist, so
 * this proves the safety-critical behavior end-to-end. The thin manager/Jasper
 * hop (which only threads `viaApprovedMissionStep === true` down to this payload,
 * and is set true ONLY by the mission step-runner for an operator-approved step)
 * is verified by code review.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-outreach-executor.ts
 *
 * NOTE: hits OpenRouter (the specialist authors the activity note via its Golden
 * Master) + real Firestore. Seed the GM first:
 *   node scripts/seed-outreach-specialist-gm.js --force
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

async function runLogTouch(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_touch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'REVENUE_DIRECTOR',
    to: 'OUTREACH_SPECIALIST',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'log_outreach_touch', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

async function main(): Promise<void> {
  const { createLead, getLead, deleteLead, updateLead } = await import('@/lib/crm/lead-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { OutreachSpecialist } = await import('@/lib/agents/sales/outreach/specialist');

  const specialist = new OutreachSpecialist();
  await specialist.initialize();

  // Skip auto-enrichment so the lead lands at exactly status 'new'.
  console.log('1) Creating a lead at status "new"…');
  const lead = await createLead(
    {
      firstName: 'Verify',
      lastName: 'Outreach',
      email: `verify-outreach-${Date.now()}@example.com`,
      company: 'Verify Co',
      status: 'new',
      source: 'verify-script',
    },
    { autoEnrich: false, useAdminSdk: true },
  );
  console.log('   lead id:', lead.id, '| status:', lead.status);

  // A second throwaway lead used for the no-downgrade + terminal cases.
  console.log('2) Creating a second lead (will be set to "qualified")…');
  const qualifiedLead = await createLead(
    {
      firstName: 'Verify',
      lastName: 'Qualified',
      email: `verify-qualified-${Date.now()}@example.com`,
      company: 'Verify Co',
      status: 'new',
      source: 'verify-script',
    },
    { autoEnrich: false, useAdminSdk: true },
  );
  await updateLead(qualifiedLead.id, { status: 'qualified' }, { useAdminSdk: true });
  console.log('   lead id:', qualifiedLead.id, '| status: qualified');

  const lostLeadId = qualifiedLead.id; // reused after we drive it terminal at the end

  try {
    // ── Case 1: APPROVAL GATE — UNAPPROVED touch must NOT mutate ──────────────
    console.log('\n3) UNAPPROVED run (no operator approval → must NOT mutate)…');
    const unapprovedReport = await runLogTouch(specialist, {
      leadId: lead.id,
      channel: 'email',
      touchSummary: 'unapproved direct call',
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapprovedReport.data as ExecutedShape;
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired', unapprovedData?.approvalRequired === true);
    const afterUnapproved = await getLead(lead.id, { useAdminSdk: true });
    assert('lead status UNCHANGED after unapproved run (still "new")', afterUnapproved?.status === 'new');
    const actsAfterUnapproved = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
    const outreachActUnapproved = actsAfterUnapproved.data.find((a) => a.createdBy === 'OUTREACH_SPECIALIST');
    assert('NO activity authored by OUTREACH_SPECIALIST after unapproved run', !outreachActUnapproved);

    // ── Case 2: APPROVED touch on a 'new' lead → 'contacted' + activity ──────
    console.log('\n4) APPROVED run (new → contacted, channel=call)…');
    const callReport = await runLogTouch(specialist, {
      leadId: lead.id,
      channel: 'call',
      callNotes: 'spoke with the prospect, agreed to a follow-up',
      viaApprovedMissionStep: true,
    });
    const callData = callReport.data as ExecutedShape;
    assert('approved run status COMPLETED', callReport.status === 'COMPLETED');
    assert('approved run authored by OUTREACH_SPECIALIST', callReport.agentId === 'OUTREACH_SPECIALIST');
    assert('approved run leadUpdated === true', callData?.executed?.leadUpdated === true);
    assert('approved run newStatus === "contacted"', callData?.executed?.newStatus === 'contacted');

    const afterCall = await getLead(lead.id, { useAdminSdk: true });
    assert('lead status is now "contacted"', afterCall?.status === 'contacted');

    const actsAfterCall = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
    const callActivity = actsAfterCall.data.find((a) => a.createdBy === 'OUTREACH_SPECIALIST');
    assert('an activity authored by OUTREACH_SPECIALIST exists on the lead', Boolean(callActivity));
    assert("activity type is 'call_made' (channel=call mapped in code)", callActivity?.type === 'call_made');
    assert("activity direction is 'outbound'", callActivity?.direction === 'outbound');

    // ── Case 3: NO-DOWNGRADE — touch on a 'qualified' lead keeps status ──────
    console.log('\n5) NO-DOWNGRADE run (qualified lead, channel=email)…');
    const qualReport = await runLogTouch(specialist, {
      leadId: qualifiedLead.id,
      channel: 'email',
      touchSummary: 'sent a tailored follow-up',
      viaApprovedMissionStep: true,
    });
    const qualData = qualReport.data as ExecutedShape;
    assert('no-downgrade run status COMPLETED', qualReport.status === 'COMPLETED');
    assert('no-downgrade run leadUpdated === false', qualData?.executed?.leadUpdated === false);
    assert('no-downgrade run newStatus stays "qualified"', qualData?.executed?.newStatus === 'qualified');

    const afterQual = await getLead(qualifiedLead.id, { useAdminSdk: true });
    assert('lead status STILL "qualified" (never downgraded)', afterQual?.status === 'qualified');

    const actsAfterQual = await getActivities({ entityType: 'lead', entityId: qualifiedLead.id }, { pageSize: 20 });
    const qualActivity = actsAfterQual.data.find((a) => a.createdBy === 'OUTREACH_SPECIALIST');
    assert('an activity was still written for the qualified lead', Boolean(qualActivity));
    assert("qualified-lead activity type is 'email_sent' (channel=email mapped in code)", qualActivity?.type === 'email_sent');

    // ── Case 4: TERMINAL GUARD — touch on a 'lost' lead → FAILED + no write ──
    console.log('\n6) TERMINAL GUARD run (lead set to "lost")…');
    await updateLead(lostLeadId, { status: 'lost' }, { useAdminSdk: true });
    const actsBeforeTerminal = await getActivities({ entityType: 'lead', entityId: lostLeadId }, { pageSize: 50 });
    const countBeforeTerminal = actsBeforeTerminal.data.filter((a) => a.createdBy === 'OUTREACH_SPECIALIST').length;

    const terminalReport = await runLogTouch(specialist, {
      leadId: lostLeadId,
      channel: 'other',
      touchSummary: 'should be rejected',
      viaApprovedMissionStep: true,
    });
    assert('terminal run status FAILED', terminalReport.status === 'FAILED');

    const afterTerminal = await getLead(lostLeadId, { useAdminSdk: true });
    assert('lead status unchanged (still "lost")', afterTerminal?.status === 'lost');

    const actsAfterTerminal = await getActivities({ entityType: 'lead', entityId: lostLeadId }, { pageSize: 50 });
    const countAfterTerminal = actsAfterTerminal.data.filter((a) => a.createdBy === 'OUTREACH_SPECIALIST').length;
    assert('NO new activity written for the terminal lead', countAfterTerminal === countBeforeTerminal);
  } finally {
    // ── Cleanup: delete activities first, then the leads ──
    console.log('\n7) Cleaning up…');
    for (const id of [lead.id, qualifiedLead.id]) {
      const leftover = await getActivities({ entityType: 'lead', entityId: id }, { pageSize: 50 });
      for (const a of leftover.data) {
        await deleteActivity(a.id);
      }
      try {
        await deleteLead(id);
      } catch (e) {
        console.warn(`   cleanup warning for ${id}:`, e instanceof Error ? e.message : String(e));
      }
    }
    console.log('   leads + activities deleted');
  }

  if (failures === 0) {
    console.log('\nPASS ✅ — Outreach executor: fails closed without approval, logs the touch, bumps new→contacted, never downgrades qualified, refuses terminal leads.');
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
