/**
 * Seed SalesVelocity.ai Feature Config & Entity Config
 *
 * Sets up the correct feature_config and entity_config for SalesVelocity.ai
 * as a technology_saas company. This ensures only relevant features and
 * industry entities appear in the sidebar.
 *
 * Usage: npx tsx scripts/seed-platform-config.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const SEED_USER_ID = 'system-seed';
const INDUSTRY_CATEGORY = 'technology_saas';

// Firestore paths
const settingsCollection = `organizations/${PLATFORM_ID}/settings`;

// ============================================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  let serviceAccount: admin.ServiceAccount | undefined;

  // Strategy 1: FIREBASE_SERVICE_ACCOUNT_KEY env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (raw.startsWith('{')) {
      serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    } else {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
    }
  }

  // Strategy 2: Individual env vars
  if (!serviceAccount && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
        ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ?? 'rapid-compliance-65f87',
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
  }

  // Strategy 3: serviceAccountKey.json
  if (!serviceAccount) {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
      console.log('  Using serviceAccountKey.json');
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ?? process.env.FIREBASE_PROJECT_ID
    ?? 'rapid-compliance-65f87';

  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
  } else {
    console.warn('  No Firebase credentials found, using project ID only');
    admin.initializeApp({ projectId });
  }

  return admin.firestore();
}

// ============================================================================
// FEATURE CONFIG — SalesVelocity.ai (Technology & SaaS)
//
// SalesVelocity.ai is a SaaS platform company. It uses almost everything
// EXCEPT e-commerce (no online storefront selling physical products).
// ============================================================================

const featureConfig = {
  modules: {
    crm_pipeline: true,        // Core CRM — always on
    sales_automation: true,    // AI coaching, playbooks, risk detection
    email_outreach: true,      // Campaigns, sequences, email studio
    social_media: true,        // Social scheduling & analytics
    ecommerce: false,          // NOT an online store — no storefront needed
    website_builder: true,     // Website & SEO tools
    video_production: true,    // AI video creation
    forms_surveys: true,       // Lead capture forms
    proposals_docs: true,      // Proposal builder
    advanced_analytics: true,  // A/B testing
    workflows: true,           // Automation workflows
    conversations: true,       // AI chat
  },
  updatedAt: new Date().toISOString(),
  updatedBy: SEED_USER_ID,
};

// ============================================================================
// ENTITY CONFIG — Technology & SaaS industry defaults
//
// CRM Extended entities are ON (quotes, invoices, payments, products, orders).
// Industry entities: only projects, time_entries, customers (technology_saas).
// All other industry entities (drivers, vehicles, properties, etc.) are OFF.
// ============================================================================

// CRM Extended — always on for any business
const crmExtended: Record<string, boolean> = {
  products: true,
  quotes: true,
  invoices: true,
  payments: true,
  orders: true,
};

// Industry-specific — only technology_saas defaults enabled
const industryEntities: Record<string, boolean> = {
  // Technology & SaaS defaults (ON)
  projects: true,
  time_entries: true,
  customers: true,
  // All others OFF
  drivers: false,
  vehicles: false,
  compliance_documents: false,
  inventory: false,
  properties: false,
  showings: false,
  cases: false,
  billing_entries: false,
  patients: false,
  appointments: false,
};

const entityConfig = {
  entities: { ...crmExtended, ...industryEntities },
  industryCategory: INDUSTRY_CATEGORY,
  updatedAt: new Date().toISOString(),
  updatedBy: SEED_USER_ID,
};

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n  Seeding SalesVelocity.ai Platform Configuration\n');
  console.log(`  Industry: ${INDUSTRY_CATEGORY}`);
  console.log(`  Org: ${PLATFORM_ID}\n`);

  const db = initFirebase();

  // 1. Write feature_config
  console.log('  [1/3] Writing feature_config...');
  await db.doc(`${settingsCollection}/feature_config`).set(featureConfig);

  const enabledModules = Object.entries(featureConfig.modules)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const disabledModules = Object.entries(featureConfig.modules)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  console.log(`        ON:  ${enabledModules.join(', ')}`);
  console.log(`        OFF: ${disabledModules.join(', ')}`);

  // 2. Write entity_config
  console.log('  [2/3] Writing entity_config...');
  await db.doc(`${settingsCollection}/entity_config`).set(entityConfig);

  const enabledEntities = Object.entries(entityConfig.entities)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const disabledEntities = Object.entries(entityConfig.entities)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  console.log(`        ON:  ${enabledEntities.join(', ')}`);
  console.log(`        OFF: ${disabledEntities.join(', ')}`);

  // 3. Verify
  console.log('  [3/3] Verifying...');
  const fcSnap = await db.doc(`${settingsCollection}/feature_config`).get();
  const ecSnap = await db.doc(`${settingsCollection}/entity_config`).get();
  console.log(`        feature_config: ${fcSnap.exists ? 'OK' : 'MISSING'}`);
  console.log(`        entity_config: ${ecSnap.exists ? 'OK' : 'MISSING'}`);

  console.log('\n  Platform configuration seeded successfully!\n');
  console.log('  What changed:');
  console.log('  - E-Commerce section will be hidden from sidebar');
  console.log('  - Only Projects, Time Entries, Customers show in Records');
  console.log('  - All other industry entities (legal, medical, etc.) hidden');
  console.log('  - Feature toggles can be changed at /settings/features\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
