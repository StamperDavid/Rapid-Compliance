/**
 * PRODUCTION DATABASE CLEANUP SCRIPT
 *
 * Purpose: Clean up leaked/test data from production organizations collection
 *
 * KEEPS:
 *   - org_demo_* accounts (demo organizations)
 *   - platform_docs (system documentation)
 *
 * DELETES:
 *   - org_176* (leaked test IDs)
 *   - test-org* (test organizations)
 *   - Everything else that isn't a demo or platform doc
 *
 * Usage:
 *   npx ts-node scripts/cleanup-prod-orgs.ts --dry-run    # Preview only
 *   npx ts-node scripts/cleanup-prod-orgs.ts --execute    # Actually delete
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
config();

// ============================================================================
// CONFIGURATION
// ============================================================================

// Patterns to KEEP (regex)
const KEEP_PATTERNS = [
  /^org_demo_/,      // Demo organizations
  /^platform_docs$/, // Platform documentation
  /^platform$/,      // Platform Admin org
];

// Patterns to DEFINITELY DELETE (regex) - these are known leaks
const DELETE_PATTERNS = [
  /^org_176/,        // Leaked test IDs
  /^test-org/,       // Test organizations
  /^test_/,          // Test prefixed orgs
];

// Production collection name (no prefix)
const PROD_ORGANIZATIONS_COLLECTION = 'organizations';

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db: Firestore;

function initFirebase(): void {
  if (getApps().length > 0) {
    db = getFirestore();
    return;
  }

  let serviceAccount: any = null;

  // Option 1: Service account JSON file
  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log('✅ Using serviceAccountKey.json file');
  }

  // Option 2: Full JSON in single env var
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('✅ Using FIREBASE_SERVICE_ACCOUNT_KEY env var');
  }

  // Option 3: Individual env vars (like Vercel setup)
  if (!serviceAccount && process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    // Clean up private key
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey,
    };
    console.log('✅ Using individual FIREBASE_ADMIN_* env vars');
  }

  if (!serviceAccount) {
    console.log('Available env vars:');
    console.log('  FIREBASE_ADMIN_PROJECT_ID:', process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'MISSING');
    console.log('  FIREBASE_ADMIN_CLIENT_EMAIL:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'MISSING');
    console.log('  FIREBASE_ADMIN_PRIVATE_KEY:', process.env.FIREBASE_ADMIN_PRIVATE_KEY ? `SET (${process.env.FIREBASE_ADMIN_PRIVATE_KEY.length} chars)` : 'MISSING');
    throw new Error('No Firebase credentials found. Check .env file or serviceAccountKey.json');
  }

  initializeApp({
    credential: cert(serviceAccount),
  });

  db = getFirestore();
  console.log('✅ Firebase initialized successfully');
}

// ============================================================================
// CLASSIFICATION LOGIC
// ============================================================================

interface OrgClassification {
  id: string;
  action: 'KEEP' | 'DELETE';
  reason: string;
  data?: Record<string, any>;
}

function classifyOrganization(docId: string, data: Record<string, any>): OrgClassification {
  // Check if it matches KEEP patterns
  for (const pattern of KEEP_PATTERNS) {
    if (pattern.test(docId)) {
      return {
        id: docId,
        action: 'KEEP',
        reason: `Matches keep pattern: ${pattern}`,
        data,
      };
    }
  }

  // Check if it matches DELETE patterns (known leaks)
  for (const pattern of DELETE_PATTERNS) {
    if (pattern.test(docId)) {
      return {
        id: docId,
        action: 'DELETE',
        reason: `Matches delete pattern: ${pattern}`,
        data,
      };
    }
  }

  // Default: DELETE anything not explicitly kept
  return {
    id: docId,
    action: 'DELETE',
    reason: 'Not in keep list - potential data leak',
    data,
  };
}

// ============================================================================
// RECURSIVE SUBCOLLECTION DELETION
// ============================================================================

async function deleteDocumentWithSubcollections(
  docRef: FirebaseFirestore.DocumentReference,
  dryRun: boolean
): Promise<number> {
  let deletedCount = 0;

  // Get all subcollections
  const subcollections = await docRef.listCollections();

  for (const subcollection of subcollections) {
    const subDocs = await subcollection.listDocuments();

    for (const subDoc of subDocs) {
      // Recursively delete subcollection documents
      deletedCount += await deleteDocumentWithSubcollections(subDoc, dryRun);
    }

    if (!dryRun) {
      // Delete all documents in this subcollection in batches
      const docs = await subcollection.get();
      const batch = db.batch();
      docs.forEach(doc => batch.delete(doc.ref));
      if (docs.size > 0) {
        await batch.commit();
      }
    }

    const subSize = (await subcollection.get()).size;
    if (subSize > 0 || !dryRun) {
      console.log(`    └─ ${dryRun ? '[DRY RUN] Would delete' : 'Deleted'} subcollection: ${subcollection.id} (${subSize} docs)`);
    }
  }

  // Delete the document itself
  if (!dryRun) {
    await docRef.delete();
  }
  deletedCount++;

  return deletedCount;
}

// ============================================================================
// MAIN CLEANUP FUNCTION
// ============================================================================

async function runCleanup(dryRun: boolean): Promise<void> {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  PRODUCTION DATABASE CLEANUP SCRIPT');
  console.log(`  Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '🗑️  EXECUTE (will delete data)'}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  // Initialize Firebase
  initFirebase();

  // Fetch all organizations from PRODUCTION collection (no prefix)
  console.log(`📂 Fetching from collection: ${PROD_ORGANIZATIONS_COLLECTION}`);
  const snapshot = await db.collection(PROD_ORGANIZATIONS_COLLECTION).get();

  console.log(`   Found ${snapshot.size} total documents\n`);

  // Classify all organizations
  const classifications: OrgClassification[] = [];

  snapshot.forEach(doc => {
    const classification = classifyOrganization(doc.id, doc.data());
    classifications.push(classification);
  });

  // Separate into keep and delete lists
  const toKeep = classifications.filter(c => c.action === 'KEEP');
  const toDelete = classifications.filter(c => c.action === 'DELETE');

  // Display KEEP list
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  ✅ ORGANIZATIONS TO KEEP (${toKeep.length})`);
  console.log('════════════════════════════════════════════════════════════════');
  toKeep.forEach(org => {
    const name = org.data?.name || org.data?.displayName || 'N/A';
    console.log(`  ✓ ${org.id}`);
    console.log(`    Name: ${name}`);
    console.log(`    Reason: ${org.reason}`);
    console.log('');
  });

  // Display DELETE list
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  🗑️  ORGANIZATIONS TO DELETE (${toDelete.length})`);
  console.log('════════════════════════════════════════════════════════════════');
  toDelete.forEach(org => {
    const name = org.data?.name || org.data?.displayName || 'N/A';
    const createdAt = org.data?.createdAt?.toDate?.()?.toISOString() || 'unknown';
    console.log(`  ✗ ${org.id}`);
    console.log(`    Name: ${name}`);
    console.log(`    Created: ${createdAt}`);
    console.log(`    Reason: ${org.reason}`);
    console.log('');
  });

  // Summary
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  Total organizations: ${snapshot.size}`);
  console.log(`  Will KEEP: ${toKeep.length}`);
  console.log(`  Will DELETE: ${toDelete.length}`);
  console.log('');

  if (dryRun) {
    console.log('  📋 This was a DRY RUN. No data was modified.');
    console.log('  To execute the cleanup, run with --execute flag');
    console.log('');
    return;
  }

  // Execute deletion
  console.log('  ⚠️  EXECUTING DELETION...');
  console.log('');

  let totalDeleted = 0;

  for (const org of toDelete) {
    console.log(`  Deleting: ${org.id}...`);
    const docRef = db.collection(PROD_ORGANIZATIONS_COLLECTION).doc(org.id);

    try {
      const deleted = await deleteDocumentWithSubcollections(docRef, false);
      totalDeleted += deleted;
      console.log(`    ✓ Deleted (${deleted} documents including subcollections)`);
    } catch (error: any) {
      console.error(`    ✗ Error: ${error.message}`);
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  ✅ CLEANUP COMPLETE`);
  console.log(`  Deleted ${totalDeleted} total documents`);
  console.log('════════════════════════════════════════════════════════════════');
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || !args.includes('--execute');

if (!args.includes('--dry-run') && !args.includes('--execute')) {
  console.log('⚠️  No flag specified. Defaulting to --dry-run for safety.');
  console.log('   Use --execute to actually delete data.');
  console.log('');
}

runCleanup(isDryRun)
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
