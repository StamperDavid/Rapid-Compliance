/**
 * Task #45 — delegate_to_outreach end-to-end smoke test
 *
 * Verifies the full flow that the Jasper delegate_to_outreach handler now
 * exercises after the rewire:
 *   1. Instantiate OutreachManager + initialize
 *   2. Build a Jasper-shaped payload (intent=SEND_EMAIL/SEND_SMS,
 *      action=compose_email/compose_sms, ComposeRequest fields, lead)
 *   3. Call manager.execute() with that payload
 *   4. Assert the result is status=COMPLETED with real composed content
 *      (subjectLine + bodyPlainText for email, primaryMessage +
 *      complianceFooter for SMS)
 *
 * If the manager is still dispatching the dead `send_email`/`send_sms`
 * action names, the rebuilt specialists will reject with "does not support
 * action" and this script will fail loudly. Conversely, a clean PASS proves
 * the wiring change actually works end-to-end at the LLM layer.
 *
 * Usage:
 *   npx tsx scripts/smoke-test-outreach-task45.ts
 *   npx tsx scripts/smoke-test-outreach-task45.ts --channel=email
 *   npx tsx scripts/smoke-test-outreach-task45.ts --channel=sms
 */

import { OutreachManager } from '../src/lib/agents/outreach/manager';
import type { AgentMessage } from '../src/lib/agents/types';

type Channel = 'email' | 'sms' | 'both';

function parseFlags(): { channel: Channel } {
  const argv = process.argv.slice(2);
  let channel: Channel = 'both';
  for (const arg of argv) {
    if (arg.startsWith('--channel=')) {
      const v = arg.slice('--channel='.length);
      if (v === 'email' || v === 'sms' || v === 'both') {
        channel = v;
      } else {
        console.error(`Unknown channel: ${v}`);
        process.exit(1);
      }
    }
  }
  return { channel };
}

const SYNTHETIC_LEAD = {
  leadId: 'smoke_test_lead_001',
  firstName: 'Avery',
  lastName: 'Mitchell',
  email: 'avery.mitchell+smoketest@example.com',
  phone: '+15551234567',
  company: 'NorthStar Logistics',
  role: 'VP of Sales Operations',
  industry: 'B2B Logistics SaaS',
  painPoints: [
    'cold outbound is consuming SDR bandwidth without producing meetings',
    'tooling stack is bloated and not generating compounding signal',
  ],
};

const COLD_OUTREACH_BRIEF =
  'First-touch cold outreach to a Sales Ops VP at a logistics SaaS who has been burned by ' +
  'cold-outreach agencies before. Earn a single reply or 15-minute call. Establish in the first ' +
  'two sentences that we are NOT another agency — we pair every client with a real human team ' +
  'and run their outbound for them. Pricing is month-to-month with a 30-day results guarantee.';

const hr = '═══════════════════════════════════════════════════════════════';

function fail(step: string, err: unknown): never {
  console.error(`\n✗ FAILED: ${step} — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

function buildJasperShapedPayload(channel: 'email' | 'sms'): Record<string, unknown> {
  const intent: 'SEND_EMAIL' | 'SEND_SMS' = channel === 'email' ? 'SEND_EMAIL' : 'SEND_SMS';
  const action: 'compose_email' | 'compose_sms' = channel === 'email' ? 'compose_email' : 'compose_sms';
  const audienceParts: string[] = [
    SYNTHETIC_LEAD.firstName,
    `role: ${SYNTHETIC_LEAD.role}`,
    `at ${SYNTHETIC_LEAD.company}`,
    `industry: ${SYNTHETIC_LEAD.industry}`,
  ];
  return {
    intent,
    action,
    campaignName: 'cold_outreach',
    targetAudience: audienceParts.join(', '),
    goal: `Compose a single ${channel === 'sms' ? 'SMS' : 'email'} as part of a cold_outreach to ${SYNTHETIC_LEAD.firstName}`,
    brief: COLD_OUTREACH_BRIEF,
    lead: SYNTHETIC_LEAD,
  };
}

interface RunResult {
  channel: 'email' | 'sms';
  status: string;
  durationMs: number;
  errors: readonly string[];
  composed: Record<string, unknown> | null;
}

async function runChannel(manager: OutreachManager, channel: 'email' | 'sms'): Promise<RunResult> {
  console.log(`\n${hr}\nCHANNEL: ${channel.toUpperCase()}\n${hr}`);
  console.log(`  → Building Jasper-shaped payload (intent=${channel === 'email' ? 'SEND_EMAIL' : 'SEND_SMS'}, action=${channel === 'email' ? 'compose_email' : 'compose_sms'})`);

  const payload = buildJasperShapedPayload(channel);
  const message: AgentMessage = {
    id: `smoke_${channel}_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'OUTREACH_MANAGER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload,
    requiresResponse: true,
    traceId: `trace_smoke_${Date.now()}`,
  };

  const start = Date.now();
  const report = await manager.execute(message);
  const durationMs = Date.now() - start;
  console.log(`  → Manager returned in ${durationMs}ms with status=${report.status}`);

  if (report.status !== 'COMPLETED') {
    console.log(`  ✗ Errors: ${(report.errors ?? []).join(' | ')}`);
    return { channel, status: report.status, durationMs, errors: report.errors ?? [], composed: null };
  }

  const composed = (report.data ?? null) as Record<string, unknown> | null;
  if (!composed) {
    console.log('  ✗ COMPLETED status but report.data is null');
    return { channel, status: 'COMPLETED_BUT_EMPTY', durationMs, errors: ['no data'], composed: null };
  }

  if (channel === 'email') {
    const subjectLine = composed.subjectLine as string | undefined;
    const bodyPlainText = composed.bodyPlainText as string | undefined;
    const emailPurpose = composed.emailPurpose as string | undefined;
    console.log(`  ✓ emailPurpose: ${emailPurpose ?? '(missing)'}`);
    console.log(`  ✓ subjectLine: ${subjectLine ? `"${subjectLine}"` : '(missing)'}`);
    console.log(`  ✓ bodyPlainText length: ${bodyPlainText?.length ?? 0} chars`);
    if (bodyPlainText && bodyPlainText.length > 0) {
      console.log(`  ✓ bodyPlainText preview: "${bodyPlainText.slice(0, 120).replace(/\n/g, ' ')}…"`);
    }
    if (!subjectLine || !bodyPlainText) {
      console.log('  ✗ Missing one of: subjectLine, bodyPlainText');
      return { channel, status: 'COMPLETED_MISSING_FIELDS', durationMs, errors: ['missing required fields'], composed };
    }
  } else {
    const primaryMessage = composed.primaryMessage as string | undefined;
    const complianceFooter = composed.complianceFooter as string | undefined;
    const charCount = composed.charCount as number | undefined;
    const segmentStrategy = composed.segmentStrategy as string | undefined;
    const smsPurpose = composed.smsPurpose as string | undefined;
    console.log(`  ✓ smsPurpose: ${smsPurpose ?? '(missing)'}`);
    console.log(`  ✓ segmentStrategy: ${segmentStrategy ?? '(missing)'}`);
    console.log(`  ✓ charCount: ${charCount ?? '(missing)'}`);
    console.log(`  ✓ primaryMessage: ${primaryMessage ? `"${primaryMessage}"` : '(missing)'}`);
    console.log(`  ✓ complianceFooter: ${complianceFooter ?? '(missing)'}`);
    if (!primaryMessage || !complianceFooter) {
      console.log('  ✗ Missing one of: primaryMessage, complianceFooter');
      return { channel, status: 'COMPLETED_MISSING_FIELDS', durationMs, errors: ['missing required fields'], composed };
    }
  }

  return { channel, status: 'COMPLETED', durationMs, errors: [], composed };
}

async function main(): Promise<void> {
  const { channel } = parseFlags();
  const overallStart = Date.now();

  console.log(`\n${hr}\nTASK #45 — delegate_to_outreach SMOKE TEST\n${hr}`);
  console.log(`  Channel selection: ${channel}`);

  const manager = new OutreachManager();
  try {
    await manager.initialize();
  } catch (err) {
    fail('OutreachManager.initialize()', err);
  }
  console.log('  ✓ OutreachManager initialized');

  const results: RunResult[] = [];
  if (channel === 'email' || channel === 'both') {
    try {
      results.push(await runChannel(manager, 'email'));
    } catch (err) {
      fail('Email channel run', err);
    }
  }
  if (channel === 'sms' || channel === 'both') {
    try {
      results.push(await runChannel(manager, 'sms'));
    } catch (err) {
      fail('SMS channel run', err);
    }
  }

  console.log(`\n${hr}\nSUMMARY\n${hr}`);
  for (const r of results) {
    const flag = r.status === 'COMPLETED' ? '✓' : '✗';
    console.log(`  ${flag} ${r.channel.toUpperCase()}: ${r.status} (${r.durationMs}ms)`);
    if (r.errors.length > 0) {
      console.log(`      errors: ${r.errors.join(' | ')}`);
    }
  }
  const allPassed = results.every((r) => r.status === 'COMPLETED');
  const totalMs = Date.now() - overallStart;
  console.log(`\n  Overall: ${allPassed ? '✓ PASS' : '✗ FAIL'} in ${totalMs}ms`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  fail('main', err);
});
