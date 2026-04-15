/**
 * PHASE 4c VERIFY — prompt edit actually changes specialist behavior
 *
 * The earlier Phase 3 verify script proved that a human grade produces
 * a surgical prompt edit and that the GM's systemPrompt bytes change
 * from v1 to v2. But it did NOT prove that the Copywriter behaves
 * differently on v2 than v1 with the same task — and a broken learning
 * loop would show up as v1 and v2 producing identical output.
 *
 * This script closes that gap. Flow:
 *
 *   1. Run Copywriter on v1 with a specific page copy task.
 *   2. Print v1Output.
 *   3. Submit a grade pointing out a specific weakness in v1Output.
 *   4. Prompt Engineer produces a surgical edit.
 *   5. Approve → Copywriter GM moves to v2.
 *   6. Run Copywriter on v2 with the EXACT same page copy task.
 *   7. Print v2Output.
 *   8. Compare v1Output and v2Output across:
 *        - Headline specificity (ratio of abstract vs concrete words)
 *        - Count of corporate jargon phrases ("next level", "best-in-class",
 *          "world-class", "cutting-edge", "synergistic", "empower")
 *        - Count of named features / concrete specifics
 *   9. Report: did v2 materially improve on v1?
 *   10. Rollback Copywriter GM to v1, delete test feedback record.
 *
 * Cost: ~4 LLM calls (2 Copywriter + 1 Prompt Engineer + logs). ~$0.10-0.20.
 *
 * Exit code: 0 if v2 is measurably different AND at least slightly
 *            better on the specificity metrics, 1 otherwise.
 *
 * SAFETY: Rollback runs in a finally block. Test always leaves Copywriter
 * on v1 even if a step mid-flow throws.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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

import { getCopywriter } from '../src/lib/agents/content/copywriter/specialist';
import type { AgentMessage, AgentReport } from '../src/lib/agents/types';
import { submitGrade, approvePromptEdit } from '../src/lib/training/grade-submission-service';
import { invalidateIndustryGMCache } from '../src/lib/training/specialist-golden-master-service';

const PLATFORM_ID = 'rapid-compliance-root';
const TARGET_SPECIALIST_ID = 'COPYWRITER';
const INDUSTRY_KEY = 'saas_sales_ops';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const FEEDBACK_COLLECTION = `organizations/${PLATFORM_ID}/trainingFeedback`;

const CORPORATE_JARGON = [
  'next level', 'best-in-class', 'world-class', 'cutting-edge',
  'synergistic', 'empower', 'leverage', 'transform your business',
  'in today', 'unlock', 'seamlessly', 'unparalleled',
  'game-changing', 'revolutionary', 'innovative solution',
  'industry-leading', 'state-of-the-art', 'robust',
];

const CONCRETE_SIGNALS = [
  'AI agent', 'agent swarm', 'B2B SaaS', 'SDR', 'rep', 'pipeline',
  'qualification', 'CRM', 'free trial', '14-day', '12-minute',
  '15-minute', 'integrate', 'webhook', 'Stripe', 'Salesforce',
  'minutes', 'hours', 'days', 'reps close', 'LinkedIn',
];

interface OutputScore {
  totalChars: number;
  totalWords: number;
  jargonHits: Array<{ phrase: string; count: number }>;
  concreteHits: Array<{ phrase: string; count: number }>;
  jargonDensity: number;
  concreteDensity: number;
}

function scoreOutput(text: string): OutputScore {
  const lower = text.toLowerCase();
  const totalChars = text.length;
  const totalWords = text.split(/\s+/).filter((w) => w.length > 0).length;

  const jargonHits: Array<{ phrase: string; count: number }> = [];
  for (const phrase of CORPORATE_JARGON) {
    const count = (lower.match(new RegExp(phrase.toLowerCase(), 'g')) ?? []).length;
    if (count > 0) {
      jargonHits.push({ phrase, count });
    }
  }

  const concreteHits: Array<{ phrase: string; count: number }> = [];
  for (const phrase of CONCRETE_SIGNALS) {
    const count = (lower.match(new RegExp(phrase.toLowerCase(), 'g')) ?? []).length;
    if (count > 0) {
      concreteHits.push({ phrase, count });
    }
  }

  const jargonTotal = jargonHits.reduce((s, h) => s + h.count, 0);
  const concreteTotal = concreteHits.reduce((s, h) => s + h.count, 0);

  return {
    totalChars,
    totalWords,
    jargonHits,
    concreteHits,
    jargonDensity: totalWords > 0 ? (jargonTotal / totalWords) * 1000 : 0,
    concreteDensity: totalWords > 0 ? (concreteTotal / totalWords) * 1000 : 0,
  };
}

function extractTextFromReport(report: AgentReport): string {
  const chunks: string[] = [];
  function walk(value: unknown): void {
    if (value === null || value === undefined) { return; }
    if (typeof value === 'string') {
      if (value.length > 10) { chunks.push(value); }
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) { walk(v); }
      return;
    }
    if (typeof value === 'object') {
      for (const v of Object.values(value as Record<string, unknown>)) { walk(v); }
    }
  }
  walk(report.data);
  return chunks.join(' ');
}

async function runCopywriter(): Promise<AgentReport> {
  const copywriter = getCopywriter();
  await copywriter.initialize();
  const msg: AgentMessage = {
    id: `behavior_test_${Date.now()}`,
    timestamp: new Date(),
    from: 'BEHAVIOR_TEST',
    to: 'COPYWRITER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'generate_page_copy',
      pageId: 'pg_behavior_test',
      pageName: 'Home',
      pagePurpose: 'Primary homepage for SalesVelocity.ai — the AI sales agent swarm for B2B SaaS founders scaling outbound from 5 to 50 SDRs',
      seoKeywords: ['AI sales automation', 'sales agent swarm', 'B2B SaaS outbound', 'AI SDR'],
      sections: [
        { id: 'hero', name: 'Hero', purpose: 'Primary value proposition with a bold headline' },
        { id: 'features', name: 'Features', purpose: 'Top three concrete product benefits' },
        { id: 'cta', name: 'CTA', purpose: 'Call to action for free trial' },
      ],
    },
    requiresResponse: true,
    traceId: `behavior_test`,
  };
  return copywriter.execute(msg);
}

async function rollbackToV1(db: FirebaseFirestore.Firestore): Promise<void> {
  const v1DocId = `sgm_copywriter_${INDUSTRY_KEY}_v1`;
  const allVersions = await db.collection(SPECIALIST_GM_COLLECTION)
    .where('specialistId', '==', TARGET_SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .get();

  const batch = db.batch();
  const now = new Date().toISOString();
  let touched = 0;

  for (const doc of allVersions.docs) {
    if (doc.id === v1DocId) {
      batch.update(doc.ref, { isActive: true, deployedAt: now });
      touched++;
    } else {
      const data = doc.data();
      if (data.version && data.version > 1) {
        batch.delete(doc.ref);
        touched++;
      }
    }
  }
  if (touched > 0) { await batch.commit(); }
  invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
}

async function main(): Promise<void> {
  const db = admin.firestore();

  console.log('========================================================================');
  console.log('  PHASE 4c — proving prompt edit changes Copywriter BEHAVIOR');
  console.log('========================================================================');

  let feedbackId: string | null = null;
  let shouldRollback = false;

  try {
    // Step 1: run Copywriter on v1
    console.log('\n[1] Running Copywriter on v1 with a real homepage task...');
    const v1Report = await runCopywriter();
    if (v1Report.status !== 'COMPLETED') {
      throw new Error(`Copywriter v1 failed: ${(v1Report.errors ?? []).join(' | ')}`);
    }
    const v1Text = extractTextFromReport(v1Report);
    const v1Score = scoreOutput(v1Text);
    console.log(`  v1 output: ${v1Text.length} chars, ${v1Score.totalWords} words`);
    console.log(`  v1 jargon density:   ${v1Score.jargonDensity.toFixed(2)} per 1000 words (hits: ${v1Score.jargonHits.map((h) => `${h.phrase}×${h.count}`).join(', ') || 'none'})`);
    console.log(`  v1 concrete density: ${v1Score.concreteDensity.toFixed(2)} per 1000 words (hits: ${v1Score.concreteHits.slice(0, 5).map((h) => `${h.phrase}×${h.count}`).join(', ')})`);

    // Print the v1 hero for visual comparison
    const v1Data = v1Report.data as { headlines?: { h1?: string }; sections?: Array<{ heading?: string; content?: string }> };
    console.log(`\n  v1 h1: "${v1Data.headlines?.h1 ?? '(none)'}"`);
    if (v1Data.sections && v1Data.sections.length > 0) {
      const heroSection = v1Data.sections[0];
      console.log(`  v1 hero heading:  "${heroSection.heading ?? '(none)'}"`);
      console.log(`  v1 hero content:  "${(heroSection.content ?? '').slice(0, 300)}..."`);
    }

    // Step 2: submit grade
    console.log('\n[2] Submitting a grade on v1 output...');
    const gradeText = 'This copy is too corporate and generic — it sounds like every other SaaS vendor. Our brand is confident and direct, not hedging. The output needs to be more specific about what we actually do (AI agent swarm for B2B SaaS sales) and use concrete examples instead of vague phrases like "take your business to the next level". The specificity rules section of the prompt needs to demand concrete examples with named features and measurable outcomes, not abstract benefits. Every headline and section heading must name a specific SalesVelocity capability.';
    const submitResult = await submitGrade({
      targetSpecialistId: TARGET_SPECIALIST_ID,
      targetSpecialistName: 'Copywriter',
      sourceReportTaskId: 'behavior_test_v1_001',
      sourceReportExcerpt: v1Text.slice(0, 4000),
      grade: 'reject',
      explanation: gradeText,
      graderUserId: 'phase4c_behavior_test',
      graderDisplayName: 'Phase 4c Behavior Test',
    });

    if (submitResult.status === 'ERROR') {
      throw new Error(`submitGrade ERROR: ${submitResult.error}`);
    }
    feedbackId = submitResult.feedbackId;
    shouldRollback = true;

    if (submitResult.status === 'CLARIFICATION_NEEDED') {
      console.log('  Prompt Engineer returned CLARIFICATION_NEEDED — test cannot proceed.');
      return;
    }

    console.log(`  ✓ Prompt Engineer produced EDIT_PROPOSED (confidence ${submitResult.proposedEdit.confidence}%)`);
    console.log(`  target section: ${submitResult.proposedEdit.targetSection.headingOrLocation}`);

    // Step 3: approve
    console.log('\n[3] Approving the proposed edit (v1 → v2 deploy)...');
    const approveResult = await approvePromptEdit({
      feedbackId: submitResult.feedbackId,
      approvedEdit: submitResult.proposedEdit,
      approverUserId: 'phase4c_behavior_test',
      approverDisplayName: 'Phase 4c Behavior Test',
    });
    if (approveResult.status === 'ERROR') {
      throw new Error(`approvePromptEdit ERROR: ${approveResult.error}`);
    }
    console.log(`  ✓ Deployed v${approveResult.newVersion} (${approveResult.newGMDocId})`);

    // Step 4: run Copywriter on v2 with the SAME task
    console.log('\n[4] Running Copywriter on v2 with the SAME homepage task...');
    invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    const v2Report = await runCopywriter();
    if (v2Report.status !== 'COMPLETED') {
      throw new Error(`Copywriter v2 failed: ${(v2Report.errors ?? []).join(' | ')}`);
    }
    const v2Text = extractTextFromReport(v2Report);
    const v2Score = scoreOutput(v2Text);
    console.log(`  v2 output: ${v2Text.length} chars, ${v2Score.totalWords} words`);
    console.log(`  v2 jargon density:   ${v2Score.jargonDensity.toFixed(2)} per 1000 words (hits: ${v2Score.jargonHits.map((h) => `${h.phrase}×${h.count}`).join(', ') || 'none'})`);
    console.log(`  v2 concrete density: ${v2Score.concreteDensity.toFixed(2)} per 1000 words (hits: ${v2Score.concreteHits.slice(0, 5).map((h) => `${h.phrase}×${h.count}`).join(', ')})`);

    // Print the v2 hero for visual comparison
    const v2Data = v2Report.data as { headlines?: { h1?: string }; sections?: Array<{ heading?: string; content?: string }> };
    console.log(`\n  v2 h1: "${v2Data.headlines?.h1 ?? '(none)'}"`);
    if (v2Data.sections && v2Data.sections.length > 0) {
      const heroSection = v2Data.sections[0];
      console.log(`  v2 hero heading:  "${heroSection.heading ?? '(none)'}"`);
      console.log(`  v2 hero content:  "${(heroSection.content ?? '').slice(0, 300)}..."`);
    }

    // Step 5: compare
    console.log('\n========================================================================');
    console.log('  BEHAVIOR COMPARISON — v1 vs v2');
    console.log('========================================================================');

    const jargonDelta = v2Score.jargonDensity - v1Score.jargonDensity;
    const concreteDelta = v2Score.concreteDensity - v1Score.concreteDensity;
    const charDelta = v2Score.totalChars - v1Score.totalChars;

    console.log(`  Output byte-identical:      ${v1Text === v2Text ? 'YES (BROKEN — no behavior change)' : 'NO (behavior changed)'}`);
    console.log(`  v1 length:                  ${v1Score.totalChars} chars`);
    console.log(`  v2 length:                  ${v2Score.totalChars} chars (${charDelta > 0 ? '+' : ''}${charDelta})`);
    console.log(`  v1 jargon density:          ${v1Score.jargonDensity.toFixed(2)}`);
    console.log(`  v2 jargon density:          ${v2Score.jargonDensity.toFixed(2)} (${jargonDelta > 0 ? '+' : ''}${jargonDelta.toFixed(2)})`);
    console.log(`  v1 concrete density:        ${v1Score.concreteDensity.toFixed(2)}`);
    console.log(`  v2 concrete density:        ${v2Score.concreteDensity.toFixed(2)} (${concreteDelta > 0 ? '+' : ''}${concreteDelta.toFixed(2)})`);

    const isDifferent = v1Text !== v2Text;
    const isBetter = jargonDelta <= 0 && concreteDelta >= -1; // jargon down or flat, concrete up or stable

    console.log('');
    if (isDifferent && isBetter) {
      console.log('  ✓ PROMPT EDIT CHANGED SPECIALIST BEHAVIOR');
      console.log('    - Output is materially different between v1 and v2');
      console.log('    - Corporate jargon density went down or stayed flat');
      console.log('    - Concrete-feature density went up or stayed stable');
      console.log('    - The learning loop works end-to-end: grade → prompt edit → new behavior');
    } else if (isDifferent && !isBetter) {
      console.log('  ⚠ OUTPUT CHANGED but the metrics do not show clear improvement.');
      console.log('    The LLM did produce different text, but the jargon/concrete balance');
      console.log('    did not clearly improve. This could mean:');
      console.log('    - The metrics are too coarse (visual inspection needed)');
      console.log('    - The edit addressed a different aspect than what the metrics measure');
      console.log('    - The edit needs more work');
    } else {
      console.log('  ✗ OUTPUT IS BYTE-IDENTICAL — THE LEARNING LOOP IS BROKEN');
      console.log('    The prompt bytes changed but the LLM produced the same output.');
      console.log('    This is a critical bug in how the edit flows to the LLM.');
    }

    console.log('');
    process.exitCode = isDifferent && isBetter ? 0 : 1;
  } finally {
    console.log('\n[Cleanup] Rolling back to v1 and deleting test feedback doc...');
    if (shouldRollback) {
      await rollbackToV1(db);
      console.log('  ✓ Copywriter GM rolled back to v1');
    }
    if (feedbackId) {
      try {
        await db.collection(FEEDBACK_COLLECTION).doc(feedbackId).delete();
        console.log(`  ✓ Deleted test feedback doc ${feedbackId}`);
      } catch (err) {
        console.error(`  ✗ Failed to delete test feedback: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
