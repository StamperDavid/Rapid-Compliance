/**
 * Real-path proof that the Objection Handler is now an EXECUTOR: it logs a real
 * objection onto a deal or lead timeline as a single `note_added` activity,
 * refuses a non-existent record, AND fails closed without operator approval.
 *
 * Drives the ObjectionHandlerSpecialist DIRECTLY (the manager `RevenueDirector`
 * can't be imported under tsx — its module graph pulls a `server-only`-marked
 * coordinator). The hands + the approval gate both live in the specialist, so
 * this proves the safety-critical behavior end-to-end. The thin manager/Jasper
 * hop (which only threads `viaApprovedMissionStep === true` down to this
 * payload, and is set true ONLY by the mission step-runner for an
 * operator-approved step) is verified by code review.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-objection-handler-executor.ts
 *
 * The react-server condition is REQUIRED because `getDeal` (and the activity
 * service) pull modules marked `server-only`; without it the import throws.
 *
 * NOTE: hits OpenRouter (the Objection Handler authors the timeline note via its
 * Golden Master) + real Firestore. Seed the GM first:
 * node scripts/seed-objection-handler-gm.js --force
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { AgentMessage, AgentReport } from '@/lib/agents/types';

interface ExecutedShape {
  rationale?: string;
  mutated?: boolean;
  approvalRequired?: boolean;
  executed?: {
    entityType: string;
    entityId: string;
    activityId: string;
    logged: boolean;
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

async function runLogObjection(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_logobj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'REVENUE_DIRECTOR',
    to: 'OBJ_HANDLER',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'log_objection', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

async function main(): Promise<void> {
  const { createDeal, deleteDeal } = await import('@/lib/crm/deal-service');
  const { createLead, deleteLead } = await import('@/lib/crm/lead-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { ObjectionHandlerSpecialist } = await import('@/lib/agents/sales/objection-handler/specialist');

  const specialist = new ObjectionHandlerSpecialist();
  await specialist.initialize();

  console.log('1) Creating a throwaway deal at stage "proposal"…');
  const deal = await createDeal({
    name: `VERIFY log_objection ${Date.now()}`,
    company: 'Verify Co',
    companyName: 'Verify Co',
    value: 25000,
    stage: 'proposal',
    probability: 40,
  });
  console.log('   deal id:', deal.id);

  console.log('2) Creating a throwaway lead…');
  const lead = await createLead(
    {
      firstName: 'Verify',
      lastName: 'Prospect',
      email: `verify-objection-${Date.now()}@example.com`,
      company: 'Verify Co',
      status: 'new',
    },
    { autoEnrich: false, skipDuplicateCheck: true, useAdminSdk: true },
  );
  console.log('   lead id:', lead.id);

  try {
    // ── Run 1: APPROVAL GATE — an UNAPPROVED log_objection must NOT write ─────
    console.log('\n3) UNAPPROVED run (no operator approval → must NOT write)…');
    const activitiesBefore = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 50 });
    const countBefore = activitiesBefore.data.length;

    const unapprovedReport = await runLogObjection(specialist, {
      entityType: 'deal',
      entityId: deal.id,
      rawObjection: 'Your pricing is way too high for what we get.',
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapprovedReport.data as ExecutedShape;
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired', unapprovedData?.approvalRequired === true);

    const activitiesAfterUnapproved = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 50 });
    assert('NO new activity written by the unapproved run', activitiesAfterUnapproved.data.length === countBefore);

    // ── Run 2: APPROVED log on a DEAL ────────────────────────────────────────
    console.log('\n4) APPROVED run on a DEAL…');
    const dealReport = await runLogObjection(specialist, {
      entityType: 'deal',
      entityId: deal.id,
      rawObjection: 'Your pricing is way too high for what we get.',
      recommendedRebuttal: 'Reframe on total cost of ownership vs. the manual process they run today.',
      callNotes: 'CFO pushed back on the annual number on the renewal call.',
      viaApprovedMissionStep: true,
    });
    const dealData = dealReport.data as ExecutedShape;

    assert('deal log report status COMPLETED', dealReport.status === 'COMPLETED');
    assert('deal log report authored by OBJ_HANDLER', dealReport.agentId === 'OBJ_HANDLER');
    assert('deal log data.executed.logged === true', dealData?.executed?.logged === true);

    const dealActivities = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 50 });
    const newDealNotes = dealActivities.data.filter(
      (a) => a.type === 'note_added' && a.createdBy === 'OBJ_HANDLER',
    );
    assert('exactly one new note_added activity on the deal', newDealNotes.length === 1);
    const dealNote = newDealNotes[0];
    assert(
      'deal note relatedTo[0] points at the deal',
      Boolean(dealNote) &&
        dealNote.relatedTo[0]?.entityType === 'deal' &&
        dealNote.relatedTo[0]?.entityId === deal.id,
    );

    // ── Run 3: APPROVED log on a LEAD ────────────────────────────────────────
    console.log('\n5) APPROVED run on a LEAD…');
    const leadReport = await runLogObjection(specialist, {
      entityType: 'lead',
      entityId: lead.id,
      rawObjection: 'I need to check with my manager before we go any further.',
      callNotes: 'Champion is not the economic buyer.',
      viaApprovedMissionStep: true,
    });
    const leadData = leadReport.data as ExecutedShape;
    assert('lead log report status COMPLETED', leadReport.status === 'COMPLETED');
    assert('lead log data.executed.logged === true', leadData?.executed?.logged === true);

    const leadActivities = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 50 });
    const newLeadNotes = leadActivities.data.filter(
      (a) => a.type === 'note_added' && a.createdBy === 'OBJ_HANDLER',
    );
    assert('exactly one new note_added activity on the lead', newLeadNotes.length === 1);
    assert(
      'lead note relatedTo[0] points at the lead',
      newLeadNotes.length === 1 &&
        newLeadNotes[0].relatedTo[0]?.entityType === 'lead' &&
        newLeadNotes[0].relatedTo[0]?.entityId === lead.id,
    );

    // ── Run 4: bad id → FAILED + no write ────────────────────────────────────
    console.log('\n6) BAD ID run (non-existent deal → FAILED, no write)…');
    const badId = `deal-does-not-exist-${Date.now()}`;
    const badReport = await runLogObjection(specialist, {
      entityType: 'deal',
      entityId: badId,
      rawObjection: 'This should never get written.',
      viaApprovedMissionStep: true,
    });
    assert('bad-id report status FAILED', badReport.status === 'FAILED');
    const badActivities = await getActivities({ entityType: 'deal', entityId: badId }, { pageSize: 50 });
    assert('NO activity written for the non-existent deal', badActivities.data.length === 0);
  } finally {
    // ── Cleanup: delete activities first (deal/lead delete refuses if linked) ──
    console.log('\n7) Cleaning up…');
    const dealLeftover = await getActivities({ entityType: 'deal', entityId: deal.id }, { pageSize: 50 });
    for (const a of dealLeftover.data) { await deleteActivity(a.id); }
    const leadLeftover = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 50 });
    for (const a of leadLeftover.data) { await deleteActivity(a.id); }
    try {
      await deleteDeal(deal.id);
      await deleteLead(lead.id);
      console.log('   deal + lead + activities deleted');
    } catch (e) {
      console.warn('   cleanup warning:', e instanceof Error ? e.message : String(e));
    }
  }

  if (failures === 0) {
    console.log('\nPASS ✅ — Objection Handler executor: fails closed without approval, logs an objection onto a deal AND a lead timeline, refuses a non-existent record.');
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
