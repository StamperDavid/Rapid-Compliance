/**
 * Demo Data Cleanup Script — Three-Layer Identification
 *
 * Safely removes ALL demo data seeded by Parts 1-4:
 *   - seed-demo-account.ts (Part 1: CRM)
 *   - seed-demo-account-part2.ts (Part 2: Platform)
 *   - seed-demo-account-part3.ts (Part 3: Remaining Platform)
 *   - seed-demo-account-part4.ts (Part 4: Growth, AI Workforce, Team, etc.)
 *
 * Identification layers (ANY match = demo data):
 *   1. Document ID starts with "demo-"
 *   2. Document has `isDemo: true` field
 *   3. Document has a tags array containing "(Demo)" OR name/title contains "(Demo)"
 *
 * Safety:
 *   - DRY-RUN by default — prints what it would delete but doesn't touch anything
 *   - Pass --execute to actually delete
 *   - Verification scan after deletion confirms zero demo docs remain
 *
 * Usage:
 *   npx tsx scripts/nuke-demo-data.ts              # dry-run (safe)
 *   npx tsx scripts/nuke-demo-data.ts --execute     # actually delete
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const orgRoot = `organizations/${PLATFORM_ID}`;

/** All org-level subcollections that may contain demo data (Parts 1-4) */
const COLLECTIONS_TO_SCAN: string[] = [
  // ── Part 1: CRM ───────────────────────────────────────────────────────
  'leads',
  'contacts',
  'deals',
  'activities',
  'products',
  'emailCampaigns',
  'nurtureSequences',
  'analytics',

  // ── Part 2: Platform ──────────────────────────────────────────────────
  'orders',
  'workflows',
  'workflowExecutions',
  'forms',
  'socialPosts',
  'blogPosts',
  'pages',
  'conversations',
  'tasks',
  'teamTasks',
  'webhooks',
  'customTools',
  'scoringRules',
  'globalTemplates',
  'integrations',
  'slack_workspaces',

  // ── Part 3: Remaining Platform ────────────────────────────────────────
  'records',
  'members',
  'companies',
  'conversationAnalyses',
  'schemas',
  'chatSessions',
  'sequences',
  'sequenceEnrollments',
  'proposalTemplates',
  'formSubmissions',
  'missions',
  'leadRoutingRules',
  'smsTemplates',
  'emailTemplates',
  'storefrontConfig',
  'notifications',
  'notification_preferences',
  'merchant_coupons',
  'carts',
  'blogCategories',
  'bookings',
  'toolTraining',
  'voiceKnowledge',
  'socialKnowledge',
  'socialCorrections',
  'seoResearch',
  'playbooks',
  'auditLogs',
  'reports',

  // ── Part 4: Growth, AI Workforce, Team & More ─────────────────────────
  'teams',
  'growthCompetitorProfiles',
  'growthCompetitorSnapshots',
  'growthKeywordRankings',
  'growthStrategies',
  'growthAiVisibility',
  'growthActivityLog',
  'abTests',
  'calls',
  'video_pipeline_projects',
  'agentRepProfiles',
  'agentPerformance',
  'specialistImprovementRequests',
];

/** Top-level collections (NOT under orgRoot) that may contain demo data */
const TOP_LEVEL_COLLECTIONS_TO_SCAN: string[] = [
  'users',
];

/** Settings/config docs that may have been overwritten by seed scripts */
const SETTINGS_DOCS_TO_CHECK: Array<{ path: string; description: string }> = [
  { path: `${orgRoot}/onboarding/status`, description: 'Onboarding status' },
  { path: `${orgRoot}/agent/persona`, description: 'Agent persona config' },
  { path: `${orgRoot}/siteConfig/main`, description: 'Site configuration' },
  { path: `${orgRoot}/themes/active`, description: 'Active theme' },
  { path: `${orgRoot}/navigation/main`, description: 'Navigation config' },
];

// ============================================================================
// FIREBASE INIT
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');

  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('  Using serviceAccountKey.json');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const parsed = raw.startsWith('{')
      ? JSON.parse(raw)
      : JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    console.log('  Using FIREBASE_SERVICE_ACCOUNT_KEY env var');
  } else if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'rapid-compliance-65f87',
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      } as admin.ServiceAccount),
    });
    console.log('  Using individual env vars');
  } else {
    throw new Error('No Firebase credentials found. Place serviceAccountKey.json in project root or set env vars.');
  }

  return admin.firestore();
}

// ============================================================================
// DEMO DATA IDENTIFICATION
// ============================================================================

function isDemoDocument(docId: string, data: Record<string, unknown>): boolean {
  // Layer 1: ID starts with "demo-"
  if (docId.startsWith('demo-')) return true;

  // Layer 2: isDemo flag
  if (data.isDemo === true) return true;

  // Layer 3: Tags or name/title contain "(Demo)"
  const tags = data.tags;
  if (Array.isArray(tags) && tags.some((t: unknown) => typeof t === 'string' && t.includes('(Demo)'))) {
    return true;
  }

  const nameFields = ['name', 'title', 'firstName', 'lastName', 'company', 'label'];
  for (const field of nameFields) {
    const val = data[field];
    if (typeof val === 'string' && val.includes('(Demo)')) return true;
  }

  return false;
}

// ============================================================================
// SCAN & DELETE
// ============================================================================

interface ScanResult {
  collection: string;
  docId: string;
  reason: string;
}

async function scanCollection(
  db: admin.firestore.Firestore,
  collectionName: string,
  pathPrefix: string = orgRoot,
): Promise<ScanResult[]> {
  const collectionPath = pathPrefix ? `${pathPrefix}/${collectionName}` : collectionName;
  const results: ScanResult[] = [];

  try {
    const snapshot = await db.collection(collectionPath).get();
    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (isDemoDocument(doc.id, data)) {
        const reasons: string[] = [];
        if (doc.id.startsWith('demo-')) reasons.push('id=demo-*');
        if (data.isDemo === true) reasons.push('isDemo=true');
        const tags = data.tags;
        if (Array.isArray(tags) && tags.some((t: unknown) => typeof t === 'string' && t.includes('(Demo)'))) {
          reasons.push('tags=(Demo)');
        }
        const nameFields = ['name', 'title', 'firstName', 'lastName', 'company', 'label'];
        for (const field of nameFields) {
          const val = data[field];
          if (typeof val === 'string' && val.includes('(Demo)')) {
            reasons.push(`${field}=(Demo)`);
            break;
          }
        }
        results.push({
          collection: collectionName,
          docId: doc.id,
          reason: reasons.join(', '),
        });
      }
    }
  } catch (err) {
    // Collection may not exist — that's fine
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('NOT_FOUND') && !message.includes('does not exist')) {
      console.warn(`  ⚠ Error scanning ${collectionPath}: ${message}`);
    }
  }

  return results;
}

async function scanFormSubcollections(
  db: admin.firestore.Firestore,
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const formsPath = `${orgRoot}/forms`;

  try {
    const formsSnapshot = await db.collection(formsPath).get();
    for (const formDoc of formsSnapshot.docs) {
      if (!isDemoDocument(formDoc.id, formDoc.data() as Record<string, unknown>)) continue;

      // Scan subcollections: fields, submissions, analytics
      for (const sub of ['fields', 'submissions', 'analytics']) {
        const subPath = `${formsPath}/${formDoc.id}/${sub}`;
        try {
          const subSnapshot = await db.collection(subPath).get();
          for (const subDoc of subSnapshot.docs) {
            results.push({
              collection: `forms/${formDoc.id}/${sub}`,
              docId: subDoc.id,
              reason: `child of demo form ${formDoc.id}`,
            });
          }
        } catch {
          // Subcollection doesn't exist
        }
      }
    }
  } catch {
    // Forms collection doesn't exist
  }

  return results;
}

async function scanWorkflowSubcollections(
  db: admin.firestore.Firestore,
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const workflowsPath = `${orgRoot}/workflows`;

  try {
    const snapshot = await db.collection(workflowsPath).get();
    for (const wfDoc of snapshot.docs) {
      if (!isDemoDocument(wfDoc.id, wfDoc.data() as Record<string, unknown>)) continue;

      // Scan executions subcollection
      const execPath = `${workflowsPath}/${wfDoc.id}/executions`;
      try {
        const execSnapshot = await db.collection(execPath).get();
        for (const execDoc of execSnapshot.docs) {
          results.push({
            collection: `workflows/${wfDoc.id}/executions`,
            docId: execDoc.id,
            reason: `child of demo workflow ${wfDoc.id}`,
          });
        }
      } catch {
        // No executions subcollection
      }
    }
  } catch {
    // Workflows collection doesn't exist
  }

  return results;
}

async function deleteDocuments(
  db: admin.firestore.Firestore,
  toDelete: ScanResult[],
): Promise<number> {
  let deleted = 0;
  const BATCH_SIZE = 500;

  // Group by collection path for efficient batch deletes
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const docRef = db.doc(`${orgRoot}/${item.collection}/${item.docId}`);
      batch.delete(docRef);
    }

    await batch.commit();
    deleted += chunk.length;
    console.log(`  Deleted batch: ${deleted}/${toDelete.length}`);
  }

  return deleted;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const executeMode = args.includes('--execute');

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              DEMO DATA CLEANUP SCRIPT                       ║');
  console.log(`║  Mode: ${executeMode ? '🔴 EXECUTE (will DELETE data)' : '🟢 DRY-RUN (safe preview)  '}           ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const db = initFirebase();

  // ── Phase 1: Scan all collections ────────────────────────────────────
  console.log('📍 Scanning org-level collections...');
  const allResults: ScanResult[] = [];

  for (const collection of COLLECTIONS_TO_SCAN) {
    const results = await scanCollection(db, collection);
    if (results.length > 0) {
      console.log(`  ${collection}: ${results.length} demo docs found`);
    }
    allResults.push(...results);
  }

  // ── Phase 1b: Scan top-level collections ─────────────────────────────
  console.log('\n📍 Scanning top-level collections...');
  const topLevelResults: ScanResult[] = [];

  for (const collection of TOP_LEVEL_COLLECTIONS_TO_SCAN) {
    const results = await scanCollection(db, collection, '');
    if (results.length > 0) {
      console.log(`  ${collection} (top-level): ${results.length} demo docs found`);
    }
    topLevelResults.push(...results);
  }

  // ── Phase 2: Scan subcollections ─────────────────────────────────────
  console.log('\n📍 Scanning form subcollections...');
  const formSubs = await scanFormSubcollections(db);
  if (formSubs.length > 0) {
    console.log(`  Form subcollection docs: ${formSubs.length}`);
  }
  allResults.push(...formSubs);

  console.log('\n📍 Scanning workflow subcollections...');
  const workflowSubs = await scanWorkflowSubcollections(db);
  if (workflowSubs.length > 0) {
    console.log(`  Workflow subcollection docs: ${workflowSubs.length}`);
  }
  allResults.push(...workflowSubs);

  // ── Phase 3: Check settings docs ─────────────────────────────────────
  console.log('\n📍 Checking settings/config docs...');
  const settingsToReset: Array<{ path: string; description: string }> = [];
  for (const setting of SETTINGS_DOCS_TO_CHECK) {
    try {
      const doc = await db.doc(setting.path).get();
      if (doc.exists) {
        const data = doc.data() as Record<string, unknown>;
        if (data.isDemo === true || (typeof data.name === 'string' && data.name.includes('(Demo)'))) {
          settingsToReset.push(setting);
          console.log(`  ${setting.description}: DEMO (will delete)`);
        }
      }
    } catch {
      // Doc doesn't exist
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('SCAN SUMMARY');
  console.log('═'.repeat(60));

  // Group by collection for display
  const byColl: Record<string, number> = {};
  for (const r of allResults) {
    const key = r.collection.split('/')[0];
    byColl[key] = (byColl[key] ?? 0) + 1;
  }
  for (const r of topLevelResults) {
    const key = `${r.collection} (top-level)`;
    byColl[key] = (byColl[key] ?? 0) + 1;
  }
  for (const [coll, count] of Object.entries(byColl).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${coll.padEnd(30)} ${count} docs`);
  }
  console.log(`  ${'settings/config'.padEnd(30)} ${settingsToReset.length} docs`);
  console.log(`  ${'─'.repeat(45)}`);
  console.log(`  ${'TOTAL'.padEnd(30)} ${allResults.length + topLevelResults.length + settingsToReset.length} docs`);

  const totalFound = allResults.length + topLevelResults.length + settingsToReset.length;
  if (totalFound === 0) {
    console.log('\n✅ No demo data found. Database is clean.');
    process.exit(0);
  }

  // ── Detailed listing (first 50) ──────────────────────────────────────
  const allDocs = [...allResults, ...topLevelResults];
  console.log('\n📋 Documents to delete (showing first 50):');
  for (const r of allDocs.slice(0, 50)) {
    console.log(`  ${r.collection}/${r.docId}  [${r.reason}]`);
  }
  if (allDocs.length > 50) {
    console.log(`  ... and ${allDocs.length - 50} more`);
  }

  if (!executeMode) {
    console.log('\n🟢 DRY-RUN complete. No data was modified.');
    console.log('   To actually delete, run: npx tsx scripts/nuke-demo-data.ts --execute');
    process.exit(0);
  }

  // ── Execute deletion ─────────────────────────────────────────────────
  console.log('\n🔴 EXECUTING DELETION...');

  // Delete subcollection docs first (children before parents)
  const subcollDocs = allResults.filter(r => r.collection.includes('/'));
  const orgLevelDocs = allResults.filter(r => !r.collection.includes('/'));

  if (subcollDocs.length > 0) {
    console.log(`\n  Deleting ${subcollDocs.length} subcollection docs...`);
    await deleteDocuments(db, subcollDocs);
  }

  if (orgLevelDocs.length > 0) {
    console.log(`\n  Deleting ${orgLevelDocs.length} org-level docs...`);
    await deleteDocuments(db, orgLevelDocs);
  }

  // Delete top-level collection docs (e.g., users — not under orgRoot)
  if (topLevelResults.length > 0) {
    console.log(`\n  Deleting ${topLevelResults.length} top-level collection docs...`);
    const BATCH_SIZE = 500;
    let deleted = 0;
    for (let i = 0; i < topLevelResults.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = topLevelResults.slice(i, i + BATCH_SIZE);
      for (const item of chunk) {
        const docRef = db.doc(`${item.collection}/${item.docId}`);
        batch.delete(docRef);
      }
      await batch.commit();
      deleted += chunk.length;
      console.log(`  Deleted batch: ${deleted}/${topLevelResults.length}`);
    }
  }

  // Delete settings docs
  if (settingsToReset.length > 0) {
    console.log(`\n  Deleting ${settingsToReset.length} settings/config docs...`);
    for (const setting of settingsToReset) {
      await db.doc(setting.path).delete();
      console.log(`    Deleted: ${setting.description}`);
    }
  }

  // ── Verification scan ────────────────────────────────────────────────
  console.log('\n📍 Running verification scan...');
  let remainingCount = 0;
  for (const collection of COLLECTIONS_TO_SCAN) {
    const remaining = await scanCollection(db, collection);
    if (remaining.length > 0) {
      console.log(`  ⚠ ${collection}: ${remaining.length} demo docs STILL EXIST`);
      remainingCount += remaining.length;
    }
  }
  for (const collection of TOP_LEVEL_COLLECTIONS_TO_SCAN) {
    const remaining = await scanCollection(db, collection, '');
    if (remaining.length > 0) {
      console.log(`  ⚠ ${collection} (top-level): ${remaining.length} demo docs STILL EXIST`);
      remainingCount += remaining.length;
    }
  }

  if (remainingCount === 0) {
    console.log('  ✅ Verification passed — zero demo documents remain.');
  } else {
    console.log(`\n  ⚠ ${remainingCount} demo documents still found. May need a second pass.`);
  }

  console.log('\n✅ Cleanup complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
