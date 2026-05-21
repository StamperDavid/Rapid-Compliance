/**
 * Verify CRM contact-merge re-parenting works end-to-end against dev Firestore.
 *
 * Creates two test contacts (A = keep, B = merge), a deal linked to B, and an
 * activity with relatedTo entry pointing at B. Exercises the same service
 * helpers the merge route uses (findDealsByContactId, findActivitiesByContactId,
 * etc.) and performs the same repointing semantics. Asserts the children now
 * point to A. Cleans up all test data in a finally block, success or failure.
 *
 * Usage: npx tsx scripts/verify-crm-merge-reparenting.ts
 * Exit 0 on pass, 1 on any failed assertion.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const TEST_PREFIX = `mergetest_${Date.now()}`;
const PLATFORM_ID = 'rapid-compliance-root';

interface TestData {
  contactKeepId: string;
  contactMergeId: string;
  dealId: string;
  activityId: string;
}

async function setupTestData(db: admin.firestore.Firestore): Promise<TestData> {
  const contactKeepId = `${TEST_PREFIX}_contact_keep`;
  const contactMergeId = `${TEST_PREFIX}_contact_merge`;
  const dealId = `${TEST_PREFIX}_deal`;
  const activityId = `${TEST_PREFIX}_activity`;

  const now = new Date().toISOString();
  const contactsPath = `organizations/${PLATFORM_ID}/contacts`;
  const dealsPath = `organizations/${PLATFORM_ID}/deals`;
  const activitiesPath = `organizations/${PLATFORM_ID}/activities`;

  await db.collection(contactsPath).doc(contactKeepId).set({
    id: contactKeepId, firstName: 'Keep', lastName: 'Contact',
    email: `${TEST_PREFIX}+keep@example.test`, createdAt: now, updatedAt: now,
  });
  await db.collection(contactsPath).doc(contactMergeId).set({
    id: contactMergeId, firstName: 'Merge', lastName: 'Contact',
    email: `${TEST_PREFIX}+merge@example.test`, createdAt: now, updatedAt: now,
  });
  await db.collection(dealsPath).doc(dealId).set({
    id: dealId, name: `${TEST_PREFIX} deal`, contactId: contactMergeId,
    stage: 'prospect', amount: 1000, createdAt: now, updatedAt: now,
  });
  await db.collection(activitiesPath).doc(activityId).set({
    id: activityId, type: 'note', summary: `${TEST_PREFIX} activity`,
    relatedTo: [{ entityType: 'contact', entityId: contactMergeId }],
    createdAt: now, updatedAt: now,
  });

  return { contactKeepId, contactMergeId, dealId, activityId };
}

async function cleanupTestData(db: admin.firestore.Firestore, data: TestData): Promise<void> {
  const contactsPath = `organizations/${PLATFORM_ID}/contacts`;
  const dealsPath = `organizations/${PLATFORM_ID}/deals`;
  const activitiesPath = `organizations/${PLATFORM_ID}/activities`;
  await Promise.all([
    db.collection(contactsPath).doc(data.contactKeepId).delete(),
    db.collection(contactsPath).doc(data.contactMergeId).delete(),
    db.collection(dealsPath).doc(data.dealId).delete(),
    db.collection(activitiesPath).doc(data.activityId).delete(),
  ]);
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();
  const results: CheckResult[] = [];
  let data: TestData | null = null;

  try {
    // ---- Setup
    data = await setupTestData(db);
    console.log(`Created test data with prefix: ${TEST_PREFIX}\n`);

    // ---- Import service helpers — same ones the merge route uses
    const { findDealsByContactId } = await import('@/lib/crm/deal-service');
    const { findActivitiesByContactId } = await import('@/lib/crm/activity-service');

    // ---- Check 1: helpers find the linked records before merge
    const dealsBeforeMerge = await findDealsByContactId(data.contactMergeId);
    results.push({
      name: 'findDealsByContactId returns the deal linked to mergeId',
      pass: dealsBeforeMerge.some((d) => d.id === data!.dealId),
      detail: `found ${dealsBeforeMerge.length} deal(s), expected to include ${data.dealId}`,
    });

    const activitiesBeforeMerge = await findActivitiesByContactId(data.contactMergeId);
    results.push({
      name: 'findActivitiesByContactId returns the activity linked to mergeId',
      pass: activitiesBeforeMerge.some((m) => m.activity.id === data!.activityId),
      detail: `found ${activitiesBeforeMerge.length} activity match(es), expected to include ${data.activityId}`,
    });

    // ---- Check 2: confirm keepId starts with NO linked deals/activities
    const dealsForKeepBeforeMerge = await findDealsByContactId(data.contactKeepId);
    results.push({
      name: 'keepId has zero linked deals before merge',
      pass: dealsForKeepBeforeMerge.length === 0,
      detail: `found ${dealsForKeepBeforeMerge.length} deal(s) on keepId`,
    });

    // ---- Repoint via the same semantics as the route
    const dealsPath = `organizations/${PLATFORM_ID}/deals`;
    const activitiesPath = `organizations/${PLATFORM_ID}/activities`;
    const batch = db.batch();
    for (const deal of dealsBeforeMerge) {
      batch.update(db.collection(dealsPath).doc(deal.id), {
        contactId: data.contactKeepId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    for (const { activity, relatedToIndex } of activitiesBeforeMerge) {
      const patched = activity.relatedTo.map((rel, idx) =>
        idx === relatedToIndex ? { ...rel, entityId: data!.contactKeepId } : rel
      );
      batch.update(db.collection(activitiesPath).doc(activity.id), {
        relatedTo: patched,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    // ---- Check 3: after repoint, mergeId has zero linked deals/activities
    const dealsForMergeAfter = await findDealsByContactId(data.contactMergeId);
    results.push({
      name: 'mergeId has zero linked deals after repoint',
      pass: dealsForMergeAfter.length === 0,
      detail: `found ${dealsForMergeAfter.length} deal(s) still pointing at mergeId`,
    });

    const activitiesForMergeAfter = await findActivitiesByContactId(data.contactMergeId);
    results.push({
      name: 'mergeId has zero linked activities after repoint',
      pass: activitiesForMergeAfter.length === 0,
      detail: `found ${activitiesForMergeAfter.length} activity match(es) still pointing at mergeId`,
    });

    // ---- Check 4: keepId now has the repointed deal + activity
    const dealsForKeepAfter = await findDealsByContactId(data.contactKeepId);
    results.push({
      name: 'keepId has the repointed deal',
      pass: dealsForKeepAfter.some((d) => d.id === data!.dealId),
      detail: `found ${dealsForKeepAfter.length} deal(s), expected to include ${data.dealId}`,
    });

    const activitiesForKeepAfter = await findActivitiesByContactId(data.contactKeepId);
    results.push({
      name: 'keepId has the repointed activity',
      pass: activitiesForKeepAfter.some((m) => m.activity.id === data!.activityId),
      detail: `found ${activitiesForKeepAfter.length} activity match(es), expected to include ${data.activityId}`,
    });

  } finally {
    if (data) {
      await cleanupTestData(db, data);
      console.log('\nCleaned up test data.');
    }
  }

  // Report
  console.log('\nCRM contact merge re-parenting verification:\n');
  let allPassed = true;
  for (const r of results) {
    const marker = r.pass ? '✓' : '✗';
    console.log(`  ${marker} ${r.name.padEnd(60)} ${r.detail}`);
    if (!r.pass) { allPassed = false; }
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed.\n`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Verification failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
