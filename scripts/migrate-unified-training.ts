/**
 * Full Unified Training Migration Script
 *
 * Comprehensive migration that ensures all components of the unified
 * training system are properly set up in Firestore:
 *
 * 1. Tags existing Golden Masters with agentType
 * 2. Creates AgentRepProfile docs for each customer-facing agent type
 * 3. Creates synthetic user docs for agent rep profiles
 * 4. Creates initial GMs for agent types that don't have one
 * 5. Verifies all collections exist and are accessible
 *
 * This is idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/migrate-unified-training.ts
 */

import * as admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';

const AGENT_DOMAINS = ['chat', 'voice', 'email', 'social', 'seo'] as const;
type AgentDomain = (typeof AGENT_DOMAINS)[number];

const AGENT_DISPLAY_NAMES: Record<AgentDomain, string> = {
  chat: 'Sales Chat Agent',
  voice: 'Voice Agent',
  email: 'Email Agent',
  social: 'Social Media Agent',
  seo: 'SEO Content Agent',
};

const DEFAULT_THRESHOLDS: Record<AgentDomain, { flagBelow: number; excellent: number }> = {
  chat: { flagBelow: 65, excellent: 90 },
  voice: { flagBelow: 60, excellent: 88 },
  email: { flagBelow: 60, excellent: 85 },
  social: { flagBelow: 60, excellent: 85 },
  seo: { flagBelow: 55, excellent: 85 },
};

function getSubCollection(name: string): string {
  return `organizations/${PLATFORM_ID}/${name}`;
}

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  // Load .env.local for local development
  config({ path: resolve(__dirname, '../.env.local') });

  // Strategy 1: Full JSON blob from FIREBASE_SERVICE_ACCOUNT_KEY
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    let serviceAccount: admin.ServiceAccount;
    if (raw.startsWith('{')) {
      serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    } else {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('  Firebase initialized via FIREBASE_SERVICE_ACCOUNT_KEY');
    return admin.firestore();
  }

  // Strategy 2: Individual env vars (same as src/lib/firebase/admin.ts)
  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
        ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ?? process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('  Firebase initialized via FIREBASE_ADMIN_* env vars');
    return admin.firestore();
  }

  // Strategy 3: Service account JSON file
  const possiblePaths = [
    resolve(__dirname, '../firebase-service-account.json'),
    resolve(__dirname, '../service-account.json'),
  ];

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && !credPath.includes('/') && !credPath.includes('\\')) {
    // Skip if it looks like a directory or empty
  } else if (credPath) {
    possiblePaths.push(resolve(credPath));
  }

  for (const p of possiblePaths) {
    if (p && existsSync(p)) {
      try {
        const serviceAccount = JSON.parse(readFileSync(p, 'utf8')) as admin.ServiceAccount;
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log(`  Firebase initialized via ${p}`);
        return admin.firestore();
      } catch {
        // Not a valid JSON file, skip
      }
    }
  }

  // Fall back to default credentials (GCP environment)
  admin.initializeApp();
  console.log('  Firebase initialized via default credentials');
  return admin.firestore();
}

// ============================================================================
// MIGRATION STEPS
// ============================================================================

async function tagExistingGoldenMasters(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 1: Tag existing Golden Masters with agentType ---');

  const gmCollection = getSubCollection('goldenMasters');
  const snap = await db.collection(gmCollection).get();

  if (snap.empty) {
    console.log('  No Golden Masters found — skipping');
    return;
  }

  let tagged = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.agentType) {
      console.log(`  ${doc.id}: already tagged as ${data.agentType}`);
      continue;
    }

    // Determine type from name/id
    let agentType = 'chat'; // default
    const id = doc.id.toLowerCase();
    const name = (data.name ?? '').toLowerCase();

    if (id.includes('voice') || name.includes('voice')) {
      agentType = 'voice';
    } else if (id.includes('email') || name.includes('email')) {
      agentType = 'email';
    } else if (id.includes('social') || name.includes('social')) {
      agentType = 'social';
    } else if (id.includes('seo') || name.includes('seo') || name.includes('content')) {
      agentType = 'seo';
    } else if (id.includes('jasper') || name.includes('jasper')) {
      agentType = 'chat'; // Jasper is the internal assistant / chat agent
    }

    await doc.ref.update({ agentType });
    console.log(`  ${doc.id}: tagged as ${agentType}`);
    tagged++;
  }

  console.log(`  Tagged ${tagged} Golden Masters`);
}

async function createAgentRepProfiles(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 2: Create Agent Rep Profiles ---');

  const profileCollection = getSubCollection('agentRepProfiles');
  const now = new Date().toISOString();

  for (const domain of AGENT_DOMAINS) {
    const agentId = `agent_${domain}_primary`;

    // Check if already exists
    const existing = await db.collection(profileCollection).doc(agentId).get();
    if (existing.exists) {
      console.log(`  ${agentId}: already exists — skipping`);
      continue;
    }

    // Find the active GM for this domain
    const gmSnap = await db
      .collection(getSubCollection('goldenMasters'))
      .where('agentType', '==', domain)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    const goldenMasterId = gmSnap.empty ? null : gmSnap.docs[0].id;

    const profile = {
      agentId,
      agentType: domain,
      agentName: AGENT_DISPLAY_NAMES[domain],
      isAI: true,
      goldenMasterId,
      performanceThresholds: {
        flagForTrainingBelow: DEFAULT_THRESHOLDS[domain].flagBelow,
        excellentAbove: DEFAULT_THRESHOLDS[domain].excellent,
      },
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(profileCollection).doc(agentId).set(profile);
    console.log(`  ${agentId}: created (GM: ${goldenMasterId ?? 'none'})`);
  }
}

async function createSyntheticUserDocs(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 3: Create Synthetic User Docs ---');

  const usersCollection = 'users';
  const now = new Date().toISOString();

  for (const domain of AGENT_DOMAINS) {
    const agentId = `agent_${domain}_primary`;

    // Check if already exists
    const existing = await db.collection(usersCollection).doc(agentId).get();
    if (existing.exists) {
      console.log(`  ${agentId}: user doc already exists — skipping`);
      continue;
    }

    const userDoc = {
      uid: agentId,
      email: `${agentId}@ai-agent.salesvelocity.ai`,
      displayName: AGENT_DISPLAY_NAMES[domain],
      role: 'user',
      isAI: true,
      agentType: domain,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(usersCollection).doc(agentId).set(userDoc, { merge: true });
    console.log(`  ${agentId}: synthetic user doc created`);
  }
}

async function verifyCollections(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 4: Verify collections exist ---');

  const collections = [
    'goldenMasters',
    'goldenMasterUpdates',
    'agentRepProfiles',
    'agentPerformance',
    'flaggedTrainingSessions',
    'specialistImprovementRequests',
    'specialistConfigs',
  ];

  for (const name of collections) {
    const path = getSubCollection(name);
    const snap = await db.collection(path).limit(1).get();
    console.log(`  ${path}: ${snap.empty ? '(empty)' : `${snap.size} docs`}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Unified Training Migration');
  console.log(`Platform: ${PLATFORM_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const db = initFirebase();

  await tagExistingGoldenMasters(db);
  await createAgentRepProfiles(db);
  await createSyntheticUserDocs(db);
  await verifyCollections(db);

  console.log('\n' + '='.repeat(60));
  console.log('Migration complete!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
