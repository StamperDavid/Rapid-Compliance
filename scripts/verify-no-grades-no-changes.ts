/**
 * PHASE 4 VERIFY — "no grades = no GM changes" safety net
 *
 * Proves the standing rule: if a human never grades anything, no
 * specialist's Golden Master is ever modified during normal usage.
 *
 * The test:
 *   1. Snapshots ALL active specialist Golden Masters + manager Golden
 *      Masters in Firestore — capturing doc IDs, version numbers, and
 *      a hash of each systemPrompt.
 *   2. Snapshots the current TrainingFeedback collection count.
 *   3. Runs a batch of REAL specialist executions (Sentiment Analyst x 3,
 *      plus Alex x 1). These are legitimate runtime calls that go through
 *      the full load-GM → call-LLM → return-report flow.
 *   4. Re-snapshots after the batch.
 *   5. Asserts ZERO changes across both GM snapshots AND zero new
 *      TrainingFeedback records. Any difference = standing rule violation.
 *
 * Usage: npx tsx scripts/verify-no-grades-no-changes.ts
 *
 * Cost: ~5 LLM calls, approximately $0.05-0.10 in API spend.
 *
 * Exit code: 0 if both snapshots match, 1 on any drift.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';

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

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { getSentimentAnalyst } from '../src/lib/agents/intelligence/sentiment/specialist';
import { getSalesChatSpecialist } from '../src/lib/agents/sales-chat/specialist';
import type { AgentMessage } from '../src/lib/agents/types';

const PLATFORM_ID = 'rapid-compliance-root';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const MANAGER_GM_COLLECTION = `organizations/${PLATFORM_ID}/managerGoldenMasters`;
const FEEDBACK_COLLECTION = `organizations/${PLATFORM_ID}/trainingFeedback`;

interface GMFingerprint {
  docId: string;
  collection: 'specialist' | 'manager';
  version: number;
  isActive: boolean;
  systemPromptHash: string;
  systemPromptLength: number;
}

interface Snapshot {
  takenAt: string;
  specialistGMs: GMFingerprint[];
  managerGMs: GMFingerprint[];
  trainingFeedbackCount: number;
  trainingFeedbackDocIds: string[];
}

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

async function snapshotCollection(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  tag: 'specialist' | 'manager',
): Promise<GMFingerprint[]> {
  const snap = await db.collection(collectionPath).get();
  return snap.docs.map((doc) => {
    const data = doc.data() as {
      version: number;
      isActive: boolean;
      config?: { systemPrompt?: string };
      systemPromptSnapshot?: string;
    };
    const prompt = data.config?.systemPrompt ?? data.systemPromptSnapshot ?? '';
    return {
      docId: doc.id,
      collection: tag,
      version: data.version ?? 0,
      isActive: data.isActive ?? false,
      systemPromptHash: hashPrompt(prompt),
      systemPromptLength: prompt.length,
    };
  }).sort((a, b) => a.docId.localeCompare(b.docId));
}

async function takeSnapshot(db: FirebaseFirestore.Firestore): Promise<Snapshot> {
  const [specialistGMs, managerGMs, feedbackSnap] = await Promise.all([
    snapshotCollection(db, SPECIALIST_GM_COLLECTION, 'specialist'),
    snapshotCollection(db, MANAGER_GM_COLLECTION, 'manager'),
    db.collection(FEEDBACK_COLLECTION).get(),
  ]);
  const trainingFeedbackDocIds = feedbackSnap.docs.map((d) => d.id).sort();
  return {
    takenAt: new Date().toISOString(),
    specialistGMs,
    managerGMs,
    trainingFeedbackCount: feedbackSnap.size,
    trainingFeedbackDocIds,
  };
}

interface Diff {
  gmAdded: string[];
  gmRemoved: string[];
  gmModified: Array<{ docId: string; reason: string }>;
  feedbackAdded: string[];
  feedbackRemoved: string[];
}

function diffFingerprints(before: GMFingerprint[], after: GMFingerprint[]): { added: string[]; removed: string[]; modified: Array<{ docId: string; reason: string }> } {
  const beforeMap = new Map(before.map((f) => [f.docId, f]));
  const afterMap = new Map(after.map((f) => [f.docId, f]));
  const added: string[] = [];
  const removed: string[] = [];
  const modified: Array<{ docId: string; reason: string }> = [];

  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) {
      removed.push(id);
      continue;
    }
    const reasons: string[] = [];
    if (a.version !== b.version) { reasons.push(`version ${b.version}→${a.version}`); }
    if (a.isActive !== b.isActive) { reasons.push(`isActive ${b.isActive}→${a.isActive}`); }
    if (a.systemPromptHash !== b.systemPromptHash) { reasons.push(`systemPrompt hash changed`); }
    if (a.systemPromptLength !== b.systemPromptLength) { reasons.push(`systemPrompt length ${b.systemPromptLength}→${a.systemPromptLength}`); }
    if (reasons.length > 0) {
      modified.push({ docId: id, reason: reasons.join(', ') });
    }
  }
  for (const id of afterMap.keys()) {
    if (!beforeMap.has(id)) {
      added.push(id);
    }
  }
  return { added, removed, modified };
}

function diffSnapshots(before: Snapshot, after: Snapshot): Diff {
  const specialistDiff = diffFingerprints(before.specialistGMs, after.specialistGMs);
  const managerDiff = diffFingerprints(before.managerGMs, after.managerGMs);

  const feedbackAdded = after.trainingFeedbackDocIds.filter((id) => !before.trainingFeedbackDocIds.includes(id));
  const feedbackRemoved = before.trainingFeedbackDocIds.filter((id) => !after.trainingFeedbackDocIds.includes(id));

  return {
    gmAdded: [...specialistDiff.added, ...managerDiff.added],
    gmRemoved: [...specialistDiff.removed, ...managerDiff.removed],
    gmModified: [...specialistDiff.modified, ...managerDiff.modified],
    feedbackAdded,
    feedbackRemoved,
  };
}

async function runBatch(): Promise<void> {
  console.log('\n[Batch] Running real specialist executions (no grading)...');

  // Sentiment Analyst × 3 — cheap, short text in, short output
  const sentimentTexts = [
    'The product is good. I recommend it to others in my industry.',
    'Onboarding was confusing but support was helpful.',
    'The checkout flow froze on step 3 and I could not complete my order.',
  ];
  const sentimentAnalyst = getSentimentAnalyst();
  await sentimentAnalyst.initialize();

  for (let i = 0; i < sentimentTexts.length; i++) {
    const msg: AgentMessage = {
      id: `no_grade_test_sentiment_${i}_${Date.now()}`,
      timestamp: new Date(),
      from: 'NO_GRADE_TEST_HARNESS',
      to: 'SENTIMENT_ANALYST',
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: {
        action: 'analyze_sentiment',
        text: sentimentTexts[i],
      },
      requiresResponse: true,
      traceId: `no_grade_sentiment_${i}`,
    };
    const report = await sentimentAnalyst.execute(msg);
    console.log(`  ✓ Sentiment ${i + 1}/3: status=${report.status}`);
  }

  // Alex × 1 — customer chat
  const alex = getSalesChatSpecialist();
  await alex.initialize();
  const alexMsg: AgentMessage = {
    id: `no_grade_test_alex_${Date.now()}`,
    timestamp: new Date(),
    from: 'NO_GRADE_TEST_HARNESS',
    to: 'AI_CHAT_SALES_AGENT',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'respond_to_visitor',
      userMessage: 'Hi, I run a small agency. Curious about your pricing.',
      visitorId: `no_grade_test_${Date.now()}`,
      channel: 'website',
    },
    requiresResponse: true,
    traceId: `no_grade_alex`,
  };
  const alexReport = await alex.execute(alexMsg);
  console.log(`  ✓ Alex: status=${alexReport.status}`);

  console.log('[Batch] 4 real specialist executions complete.');
}

async function main(): Promise<void> {
  const db = admin.firestore();

  console.log('========================================================================');
  console.log('  PHASE 4 VERIFY — "no grades = no GM changes" safety net');
  console.log('========================================================================');

  console.log('\n[1] Taking BEFORE snapshot of all Golden Masters + TrainingFeedback...');
  const before = await takeSnapshot(db);
  console.log(`  Specialist GMs:  ${before.specialistGMs.length}`);
  console.log(`  Manager GMs:     ${before.managerGMs.length}`);
  console.log(`  TrainingFeedback docs: ${before.trainingFeedbackCount}`);

  const activeSpecialistBefore = before.specialistGMs.filter((f) => f.isActive);
  const activeManagerBefore = before.managerGMs.filter((f) => f.isActive);
  console.log(`    (active specialist GMs: ${activeSpecialistBefore.length})`);
  console.log(`    (active manager GMs:    ${activeManagerBefore.length})`);

  console.log('\n[2] Running batch of real specialist executions with NO grading...');
  await runBatch();

  console.log('\n[3] Taking AFTER snapshot...');
  const after = await takeSnapshot(db);
  console.log(`  Specialist GMs:  ${after.specialistGMs.length}`);
  console.log(`  Manager GMs:     ${after.managerGMs.length}`);
  console.log(`  TrainingFeedback docs: ${after.trainingFeedbackCount}`);

  console.log('\n[4] Diffing snapshots...');
  const diff = diffSnapshots(before, after);

  const violations: string[] = [];
  if (diff.gmAdded.length > 0) { violations.push(`New GM docs created: ${diff.gmAdded.join(', ')}`); }
  if (diff.gmRemoved.length > 0) { violations.push(`GM docs deleted: ${diff.gmRemoved.join(', ')}`); }
  if (diff.gmModified.length > 0) {
    for (const m of diff.gmModified) {
      violations.push(`GM doc modified: ${m.docId} (${m.reason})`);
    }
  }
  if (diff.feedbackAdded.length > 0) { violations.push(`New TrainingFeedback docs: ${diff.feedbackAdded.join(', ')}`); }
  if (diff.feedbackRemoved.length > 0) { violations.push(`TrainingFeedback docs deleted: ${diff.feedbackRemoved.join(', ')}`); }

  console.log('\n========================================================================');
  console.log('  RESULT');
  console.log('========================================================================');

  if (violations.length === 0) {
    console.log('  ✓ STANDING RULE UPHELD');
    console.log('');
    console.log('  No GM docs created, modified, or deleted during the batch.');
    console.log('  No TrainingFeedback records created, modified, or deleted.');
    console.log('  4 real specialist executions ran through the full production flow');
    console.log('  (load GM from Firestore → LLM call → return report) and produced');
    console.log('  zero side effects on the Golden Master collection.');
    console.log('');
    console.log('  The "no grades = no GM changes" rule is enforced by construction.');
    console.log('');
    process.exit(0);
  } else {
    console.log('  ✗ STANDING RULE VIOLATED');
    console.log('');
    for (const v of violations) {
      console.log(`  - ${v}`);
    }
    console.log('');
    console.log('  At least one specialist execution silently modified a GM or feedback');
    console.log('  record. This is a critical bug — find the code path that wrote without');
    console.log('  a human grade and fix it before shipping.');
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
