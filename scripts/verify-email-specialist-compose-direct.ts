/**
 * CREDENTIAL SMOKE TEST — direct specialist call, NOT product-path verification.
 *
 * What this DOES test:
 *   - EmailSpecialist.execute({action:'compose_outreach_sequence'}) loads its
 *     GM from Firestore and makes a real LLM call to produce a Zod-validated
 *     outreach sequence (subject / preview / body / cta / timing per email)
 *   - The specialist's schema contract is upheld in isolation
 *
 * What this does NOT test:
 *   - The product path through Jasper → OutreachManager → EmailSpecialist
 *     → Mission Control approval → send
 *   - Whether OutreachManager correctly delegates to EmailSpecialist when
 *     Jasper plans an outreach intent. This script calls EmailSpecialist
 *     directly, bypassing the Outreach Manager and all delegation layers.
 *
 * Renamed Apr 29 2026 from `verify-email-specialist-compose-live.ts` because
 * the old name implied full end-to-end coverage. The orchestrated product-path
 * verify lives at `scripts/verify-outreach-orchestrated-live.ts`.
 *
 * Real product path: see `scripts/verify-outreach-orchestrated-live.ts`
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

import { getEmailSpecialist } from '../src/lib/agents/outreach/email/specialist';
import type { AgentMessage } from '../src/lib/agents/types';

async function main(): Promise<void> {
  const specialist = getEmailSpecialist();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `verify_seq_${Date.now()}`,
    timestamp: new Date(),
    from: 'OUTREACH_MANAGER',
    to: 'EMAIL_SPECIALIST',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'compose_outreach_sequence',
      campaignName: 'cold_outreach_verify',
      targetAudience:
        'Sarah Chen, VP RevOps at Outpace.io (250-person B2B SaaS). Recently rolled out HubSpot + Outreach.io stitched together. Listed on LinkedIn as "tired of duct-taping". Industry: marketing automation.',
      goal: 'Book a 20-minute call with Sarah to demo the SalesVelocity AI agent swarm as a unified replacement for her stitched-together stack.',
      sequenceLength: 3,
      cadence: 'day 1, day 4, day 8',
      brief:
        "Sarah just publicly complained about duct-taping HubSpot and Outreach.io together. We replace both. Lead the sequence with that specific pain (the duct-tape), use day 4 to share a 1-line proof point about a similar RevOps leader who consolidated, close on day 8 with a direct meeting ask. Don't be cheesy. Don't open with 'I hope this finds you well.'",
    },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };

  console.log('Calling Email Specialist compose_outreach_sequence (sequenceLength=3)...');
  const t0 = Date.now();
  const report = await specialist.execute(message);
  const ms = Date.now() - t0;

  console.log(`Status: ${report.status} (${ms}ms)`);
  if (report.status !== 'COMPLETED') {
    console.error('FAIL:', report.errors);
    process.exit(1);
  }

  const data = report.data as {
    campaignName?: string;
    sequenceLength?: number;
    narrativeArcSummary?: string;
    emails?: Array<{
      stepIndex: number;
      totalSteps: number;
      stepPurposeSlug: string;
      narrativeRole: string;
      subjectLine: string;
      previewText: string;
      bodyPlainText: string;
      ctaLine: string;
      psLine: string;
      sendTimingHint: string;
    }>;
  };

  console.log(`narrativeArcSummary: ${(data.narrativeArcSummary ?? '').slice(0, 200)}...`);
  console.log(`emails: ${data.emails?.length ?? 0}`);
  for (const e of data.emails ?? []) {
    console.log(`  step ${e.stepIndex}/${e.totalSteps}  ${e.stepPurposeSlug}  fire=${e.sendTimingHint}`);
    console.log(`    subj: ${e.subjectLine}`);
    console.log(`    preview: ${e.previewText}`);
    console.log(`    role: ${(e.narrativeRole ?? '').slice(0, 120)}`);
  }

  console.log('\nPASS  compose_outreach_sequence end-to-end');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('verify-outreach-sequence failed:', err);
  process.exit(1);
});
