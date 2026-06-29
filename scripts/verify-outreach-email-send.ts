/**
 * Real-path proof that the Outreach Email Specialist is an EXECUTOR for the
 * send_email action: it FAILS CLOSED without operator approval (no real email,
 * no email_sent activity), and — opt-in only — actually delivers a real email +
 * logs an email_sent activity when approved.
 *
 * Drives the EmailSpecialist DIRECTLY (the manager `OutreachManager` can't be
 * imported under tsx — its module graph pulls a `server-only`-marked
 * coordinator). The hands + the approval gate both live in the specialist, so
 * this proves the safety-critical behavior end-to-end. The thin manager/Jasper
 * hop (which only threads `viaApprovedMissionStep === true` down to this payload,
 * and is set true ONLY by the mission step-runner for an operator-approved step)
 * is verified by code review — mirrors scripts/verify-deal-closer-execute.ts.
 *
 *   DEFAULT (SAFE — no external send):
 *     NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-outreach-email-send.ts
 *
 *   LIVE (opt-in — actually sends a real email):
 *     OUTREACH_LIVE_SEND=1 OUTREACH_TEST_EMAIL=you@example.com \
 *       NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-outreach-email-send.ts
 *
 * NOTE: the LIVE path hits OpenRouter (the specialist authors the activity note
 * via its Golden Master), the email carrier (SendGrid), and real Firestore.
 * Seed the GM first: node scripts/seed-email-specialist-gm.js
 * The DEFAULT path performs NO external send and NO LLM call (the approval gate
 * is checked BEFORE any GM load / LLM call / carrier hit).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { AgentMessage, AgentReport } from '@/lib/agents/types';

interface SendEmailReportShape {
  rationale?: string;
  mutated?: boolean;
  approvalRequired?: boolean;
  leadId?: string;
  toEmail?: string;
  message?: string;
  executed?: {
    leadId: string;
    toEmail: string;
    emailId: string | undefined;
    activityId: string | null;
    provider: string | undefined;
    emailSent: boolean;
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

async function runSendEmail(
  specialist: { execute: (m: AgentMessage) => Promise<AgentReport> },
  fields: Record<string, unknown>,
): Promise<AgentReport> {
  const message: AgentMessage = {
    id: `verify_send_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    from: 'OUTREACH_MANAGER',
    to: 'EMAIL_SPECIALIST',
    type: 'COMMAND',
    priority: 'HIGH',
    payload: { action: 'send_email', ...fields },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };
  return specialist.execute(message);
}

async function main(): Promise<void> {
  const { createLead, deleteLead } = await import('@/lib/crm/lead-service');
  const { getActivities, deleteActivity } = await import('@/lib/crm/activity-service');
  const { EmailSpecialist } = await import('@/lib/agents/outreach/email/specialist');

  const specialist = new EmailSpecialist();
  await specialist.initialize();

  console.log('1) Creating a throwaway lead…');
  const lead = await createLead(
    {
      firstName: 'Verify',
      lastName: 'EmailSend',
      email: `verify-email-send-${Date.now()}@example.com`,
      company: 'Verify Co',
      status: 'new',
      source: 'verify-script',
    },
    { autoEnrich: false, useAdminSdk: true },
  );
  console.log('   lead id:', lead.id, '| email:', lead.email);

  const liveMode = process.env.OUTREACH_LIVE_SEND === '1';

  try {
    // ── DEFAULT (always): APPROVAL GATE — UNAPPROVED send must NOT deliver ────
    console.log('\n2) UNAPPROVED run (no operator approval → must NOT send)…');
    const unapprovedReport = await runSendEmail(specialist, {
      leadId: lead.id,
      toEmail: lead.email,
      leadName: 'Verify EmailSend',
      subject: 'verify: unapproved send must not deliver',
      bodyPlainText: 'This message must never actually be sent without operator approval.',
      campaignName: 'verify-email-send',
      // viaApprovedMissionStep deliberately omitted → fail closed
    });
    const unapprovedData = unapprovedReport.data as SendEmailReportShape;

    // The specialist returns a COMPLETED report carrying approvalRequired/mutated
    // guidance (no FAILED) — it deliberately does NOT throw, it refuses to send.
    assert('unapproved run did NOT mutate (mutated !== true)', unapprovedData?.mutated !== true);
    assert('unapproved run flagged approvalRequired === true', unapprovedData?.approvalRequired === true);
    assert('unapproved run produced NO emailId', unapprovedData?.executed?.emailId === undefined);

    const actsAfterUnapproved = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
    const sentActUnapproved = actsAfterUnapproved.data.find((a) => a.type === 'email_sent');
    assert('NO email_sent activity on the lead after unapproved run', !sentActUnapproved);

    // ── LIVE (opt-in): APPROVED send → real delivery + email_sent activity ────
    if (liveMode) {
      const toEmail = process.env.OUTREACH_TEST_EMAIL ?? 'dstamper@salesvelocity.ai';
      console.log(`\n3) LIVE APPROVED run (real send to ${toEmail})…`);
      const approvedReport = await runSendEmail(specialist, {
        leadId: lead.id,
        toEmail,
        leadName: 'Verify EmailSend',
        subject: `verify: approved real send ${Date.now()}`,
        bodyPlainText:
          'This is a verification email proving the Outreach Email Specialist send_email ' +
          'executor delivers a real email when (and only when) the operator approved the ' +
          'mission step. Safe to ignore.',
        campaignName: 'verify-email-send',
        viaApprovedMissionStep: true,
      });
      const approvedData = approvedReport.data as SendEmailReportShape;

      assert('approved run status COMPLETED', approvedReport.status === 'COMPLETED');
      assert('approved run authored by EMAIL_SPECIALIST', approvedReport.agentId === 'EMAIL_SPECIALIST');
      assert('approved run executed.emailSent === true', approvedData?.executed?.emailSent === true);
      assert('approved run produced an emailId', Boolean(approvedData?.executed?.emailId));

      const actsAfterApproved = await getActivities({ entityType: 'lead', entityId: lead.id }, { pageSize: 20 });
      const sentActivity = actsAfterApproved.data.find((a) => a.type === 'email_sent');
      assert('an email_sent activity linked to the lead exists', Boolean(sentActivity));
    } else {
      console.log('\n3) LIVE send SKIPPED (set OUTREACH_LIVE_SEND=1 to run the real-send path).');
    }
  } finally {
    // ── Cleanup: delete activities first (lead delete may refuse if linked), then the lead ──
    console.log('\n4) Cleaning up…');
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
        ? '\nPASS ✅ — Email send executor: fails closed without approval, AND delivers a real email + logs email_sent when approved.'
        : '\nPASS ✅ — Email send executor fails closed without approval (no send, no activity). Run with OUTREACH_LIVE_SEND=1 to prove the real-send path.',
    );
    process.exit(0);
  } else {
    console.error(`\nFAIL ❌ — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('FAIL ❌', e); process.exit(1); });
