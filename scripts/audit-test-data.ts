/**
 * Audit Firestore for test data left behind by today's runs.
 * READ-ONLY — does not delete anything. Used to plan the cleanup.
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

const PLATFORM_ID = 'rapid-compliance-root';
const BASE = `organizations/${PLATFORM_ID}`;
const DEMO_PROTECTED = ['leads']; // collections where some docs may have isDemo=true

interface CountByCategory {
  total: number;
  demo: number;
  nonDemoTestCandidates: number;
  sampleIds: string[];
}

async function countCollection(
  db: FirebaseFirestore.Firestore,
  name: string,
  options: { protectDemo?: boolean; sampleSize?: number } = {},
): Promise<CountByCategory> {
  const protectDemo = options.protectDemo ?? false;
  const sampleSize = options.sampleSize ?? 5;
  const snap = await db.collection(`${BASE}/${name}`).get();
  const result: CountByCategory = {
    total: snap.size,
    demo: 0,
    nonDemoTestCandidates: 0,
    sampleIds: [],
  };
  for (const d of snap.docs) {
    const data = d.data();
    const isDemo = data.isDemo === true;
    if (protectDemo && isDemo) {
      result.demo++;
    } else {
      result.nonDemoTestCandidates++;
      if (result.sampleIds.length < sampleSize) {
        result.sampleIds.push(d.id);
      }
    }
  }
  return result;
}

async function main(): Promise<void> {
  const db = admin.firestore();

  // Collections with potentially mixed demo / test data
  const targets = [
    { name: 'missions', protectDemo: false },
    { name: 'orchestratorMissions', protectDemo: false }, // legacy / wrong path
    { name: 'workflows', protectDemo: false },
    { name: 'workflowSequenceJobs', protectDemo: false },
    { name: 'workflowExecutions', protectDemo: false },
    { name: 'workflowEvents', protectDemo: false },
    { name: 'scheduleTriggers', protectDemo: false },
    { name: 'campaigns', protectDemo: false },
    { name: 'leads', protectDemo: true },
    { name: 'blogPosts', protectDemo: false },
    { name: 'socialPosts', protectDemo: false },
    { name: 'emailCampaigns', protectDemo: false },
    { name: 'sequences', protectDemo: false },
    { name: 'sequenceEnrollments', protectDemo: false },
    { name: 'video_pipeline_projects', protectDemo: false },
    { name: 'scene_previews', protectDemo: false },
    { name: 'missionGrades', protectDemo: false },
    { name: 'trainingFeedback', protectDemo: false },
    { name: 'conversations', protectDemo: false },
    { name: 'contentPackages', protectDemo: false },
  ];

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Firestore test-data audit (READ-ONLY)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`base path: ${BASE}\n`);

  let grandTestCandidates = 0;
  let grandDemo = 0;
  for (const t of targets) {
    try {
      const r = await countCollection(db, t.name, { protectDemo: t.protectDemo });
      grandTestCandidates += r.nonDemoTestCandidates;
      grandDemo += r.demo;
      const sampleSuffix = r.sampleIds.length > 0 ? `  e.g. ${r.sampleIds.slice(0, 3).join(', ')}` : '';
      const demoSuffix = t.protectDemo ? `  (preserved demo: ${r.demo})` : '';
      console.log(
        `  ${t.name.padEnd(28)}  total=${String(r.total).padStart(5)}  candidates=${String(r.nonDemoTestCandidates).padStart(5)}${demoSuffix}${sampleSuffix}`,
      );
    } catch (err) {
      console.log(`  ${t.name.padEnd(28)}  ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nTotal test-data candidates: ${grandTestCandidates}`);
  console.log(`Demo data preserved:        ${grandDemo}`);
  console.log('\nNothing has been deleted. Run cleanup script to delete after review.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
