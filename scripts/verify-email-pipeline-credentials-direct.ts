/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - Our SendGrid credentials are valid: fireReadySequenceJobs (the same
 *     dispatcher the cron uses) creates a sequenceJob, dispatches it, and
 *     receives a SendGrid messageId
 *   - The sequenceJob write/delete cycle against Firestore works correctly
 *
 * What this does NOT test:
 *   - The product path through Jasper → OutreachManager → EmailSpecialist
 *     → compose + schedule → Mission Control approval → send
 *   - Whether EmailSpecialist.execute() (the function the orchestrator
 *     actually calls) handles compose and schedule correctly. This script
 *     bypasses it by writing a sequenceJob directly.
 *
 * Renamed Apr 29 2026 from `verify-email-pipeline-live.ts` because the old
 * name implied end-to-end product coverage. The orchestrated product-path
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

import { fireReadySequenceJobs } from '../src/lib/workflows/sequence-scheduler';
import { getSubCollection } from '../src/lib/firebase/collections';
import type { WorkflowSequenceJob } from '../src/types/workflow';

async function main(): Promise<void> {
  const recipient = process.env.TEST_EMAIL_RECIPIENT;
  if (!recipient || !/.+@.+\..+/.test(recipient)) {
    console.error('TEST_EMAIL_RECIPIENT env var must be set to a valid email address');
    process.exit(1);
  }

  const db = admin.firestore();
  const collectionPath = getSubCollection('workflowSequenceJobs');
  const jobId = `seqjob_pipeline_test_${Date.now()}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const fireAtIso = new Date(now.getTime() - 60_000).toISOString(); // already due

  const job: WorkflowSequenceJob = {
    id: jobId,
    workflowId: 'workflow-pipeline-test',
    stepIndex: 1,
    totalSteps: 1,
    sequenceType: 'custom',
    triggerEvent: 'pipeline_test',
    recipient,
    recipientResolved: true,
    emailSubject: `[SalesVelocity.ai pipeline test] ${nowIso}`,
    emailPreview: 'This is a one-shot test of the workflow-scheduler send path. Safe to ignore.',
    emailBody:
      '<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;">' +
      '<p>Hi,</p>' +
      '<p>This is a live test of the SalesVelocity.ai email pipeline (sequence-scheduler → SendGrid).</p>' +
      `<p>If you can read this, the path is working end-to-end. Sent at ${nowIso}.</p>` +
      '<p>You can safely delete this email — it was a one-shot test triggered by the operator.</p>' +
      '</div>',
    sendTimingHint: 'now',
    fireAt: fireAtIso,
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  console.log(`Seeding test sequenceJob → ${recipient} (id=${jobId})`);
  await db.collection(collectionPath).doc(jobId).set(job);

  console.log('Calling fireReadySequenceJobs()...');
  const stats = await fireReadySequenceJobs(10);
  console.log(`Dispatch result: checked=${stats.checked} fired=${stats.fired} failed=${stats.failed} skipped=${stats.skipped}`);

  // Read back the job to see SendGrid response details.
  const after = await db.collection(collectionPath).doc(jobId).get();
  const final = after.data() as WorkflowSequenceJob | undefined;
  if (final) {
    console.log(`Final job state: status=${final.status}`);
    if (final.provider) { console.log(`  provider=${final.provider}`); }
    if (final.messageId) { console.log(`  messageId=${final.messageId}`); }
    if (final.firedAt) { console.log(`  firedAt=${final.firedAt}`); }
    if (final.error) { console.log(`  error=${final.error}`); }
  }

  // Cleanup the test job so it doesn't pollute the collection.
  await db.collection(collectionPath).doc(jobId).delete();
  console.log(`Cleaned up test job ${jobId}`);

  if (final?.status === 'fired') {
    console.log(`\nPASS  email dispatched. Check ${recipient} inbox.`);
    process.exit(0);
  } else {
    console.log('\nFAIL  see status/error above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
