/**
 * Inspect the Workflow doc + its scheduled sequence jobs for a given
 * workflowId. Confirms Stage A.5 wrote both collections correctly.
 *
 * Run:
 *   npx tsx scripts/verify-workflow-firestore-state.ts <workflowId>
 */

import '@/lib/firebase/admin';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

async function main(): Promise<void> {
  const workflowId = process.argv[2];
  if (!workflowId) {
    console.error('Usage: verify-workflow-firestore-state.ts <workflowId>');
    process.exit(1);
  }
  if (!adminDb) {
    console.error('adminDb not initialized');
    process.exit(1);
  }

  const wfDoc = await adminDb.collection(getSubCollection('workflows')).doc(workflowId).get();
  if (!wfDoc.exists) {
    console.error(`No workflow doc at ${getSubCollection('workflows')}/${workflowId}`);
    process.exit(2);
  }

  const wf = wfDoc.data() as Record<string, unknown>;
  console.log('=== Workflow doc ===');
  console.log('  id:                ', wf.id);
  console.log('  name:              ', wf.name);
  console.log('  sequenceType:      ', wf.sequenceType);
  console.log('  triggerEvent:      ', wf.triggerEvent);
  console.log('  sequenceStepCount: ', wf.sequenceStepCount);
  console.log('  status:            ', wf.status);
  console.log('  missionId:         ', wf.missionId);
  console.log('  createdBy:         ', wf.createdBy);
  console.log('  createdAt:         ', wf.createdAt);

  // Uses a single where() to avoid needing the composite index during
  // local verification. The production fireReadySequenceJobs query
  // uses its own (status, fireAt) composite, declared in firestore.indexes.json.
  const jobsSnap = await adminDb
    .collection(getSubCollection('workflowSequenceJobs'))
    .where('workflowId', '==', workflowId)
    .get();

  const jobs = jobsSnap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.stepIndex as number) - (b.stepIndex as number));

  console.log(`\n=== Scheduled jobs (${jobs.length}) ===`);
  for (const job of jobs) {
    console.log(
      `  step ${job.stepIndex}/${job.totalSteps}  ${String(job.status).padEnd(8)}  fireAt=${job.fireAt}  recipient=${job.recipient}  subj="${String(job.emailSubject).slice(0, 60)}..."`,
    );
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
