/**
 * Real-path proof that the Voice Specialist is an EXECUTOR for the
 * place_call_execute action: it FAILS CLOSED without operator approval (no
 * real call, no call_made activity), refuses a no-consent number even when
 * approved, and — opt-in only — actually places a real call + logs a
 * `call_made` CRM activity when approved AND consent is on file.
 *
 * Drives the VoiceAiSpecialist DIRECTLY (the manager `OutreachManager` can't be
 * imported under tsx — its module graph pulls a `server-only`-marked
 * coordinator). The hands + the approval gate both live in the specialist, so
 * this proves the safety-critical behavior end-to-end. The thin manager/Jasper
 * hop (which only threads `viaApprovedMissionStep === true` down to this payload,
 * and is set true ONLY by the mission step-runner for an operator-approved step)
 * is verified by code review — mirrors scripts/verify-outreach-email-send.ts.
 *
 *   DEFAULT (SAFE — no real call):
 *     NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-outreach-voice-call.ts
 *
 *   LIVE (opt-in — actually RINGS a real phone):
 *     OUTREACH_LIVE_SEND=1 OUTREACH_TEST_PHONE=+1XXXXXXXXXX \
 *       NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-outreach-voice-call.ts
 *
 * NOTE: the LIVE path records TCPA consent, hits the configured voice provider
 * (real Twilio call — the phone RINGS), and real Firestore. The DEFAULT path
 * performs NO call and NO LLM call (the approval gate is checked BEFORE any
 * TCPA check / provider hit; this specialist is deterministic, no GM/LLM at all).
 * Twilio credentials/number come from Firestore — this script touches none of them.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { AgentMessage, AgentReport } from '@/lib/agents/types';

interface PlaceCallReportShape {
  approvalRequired?: boolean;
  mutated?: boolean;
  leadId?: string;
  toPhone?: string;
  callId?: string;
  message?: string;
  error?: string;
  executed?: {
    leadId: string;
    toPhone: string;
    callId: string;
    activityId: string | null;
    callPlaced: boolean;
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

async function runPlaceCall(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'OUTREACH_MANAGER',
    to: 'VOICE_AI_SPECIALIST',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'place_call_execute', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

async function main(): Promise<void> {
  const { createLead, deleteLead } = await import('@/lib/crm/lead-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { recordConsent } = await import('@/lib/compliance/tcpa-service');
  const { VoiceAiSpecialist } = await import('@/lib/agents/outreach/voice/specialist');

  const specialist = new VoiceAiSpecialist();
  await specialist.initialize();

  console.log('1) Creating a throwaway lead…');
  const lead = await createLead(
    {
      firstName: 'Verify',
      lastName: 'VoiceCall',
      email: `verify-voice-call-${Date.now()}@example.com`,
      phone: '+15555550100',
      company: 'Verify Co',
      status: 'new',
      source: 'verify-script',
    },
    { autoEnrich: false, useAdminSdk: true },
  );
  console.log('   lead id:', lead.id);

  // A number we have NOT recorded consent for — used for both the unapproved
  // gate test and the consent-blocked test.
  const noConsentPhone = '+15555550199';
  const liveMode = process.env.OUTREACH_LIVE_SEND === '1';

  try {
    // ── DEFAULT (always): APPROVAL GATE — UNAPPROVED call must NOT place ──────
    console.log('\n2) UNAPPROVED run (no operator approval → must NOT call)…');
    const unapprovedReport = await runPlaceCall(specialist, {
      leadId: lead.id,
      toPhone: noConsentPhone,
      leadName: 'Verify VoiceCall',
      goal: 'verify: unapproved call must not dial',
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapprovedReport.data as PlaceCallReportShape;

    // The specialist returns a COMPLETED report carrying approvalRequired/mutated
    // guidance (no FAILED) — it refuses to dial, no side effect.
    assert('unapproved run status COMPLETED', unapprovedReport.status === 'COMPLETED');
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired === true', unapprovedData?.approvalRequired === true);
    assert('unapproved run produced NO callId', unapprovedData?.callId === undefined);
    assert('unapproved run produced NO executed.callId', unapprovedData?.executed === undefined);

    const actsAfterUnapproved = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
    const madeActUnapproved = actsAfterUnapproved.data.find((a) => a.type === 'call_made');
    assert('NO call_made activity on the lead after unapproved run', !madeActUnapproved);

    // ── DEFAULT (always): TCPA-BLOCKED — approved BUT no consent → no call ────
    console.log('\n3) APPROVED but NO-CONSENT run (TCPA must block → no call)…');
    const blockedReport = await runPlaceCall(specialist, {
      leadId: lead.id,
      toPhone: noConsentPhone,
      leadName: 'Verify VoiceCall',
      goal: 'verify: no-consent call must be blocked',
      viaApprovedMissionStep: true,
    });
    const blockedData = blockedReport.data as PlaceCallReportShape;
    assert('no-consent run status FAILED', blockedReport.status === 'FAILED');
    assert('no-consent run produced NO callId', blockedData?.callId === undefined);

    const actsAfterBlocked = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
    const madeActBlocked = actsAfterBlocked.data.find((a) => a.type === 'call_made');
    assert('NO call_made activity on the lead after no-consent run', !madeActBlocked);

    // ── LIVE (opt-in): APPROVED + CONSENT → real call + call_made activity ────
    if (liveMode) {
      const testPhone = process.env.OUTREACH_TEST_PHONE ?? '+12088718552';
      console.log(`\n4) LIVE APPROVED run (records consent, then RINGS ${testPhone})…`);
      await recordConsent(testPhone, 'call', 'express_written', 'verify-script');

      const approvedReport = await runPlaceCall(specialist, {
        leadId: lead.id,
        toPhone: testPhone,
        leadName: 'Verify VoiceCall',
        goal: 'verify: approved real call',
        viaApprovedMissionStep: true,
      });
      const approvedData = approvedReport.data as PlaceCallReportShape;

      assert('approved run status COMPLETED', approvedReport.status === 'COMPLETED');
      assert('approved run authored by VOICE_AI_SPECIALIST', approvedReport.agentId === 'VOICE_AI_SPECIALIST');
      assert('approved run executed.callPlaced === true', approvedData?.executed?.callPlaced === true);
      assert('approved run produced a callId', Boolean(approvedData?.executed?.callId));

      const actsAfterApproved = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
      const madeActivity = actsAfterApproved.data.find((a) => a.type === 'call_made');
      assert('a call_made activity linked to the lead exists', Boolean(madeActivity));
    } else {
      console.log('\n4) LIVE call SKIPPED (set OUTREACH_LIVE_SEND=1 to RING a real phone).');
    }
  } finally {
    // ── Cleanup: delete activities first (lead delete may refuse if linked), then the lead ──
    console.log('\n5) Cleaning up…');
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
    console.log(
      liveMode
        ? '\nPASS ✅ — Voice place_call_execute executor: fails closed without approval, blocks no-consent, AND places a real call + logs call_made when approved + consented.'
        : '\nPASS ✅ — Voice place_call_execute executor fails closed without approval (no call, no activity) and blocks no-consent numbers. Run with OUTREACH_LIVE_SEND=1 to prove the real-call path.',
    );
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
