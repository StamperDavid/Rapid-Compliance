/**
 * Real-path proof that the SMS Specialist is now an EXECUTOR: it fails closed
 * without operator approval, refuses to send when TCPA consent is missing, and
 * (opt-in) actually delivers an SMS via the canonical sms-service + logs an
 * 'sms_sent' activity on the lead's CRM timeline.
 *
 * Drives the SmsSpecialist DIRECTLY (same pattern as
 * scripts/verify-deal-closer-execute.ts — the OutreachManager pulls a
 * server-only module graph under tsx). The hands + the approval gate + the
 * TCPA gate all live in the specialist, so this proves the safety-critical
 * behavior end-to-end. The thin manager/Jasper hop (which only threads
 * viaApprovedMissionStep === true down to this payload) is verified by code
 * review.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-outreach-sms-send.ts
 *
 * DEFAULT (always, NO real send): a fail-closed assertion (no approval flag →
 * no send, approvalRequired) and a TCPA-blocked assertion (flag true but no
 * consent on file → FAILED, no send). Neither path hits the carrier.
 *
 * LIVE (opt-in, real send): guarded by OUTREACH_LIVE_SEND === '1'. Records
 * express-written consent for the test phone so TCPA passes, then sends a real
 * SMS to OUTREACH_TEST_PHONE (default +12088718552) and asserts COMPLETED +
 * smsSent + smsId + a logged sms_sent activity. Hits OpenRouter (the LLM
 * authors the timeline note) + Twilio + real Firestore. Seed the GM first:
 * node scripts/seed-sms-specialist-gm.js --force
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { AgentMessage, AgentReport } from '@/lib/agents/types';

interface SendSmsShape {
  rationale?: string;
  mutated?: boolean;
  approvalRequired?: boolean;
  toPhone?: string;
  executed?: {
    leadId: string;
    toPhone: string;
    smsId: string | undefined;
    activityId: string | null;
    smsSent: boolean;
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

async function runSendSms(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'OUTREACH_MANAGER',
    to: 'SMS_SPECIALIST',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'send_sms', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

async function main(): Promise<void> {
  const { createLead, deleteLead } = await import('@/lib/crm/lead-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { recordConsent } = await import('@/lib/compliance/tcpa-service');
  const { SmsSpecialist } = await import('@/lib/agents/outreach/sms/specialist');

  const specialist = new SmsSpecialist();
  await specialist.initialize();

  console.log('1) Creating a throwaway lead…');
  const lead = await createLead(
    {
      firstName: 'Verify',
      lastName: `SmsSend ${Date.now()}`,
      email: `verify-sms-${Date.now()}@example.test`,
      status: 'new',
    },
    { skipDuplicateCheck: true, useAdminSdk: true },
  );
  console.log('   lead id:', lead.id);

  // A phone that has NO consent on file (random unique digits) — for the TCPA
  // fail-closed assertion. We never send to this number.
  const noConsentPhone = `+1999${String(Date.now()).slice(-7)}`;

  try {
    // ── Run 1: APPROVAL GATE — no flag → must NOT send, approvalRequired ───────
    console.log('\n2) UNAPPROVED run (no operator approval → must NOT send)…');
    const unapproved = await runSendSms(specialist, {
      leadId: lead.id,
      toPhone: '+12085551234',
      leadName: 'Verify SmsSend',
      message: 'Hi Verify, quick question about your outbound stack — got 5 min this week?',
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapproved.data as SendSmsShape;
    assert('unapproved run report COMPLETED', unapproved.status === 'COMPLETED');
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired', unapprovedData?.approvalRequired === true);
    assert('unapproved run produced NO smsId', unapprovedData?.executed === undefined);

    let leftover = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
    assert(
      'unapproved run logged NO sms_sent activity',
      !leftover.data.some((a) => a.type === 'sms_sent'),
    );

    // ── Run 2: TCPA GATE — approved but no consent on file → FAILED, no send ──
    console.log('\n3) APPROVED-but-NO-CONSENT run (TCPA fail-closed → must NOT send)…');
    const blocked = await runSendSms(specialist, {
      leadId: lead.id,
      toPhone: noConsentPhone,
      leadName: 'Verify SmsSend',
      message: 'Hi Verify, quick question about your outbound stack — got 5 min this week?',
      viaApprovedMissionStep: true,
    });
    assert('TCPA-blocked run report FAILED', blocked.status === 'FAILED');

    leftover = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
    assert(
      'TCPA-blocked run logged NO sms_sent activity',
      !leftover.data.some((a) => a.type === 'sms_sent'),
    );

    // ── Run 3 (opt-in): LIVE real send ───────────────────────────────────────
    if (process.env.OUTREACH_LIVE_SEND === '1') {
      const testPhone = process.env.OUTREACH_TEST_PHONE ?? '+12088718552';
      console.log(`\n4) LIVE run (real send to ${testPhone})…`);

      // Make TCPA pass: record express-written consent for the test phone.
      await recordConsent(testPhone, 'sms', 'express_written', 'verify-script');

      const live = await runSendSms(specialist, {
        leadId: lead.id,
        toPhone: testPhone,
        leadName: 'Verify SmsSend',
        message: 'SalesVelocity verify: this is an automated test of the SMS executor.',
        campaignName: 'verify-outreach-sms-send',
        viaApprovedMissionStep: true,
      });
      const liveData = live.data as SendSmsShape;
      assert('LIVE run report COMPLETED', live.status === 'COMPLETED');
      assert('LIVE run executed.smsSent === true', liveData?.executed?.smsSent === true);
      assert('LIVE run produced a smsId', Boolean(liveData?.executed?.smsId));

      const after = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
      assert(
        'LIVE run logged an sms_sent activity authored by SMS_SPECIALIST',
        after.data.some((a) => a.type === 'sms_sent' && a.createdBy === 'SMS_SPECIALIST'),
      );
    } else {
      console.log('\n4) LIVE run SKIPPED (set OUTREACH_LIVE_SEND=1 to send a real SMS).');
    }
  } finally {
    // ── Cleanup: delete any activities on the lead, then the lead ────────────
    console.log('\n5) Cleaning up…');
    try {
      const leftover = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 50 });
      for (const a of leftover.data) {
        await deleteActivity(a.id);
      }
      await deleteLead(lead.id);
      console.log('   lead + activities deleted');
    } catch (e) {
      console.warn('   cleanup warning:', e instanceof Error ? e.message : String(e));
    }
  }

  if (failures === 0) {
    console.log('\nPASS ✅ — SMS executor: fails closed without approval, refuses send without TCPA consent, (opt-in) sends + logs.');
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
