/**
 * End-to-end sanity check for Stage A.5 step #5 — outreach instantiation.
 *
 * Steps:
 *   1. Create a Workflow doc + 3 template sequenceJobs directly (simulates
 *      what the create_workflow Jasper tool does), using trigger type
 *      `entity.created` + schemaId `leads` and recipient `{{entity.email}}`.
 *   2. Fire a synthetic `lead_created` event via fireLeadCreated().
 *   3. Query `workflowSequenceJobs` for this workflowId and count docs
 *      whose recipientResolved=true — expect 3 new real-recipient jobs
 *      pointing at the synthetic lead's email.
 *   4. Clean up test data (delete the workflow + all its sequence jobs).
 *
 * This does NOT send any email — the jobs are left in pending status. The
 * cron poller fires them later; if the test recipient is unreachable the
 * sendEmail call will just fail fast, no external side-effects.
 */

/* eslint-disable no-console */

import '@/lib/firebase/admin';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { fireLeadCreated } from '@/lib/crm/event-triggers';
import { scheduleEmailSequence } from '@/lib/workflows/sequence-scheduler';
import type { WorkflowSequenceJob } from '@/types/workflow';

const TEST_MARKER = 'stage_a5_outreach_wiring_test';

async function main(): Promise<void> {
  if (!adminDb) {
    console.error('adminDb not initialized');
    process.exit(1);
  }

  const workflowId = `workflow-outreach-test-${Date.now()}`;
  const missionId = `mission-outreach-test-${Date.now()}`;
  const testLeadEmail = `outreach-test-${Date.now()}@example.invalid`;
  const nowIso = new Date().toISOString();

  // --- Step 1: Plant a sequence workflow + template jobs -------------------
  await adminDb.collection(getSubCollection('workflows')).doc(workflowId).set({
    id: workflowId,
    name: 'Outreach wiring test sequence',
    description: 'Stage A.5 step #5 verify — cleaned up by this script',
    trigger: {
      id: `trigger_${Date.now()}`,
      name: 'new_lead → leads.created',
      type: 'entity.created',
      schemaId: 'leads',
    },
    actions: [],
    settings: { enabled: true, onError: 'continue', logLevel: 'errors', retentionDays: 1 },
    permissions: { canView: ['owner'], canEdit: ['owner'], canExecute: ['owner'] },
    status: 'active',
    stats: { totalRuns: 0, successfulRuns: 0, failedRuns: 0 },
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: TEST_MARKER,
    version: 1,
    sequenceType: 'welcome',
    triggerEvent: 'new_lead',
    sequenceStepCount: 3,
    missionId,
    testMarker: TEST_MARKER,
  });
  console.log(`[1/4] Seeded sequence workflow: ${workflowId}`);

  await scheduleEmailSequence({
    workflowId,
    missionId,
    sequenceType: 'welcome',
    triggerEvent: 'new_lead',
    cadence: 'day 1, day 3, day 7',
    recipient: '{{entity.email}}', // template — triggers recipientResolved=false
    emails: [
      { order: 1, subjectLine: 'Welcome aboard', previewText: 'Getting you oriented', body: 'Hi, welcome.', cta: 'Start here', sendTimingHint: 'day 1' },
      { order: 2, subjectLine: 'Quick win for day 3', previewText: 'Your first real outcome', body: 'Day 3 content.', cta: 'Try it', sendTimingHint: 'day 3' },
      { order: 3, subjectLine: 'Week-one checkpoint', previewText: 'Where you should be by now', body: 'Week-1 checkpoint.', cta: 'Confirm', sendTimingHint: 'day 7' },
    ],
  });
  console.log('[1/4] Seeded 3 template sequence jobs');

  // --- Step 2: Fire lead_created synthetic event ---------------------------
  const leadId = `lead-outreach-test-${Date.now()}`;
  await fireLeadCreated(leadId, { id: leadId, email: testLeadEmail, firstName: 'Outreach', lastName: 'Test' });
  console.log(`[2/4] Fired lead_created for ${testLeadEmail}`);

  // --- Step 3: Inspect sequenceJobs ----------------------------------------
  // Give the async event-trigger path a moment to land.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const jobsSnap = await adminDb
    .collection(getSubCollection('workflowSequenceJobs'))
    .where('workflowId', '==', workflowId)
    .get();

  const all = jobsSnap.docs.map((d) => d.data() as WorkflowSequenceJob);
  const templates = all.filter((j) => !j.recipientResolved);
  const resolved = all.filter((j) => j.recipientResolved && j.recipient === testLeadEmail);

  console.log(`[3/4] Found ${all.length} total jobs: ${templates.length} template, ${resolved.length} resolved to ${testLeadEmail}`);
  for (const job of resolved.sort((a, b) => a.stepIndex - b.stepIndex)) {
    console.log(`       step ${job.stepIndex}/${job.totalSteps}  fireAt=${job.fireAt}  recipient=${job.recipient}  subj="${job.emailSubject}"`);
  }

  let pass = true;
  if (templates.length !== 3) {
    console.error(`FAIL  expected 3 template jobs to remain untouched, saw ${templates.length}`);
    pass = false;
  }
  if (resolved.length !== 3) {
    console.error(`FAIL  expected 3 resolved jobs for ${testLeadEmail}, saw ${resolved.length}`);
    pass = false;
  }

  // --- Step 4: Cleanup -----------------------------------------------------
  const deleteBatch = adminDb.batch();
  for (const doc of jobsSnap.docs) {
    deleteBatch.delete(doc.ref);
  }
  deleteBatch.delete(adminDb.collection(getSubCollection('workflows')).doc(workflowId));

  // Delete the synthetic lead if it landed (fireLeadCreated just queries
  // workflows but the caller, lead-service.createLead, persists a lead;
  // we didn't go through that path here, so there may be no doc to delete —
  // the .delete() is a no-op if the doc doesn't exist).
  deleteBatch.delete(adminDb.collection(getSubCollection('leads')).doc(leadId));

  await deleteBatch.commit();
  console.log('[4/4] Cleaned up test artifacts');

  if (pass) {
    console.log('\nPASS  outreach wiring end-to-end');
    process.exit(0);
  } else {
    console.log('\nFAIL  see assertions above');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('verify-sequence-outreach-wiring failed:', err);
  process.exit(1);
});
