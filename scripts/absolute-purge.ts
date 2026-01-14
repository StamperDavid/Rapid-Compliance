/**
 * ABSOLUTE FIRESTORE PURGE & VERIFICATION
 *
 * Senior Firebase Backend Engineer Mode
 * - Project ID lockdown & verification
 * - Server-side fetch (no cache)
 * - Hard delete with recursiveDelete
 * - Post-delete verification with consistency wait
 * - Detailed report table
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const COLLECTION = 'organizations';
const CONSISTENCY_WAIT_MS = 2000;

// Zombie patterns - HARD DELETE these
const ZOMBIE_PATTERNS = [
  /^org_176/,
  /^test-org-/,
  /^test_org/,
];

// Valid IDs - DO NOT DELETE
const VALID_IDS = new Set([
  'platform',
  'org_demo_retail',
  'org_demo_saas',
  'org_demo_healthcare',
  'org_demo_realestate',
  'org_demo_finance',
]);

// ============================================================================
// TYPES
// ============================================================================

interface DeletionReport {
  targetId: string;
  deletionStatus: 'DELETED' | 'FAILED' | 'SKIPPED';
  postVerificationStatus: 'GONE' | 'STILL_EXISTS' | 'N/A';
  error?: string;
}

// ============================================================================
// STEP 1: ENVIRONMENT & PROJECT LOCKDOWN
// ============================================================================

function initializeAndVerify(): { db: Firestore; app: App; projectId: string } {
  console.log('\n' + '═'.repeat(70));
  console.log('  STEP 1: ENVIRONMENT & PROJECT LOCKDOWN');
  console.log('═'.repeat(70) + '\n');

  // Log environment variables
  const envProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'NOT_SET';
  console.log(`📋 Environment Variables:`);
  console.log(`   FIREBASE_ADMIN_PROJECT_ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID || 'NOT_SET'}`);
  console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'NOT_SET'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT_SET'}`);
  console.log(`   NEXT_PUBLIC_APP_ENV: ${process.env.NEXT_PUBLIC_APP_ENV || 'NOT_SET'}`);

  // Initialize Firebase Admin
  let app: App;
  let serviceAccountProjectId: string = 'UNKNOWN';

  if (getApps().length > 0) {
    app = getApps()[0]!;
    console.log('\n⚠️ Firebase already initialized, using existing app');
  } else {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');

    if (!fs.existsSync(keyPath)) {
      throw new Error('❌ FATAL: serviceAccountKey.json not found');
    }

    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    serviceAccountProjectId = serviceAccount.project_id;

    console.log(`\n📋 Service Account File:`);
    console.log(`   project_id: ${serviceAccountProjectId}`);
    console.log(`   client_email: ${serviceAccount.client_email}`);

    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccountProjectId,
    });
  }

  // Get initialized project ID
  const initializedProjectId = app.options.projectId || serviceAccountProjectId;

  console.log(`\n📋 Initialized Firebase App:`);
  console.log(`   Project ID: ${initializedProjectId}`);

  // VERIFICATION: Check for mismatch
  if (envProjectId !== 'NOT_SET' && envProjectId !== initializedProjectId) {
    console.log('\n⚠️ WARNING: Environment project ID does not match service account!');
    console.log(`   Env: ${envProjectId}`);
    console.log(`   Service Account: ${initializedProjectId}`);
    console.log('   → Proceeding with SERVICE ACCOUNT project ID');
  }

  console.log(`\n✅ PROJECT LOCKED: ${initializedProjectId}`);

  return {
    db: getFirestore(app),
    app,
    projectId: initializedProjectId,
  };
}

// ============================================================================
// STEP 2: SERVER-SIDE FETCH (NO CACHE)
// ============================================================================

async function serverSideFetch(db: Firestore): Promise<Map<string, any>> {
  console.log('\n' + '═'.repeat(70));
  console.log('  STEP 2: SERVER-SIDE FETCH (FRESH, NO CACHE)');
  console.log('═'.repeat(70) + '\n');

  // Force a fresh fetch from the server
  const snapshot = await db.collection(COLLECTION).get();

  console.log(`📂 Collection: ${COLLECTION}`);
  console.log(`   Server returned: ${snapshot.size} documents`);
  console.log(`   Read time: ${snapshot.readTime.toDate().toISOString()}`);

  const docs = new Map<string, any>();

  console.log('\n📋 Document Inventory:');
  console.log('─'.repeat(70));

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const subcols = await doc.ref.listCollections();

    const isZombie = ZOMBIE_PATTERNS.some(p => p.test(doc.id));
    const isValid = VALID_IDS.has(doc.id);

    let status = '⚪ UNKNOWN';
    if (isZombie) status = '💀 ZOMBIE';
    else if (isValid) status = '✅ VALID';

    console.log(`\n   ${status} ${doc.id}`);
    console.log(`      Name: ${data.name || 'N/A'}`);
    console.log(`      Created: ${data.createdAt?.toDate?.()?.toISOString() || 'N/A'}`);
    console.log(`      Subcollections: ${subcols.map(c => c.id).join(', ') || 'none'}`);

    docs.set(doc.id, { data, subcols: subcols.map(c => c.id) });
  }

  return docs;
}

// ============================================================================
// STEP 3: HARD DELETE EXECUTION
// ============================================================================

async function hardDelete(db: Firestore, docs: Map<string, any>): Promise<DeletionReport[]> {
  console.log('\n' + '═'.repeat(70));
  console.log('  STEP 3: HARD DELETE EXECUTION');
  console.log('═'.repeat(70) + '\n');

  const reports: DeletionReport[] = [];

  // Find zombies
  const zombies: string[] = [];
  for (const [id] of docs) {
    if (ZOMBIE_PATTERNS.some(p => p.test(id))) {
      zombies.push(id);
    }
  }

  if (zombies.length === 0) {
    console.log('✅ No zombie documents found. Nothing to delete.');
    return reports;
  }

  console.log(`🎯 Target List: ${zombies.length} zombie(s) to delete`);
  zombies.forEach(z => console.log(`   • ${z}`));

  console.log('\n🔥 Executing HARD DELETE...\n');

  for (const zombieId of zombies) {
    const report: DeletionReport = {
      targetId: zombieId,
      deletionStatus: 'FAILED',
      postVerificationStatus: 'N/A',
    };

    console.log(`─── Deleting: ${zombieId} ───`);

    const docRef = db.collection(COLLECTION).doc(zombieId);

    try {
      // HARD DELETE using recursiveDelete
      console.log(`   → Executing recursiveDelete()...`);
      await db.recursiveDelete(docRef);
      console.log(`   ✓ recursiveDelete() completed`);

      // Immediate verification (before consistency wait)
      const immediateCheck = await docRef.get();
      if (immediateCheck.exists) {
        console.log(`   ⚠️ Document still exists immediately after delete`);
        console.log(`   → Attempting direct delete()...`);
        await docRef.delete();
      }

      // Check for orphaned subcollections
      const orphans = await docRef.listCollections();
      if (orphans.length > 0) {
        console.log(`   ⚠️ Orphaned subcollections: ${orphans.map(c => c.id).join(', ')}`);
        for (const orphan of orphans) {
          console.log(`   → Deleting orphan: ${orphan.id}...`);
          await db.recursiveDelete(orphan);
        }
      }

      report.deletionStatus = 'DELETED';
      console.log(`   ✅ Deletion completed\n`);

    } catch (error: any) {
      report.deletionStatus = 'FAILED';
      report.error = error.message;
      console.log(`   ❌ ERROR: ${error.message}\n`);
    }

    reports.push(report);
  }

  return reports;
}

// ============================================================================
// STEP 4: POST-DELETE SERVER CONFIRMATION
// ============================================================================

async function postDeleteVerification(
  db: Firestore,
  reports: DeletionReport[]
): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('  STEP 4: POST-DELETE SERVER CONFIRMATION');
  console.log('═'.repeat(70) + '\n');

  if (reports.length === 0) {
    console.log('⏭️ No deletions were performed, skipping verification.');
    return;
  }

  // Wait for eventual consistency
  console.log(`⏳ Waiting ${CONSISTENCY_WAIT_MS}ms for eventual consistency...`);
  await new Promise(resolve => setTimeout(resolve, CONSISTENCY_WAIT_MS));
  console.log('✓ Wait complete\n');

  // Fresh server fetch
  console.log('📡 Performing fresh server-side fetch...');
  const snapshot = await db.collection(COLLECTION).get();
  console.log(`   Server returned: ${snapshot.size} documents`);
  console.log(`   Read time: ${snapshot.readTime.toDate().toISOString()}\n`);

  const existingIds = new Set(snapshot.docs.map(d => d.id));

  // Update reports with post-verification status
  for (const report of reports) {
    if (existingIds.has(report.targetId)) {
      report.postVerificationStatus = 'STILL_EXISTS';
      console.log(`❌ ZOMBIE PERSISTS: ${report.targetId}`);

      // Check permissions
      console.log(`   → Checking document state...`);
      const docSnap = await db.collection(COLLECTION).doc(report.targetId).get();
      if (docSnap.exists) {
        console.log(`   → Document data: ${JSON.stringify(docSnap.data())}`);
        console.log(`   → This may indicate insufficient delete permissions.`);
        console.log(`   → Check Firestore Security Rules and Service Account IAM roles.`);
      }
    } else {
      report.postVerificationStatus = 'GONE';
      console.log(`✅ VERIFIED GONE: ${report.targetId}`);
    }
  }

  // List remaining documents
  console.log('\n📋 Remaining Documents:');
  for (const doc of snapshot.docs) {
    const isValid = VALID_IDS.has(doc.id);
    const isZombie = ZOMBIE_PATTERNS.some(p => p.test(doc.id));

    let icon = '⚪';
    if (isZombie) icon = '💀';
    else if (isValid) icon = '✅';

    console.log(`   ${icon} ${doc.id}`);
  }
}

// ============================================================================
// STEP 5: REPORT FINDINGS
// ============================================================================

function printReport(reports: DeletionReport[], projectId: string): void {
  console.log('\n' + '═'.repeat(70));
  console.log('  STEP 5: FINAL REPORT');
  console.log('═'.repeat(70) + '\n');

  console.log(`📋 Project: ${projectId}`);
  console.log(`📋 Collection: ${COLLECTION}`);
  console.log(`📋 Timestamp: ${new Date().toISOString()}\n`);

  if (reports.length === 0) {
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  NO ZOMBIE DOCUMENTS FOUND - DATABASE IS CLEAN                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    return;
  }

  // Print table header
  console.log('┌' + '─'.repeat(35) + '┬' + '─'.repeat(15) + '┬' + '─'.repeat(20) + '┐');
  console.log('│ ' + 'Target ID'.padEnd(33) + ' │ ' + 'Delete Status'.padEnd(13) + ' │ ' + 'Post-Verification'.padEnd(18) + ' │');
  console.log('├' + '─'.repeat(35) + '┼' + '─'.repeat(15) + '┼' + '─'.repeat(20) + '┤');

  for (const report of reports) {
    const id = report.targetId.length > 31
      ? report.targetId.substring(0, 28) + '...'
      : report.targetId;

    const deleteIcon = report.deletionStatus === 'DELETED' ? '✅' : '❌';
    const verifyIcon = report.postVerificationStatus === 'GONE' ? '✅' :
      report.postVerificationStatus === 'STILL_EXISTS' ? '❌' : '⏭️';

    console.log(
      '│ ' + id.padEnd(33) +
      ' │ ' + `${deleteIcon} ${report.deletionStatus}`.padEnd(13) +
      ' │ ' + `${verifyIcon} ${report.postVerificationStatus}`.padEnd(18) + ' │'
    );
  }

  console.log('└' + '─'.repeat(35) + '┴' + '─'.repeat(15) + '┴' + '─'.repeat(20) + '┘');

  // Summary
  const deleted = reports.filter(r => r.deletionStatus === 'DELETED').length;
  const failed = reports.filter(r => r.deletionStatus === 'FAILED').length;
  const verified = reports.filter(r => r.postVerificationStatus === 'GONE').length;
  const persisted = reports.filter(r => r.postVerificationStatus === 'STILL_EXISTS').length;

  console.log(`\n📊 Summary:`);
  console.log(`   Deletion: ${deleted} succeeded, ${failed} failed`);
  console.log(`   Verification: ${verified} confirmed gone, ${persisted} still exist`);

  if (persisted > 0) {
    console.log('\n⚠️ ACTION REQUIRED:');
    console.log('   Some documents persist after deletion. Check:');
    console.log('   1. Firestore Security Rules (delete permission)');
    console.log('   2. Service Account IAM roles (datastore.databases.delete)');
    console.log('   3. Firebase Console for "phantom" documents');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('  ABSOLUTE FIRESTORE PURGE & VERIFICATION');
  console.log('  Senior Firebase Backend Engineer Mode');
  console.log('█'.repeat(70));

  // Step 1: Initialize and verify project
  const { db, projectId } = initializeAndVerify();

  // Step 2: Server-side fetch
  const docs = await serverSideFetch(db);

  // Step 3: Hard delete
  const reports = await hardDelete(db, docs);

  // Step 4: Post-delete verification
  await postDeleteVerification(db, reports);

  // Step 5: Report
  printReport(reports, projectId);

  // Final status
  const hasFailures = reports.some(r =>
    r.deletionStatus === 'FAILED' || r.postVerificationStatus === 'STILL_EXISTS'
  );

  if (hasFailures) {
    console.log('\n❌ PURGE INCOMPLETE - SEE REPORT ABOVE\n');
    process.exit(1);
  } else {
    console.log('\n✅ PURGE COMPLETE - DATABASE IS CLEAN\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\n❌ FATAL ERROR:', err);
  process.exit(1);
});
