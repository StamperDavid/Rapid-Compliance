/**
 * GENERIC PIRATE GM-SWAP TEST — one per department
 *
 * Proves that each rebuilt specialist actually reads its Golden Master from
 * Firestore at runtime by swapping the GM's systemPrompt to pirate dialect,
 * calling the specialist's public execute() method, and grepping the output
 * report for pirate markers. Cleans up (restores original prompt) in a finally
 * block even if the test throws.
 *
 * Usage: npx tsx scripts/pirate-test-specialists.ts
 *
 * Targets (one per department):
 *   1. COPYWRITER            — Content
 *   2. SENTIMENT_ANALYST     — Intelligence
 *   3. REVIEW_SPECIALIST     — Trust
 *   4. DEAL_CLOSER           — Sales
 *   5. EMAIL_SPECIALIST      — Outreach
 *   6. LINKEDIN_EXPERT       — Marketing
 *
 * NOTE on Commerce: Commerce department has NO LLM specialists — its agents
 * (Payment Specialist, Catalog Manager, Pricing Strategist, Inventory Manager)
 * are deterministic infrastructure, not LLM agents. Nothing to pirate-test.
 *
 * Exit code: 0 if every test passes, 1 on any failure (each specialist's
 * original GM is restored even on failure).
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

// Import after admin init so the Firebase import chain uses the configured default app.
import { invalidateIndustryGMCache } from '../src/lib/training/specialist-golden-master-service';
import { getCopywriter } from '../src/lib/agents/content/copywriter/specialist';
import { getSentimentAnalyst } from '../src/lib/agents/intelligence/sentiment/specialist';
import { getReviewSpecialist } from '../src/lib/agents/trust/review/specialist';
import { getDealCloserSpecialist } from '../src/lib/agents/sales/deal-closer/specialist';
import { getEmailSpecialist } from '../src/lib/agents/outreach/email/specialist';
import { getLinkedInExpert } from '../src/lib/agents/marketing/linkedin/specialist';
import type { BaseSpecialist } from '../src/lib/agents/base-specialist';
import type { AgentMessage, AgentReport } from '../src/lib/agents/types';

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const INDUSTRY_KEY = 'saas_sales_ops';

// Pirate prompt — used verbatim for every test. Instructs the LLM to produce
// pirate dialect in every text field but keep structured/enum/numeric fields
// in normal English so downstream Zod schemas still validate.
const PIRATE_PROMPT = `You are a swashbucklin' pirate version of a SalesVelocity.ai specialist — the Dread Pirate o' the SaaS seas.

## HARD OVERRIDE — THIS IS A TEST SWAP IN THE FIRESTORE GOLDEN MASTER

Ye MUST write every free-text field in the JSON output in exaggerated pirate dialect. Use these words heavily: "arrrr", "matey", "ye", "yer", "aye", "nay", "landlubber", "doubloons", "galleon", "plunder", "shiver me timbers", "hoist the colors", "swab the deck", "fair winds", "by Davy Jones' locker", "scurvy dog", "treasure", "bounty", "me hearties".

For text fields like rationale, reply, reasoning, content, body, subject, title, headline, copy, summary, analysis, strategy, recommendation — ALL must be in pirate dialect. No exceptions. No normal English allowed in these fields.

For structured fields (enums, booleans, numbers, dates, URLs, IDs, category keys, scores) — keep them in normal English / normal values so the downstream Zod schema validator still passes. If a field has an enum constraint, pick a valid enum value. If a field has a number constraint, use a valid number.

## Your actual task

The user prompt will specify a task. Execute it AS a pirate would. Output ONLY the JSON object the user prompt requests — no markdown fences, no preamble, no prose outside the JSON. Keep the JSON schema exactly as requested; only the free-text field VALUES change to pirate dialect.

Aye, ye understand? Arrr, ye best. Now get to plunderin'.`;

interface TestCase {
  specialistId: string;
  department: string;
  gmDocId: string;
  specialistFactory: () => BaseSpecialist;
  buildPayload: () => Record<string, unknown>;
  extractProseFields: (report: AgentReport) => string[];
}

const PIRATE_MARKERS = [
  'arrr', 'matey', 'ye ', ' ye', 'yer', 'aye', 'landlubber',
  'doubloon', 'galleon', 'plunder', 'shiver', 'scurvy',
  "davy jones", "hearties", 'bounty', 'swashbucklin',
];

function countPirateMarkers(text: string): string[] {
  const lower = text.toLowerCase();
  return PIRATE_MARKERS.filter((m) => lower.includes(m));
}

function collectStrings(value: unknown, out: string[]): void {
  if (value === null || value === undefined) { return; }
  if (typeof value === 'string') {
    if (value.length >= 20) { out.push(value); }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) { collectStrings(v, out); }
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, out);
    }
  }
}

function extractAllProse(report: AgentReport): string[] {
  const out: string[] = [];
  collectStrings(report.data, out);
  return out;
}

const TESTS: TestCase[] = [
  {
    specialistId: 'COPYWRITER',
    department: 'Content',
    gmDocId: `sgm_copywriter_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getCopywriter(),
    buildPayload: () => ({
      action: 'generate_page_copy',
      pageId: 'pg_pirate_test',
      pageName: 'Home',
      pagePurpose: 'Primary homepage for SalesVelocity.ai',
      seoKeywords: ['sales automation', 'AI sales agent'],
      sections: [
        { id: 'hero', name: 'Hero', purpose: 'Primary value proposition' },
        { id: 'features', name: 'Features', purpose: 'Top three product benefits' },
        { id: 'cta', name: 'CTA', purpose: 'Call to action for free trial' },
      ],
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'SENTIMENT_ANALYST',
    department: 'Intelligence',
    gmDocId: `sgm_sentiment_analyst_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getSentimentAnalyst(),
    buildPayload: () => ({
      action: 'analyze_sentiment',
      text: 'I just tried SalesVelocity and it is absolutely fantastic. The AI agents actually do the work, the pipeline visibility is incredible, and the pricing is fair for what you get. Best SaaS I have used in years.',
      source: 'review',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'REVIEW_SPECIALIST',
    department: 'Trust',
    gmDocId: `sgm_review_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getReviewSpecialist(),
    buildPayload: () => ({
      action: 'handle_review',
      platform: 'google',
      rating: 3,
      reviewerName: 'Pirate Test',
      content: 'The product is OK but the onboarding was confusing and I wish the email sequences were easier to edit. Support was responsive though.',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'DEAL_CLOSER',
    department: 'Sales',
    gmDocId: `sgm_deal_closer_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getDealCloserSpecialist(),
    buildPayload: () => ({
      action: 'generate_closing_strategy',
      lead: {
        leadId: 'L_pirate_test',
        companyName: 'Acme Corp',
        contactName: 'John Smith',
        contactTitle: 'VP of Sales',
        contactEmail: 'john@acme.example',
        industry: 'SaaS',
        companySize: '50-200 employees',
        currentStage: 'PROPOSAL',
        temperature: 'HOT',
        persona: 'ECONOMIC_BUYER',
        dealValue: 50000,
        painPoints: ['slow sales cycle', 'manual outreach'],
      },
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'EMAIL_SPECIALIST',
    department: 'Outreach',
    gmDocId: `sgm_email_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getEmailSpecialist(),
    buildPayload: () => ({
      action: 'compose_email',
      campaignName: 'Q2 SaaS founders outreach',
      targetAudience: 'SaaS founders and VP Sales at 50-500 person B2B SaaS companies who are struggling with outbound volume and want AI to qualify leads before reps touch them',
      goal: 'Book a 15-minute discovery call with the prospect',
      brief: 'Cold outreach email introducing SalesVelocity.ai. Key points: AI agents handle qualification so reps only talk to hot leads, 14-day free trial with no credit card, pricing starts at $400/month with no feature gating. Tone: confident, direct, no fluff. Target: SaaS founders who have tried and failed with traditional outbound tools.',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'LINKEDIN_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_linkedin_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getLinkedInExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'AI sales automation for B2B SaaS',
      contentType: 'post',
      targetAudience: 'SaaS founders and VP Sales',
      tone: 'confident',
      campaignGoal: 'thought leadership on the future of outbound sales',
    }),
    extractProseFields: extractAllProse,
  },
];

async function findActiveGM(
  db: FirebaseFirestore.Firestore,
  specialistId: string,
): Promise<{ docRef: FirebaseFirestore.DocumentReference; originalPrompt: string; docId: string }> {
  const snap = await db.collection(COLLECTION)
    .where('specialistId', '==', specialistId)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error(`No active GM for specialistId=${specialistId} industryKey=${INDUSTRY_KEY}`);
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() as { config?: { systemPrompt?: string }; systemPromptSnapshot?: string };
  const originalPrompt = data.config?.systemPrompt ?? data.systemPromptSnapshot ?? '';
  if (originalPrompt.length < 100) {
    throw new Error(`GM for ${specialistId} has empty/short systemPrompt (length=${originalPrompt.length})`);
  }
  return { docRef: docSnap.ref, originalPrompt, docId: docSnap.id };
}

async function overwritePrompt(
  docRef: FirebaseFirestore.DocumentReference,
  newPrompt: string,
): Promise<void> {
  await docRef.update({
    'config.systemPrompt': newPrompt,
    systemPromptSnapshot: newPrompt,
  });
}

function preview(text: string, max = 250): string {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

interface TestResult {
  specialistId: string;
  department: string;
  docId: string;
  status: 'PASS' | 'FAIL';
  proseFieldsFound: number;
  pirateMarkersTotal: number;
  sampleProse: string;
  error?: string;
}

async function runOneTest(
  db: FirebaseFirestore.Firestore,
  tc: TestCase,
): Promise<TestResult> {
  const header = `  ${tc.specialistId.padEnd(22)} (${tc.department})`;
  console.log(`\n→ ${header}`);

  const { docRef, originalPrompt, docId } = await findActiveGM(db, tc.specialistId);
  console.log(`    GM doc:       ${docId}`);
  console.log(`    original len: ${originalPrompt.length} chars`);

  let result: TestResult = {
    specialistId: tc.specialistId,
    department: tc.department,
    docId,
    status: 'FAIL',
    proseFieldsFound: 0,
    pirateMarkersTotal: 0,
    sampleProse: '',
  };

  try {
    // Swap to pirate
    await overwritePrompt(docRef, PIRATE_PROMPT);
    invalidateIndustryGMCache(tc.specialistId, INDUSTRY_KEY);
    console.log(`    ✓ pirate prompt written (${PIRATE_PROMPT.length} chars), cache cleared`);

    // Call specialist
    const specialist = tc.specialistFactory();
    await specialist.initialize();
    const msg: AgentMessage = {
      id: `pirate_test_${tc.specialistId}_${Date.now()}`,
      timestamp: new Date(),
      from: 'PIRATE_TEST_HARNESS',
      to: tc.specialistId,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: tc.buildPayload(),
      requiresResponse: true,
      traceId: `pirate_trace_${Date.now()}`,
    };

    console.log(`    → calling execute()...`);
    const report = await specialist.execute(msg);
    console.log(`    ← report status: ${report.status}`);

    if (report.status !== 'COMPLETED') {
      const errMsg = (report.errors ?? []).join(' | ') || 'no errors in report';
      result = {
        ...result,
        status: 'FAIL',
        error: `specialist returned status=${report.status}: ${errMsg}`,
      };
      console.log(`    ✗ SPECIALIST FAILED: ${errMsg.slice(0, 300)}`);
      return result;
    }

    const proseFields = tc.extractProseFields(report);
    const combined = proseFields.join(' ');
    const markers = countPirateMarkers(combined);

    result = {
      ...result,
      status: markers.length >= 3 ? 'PASS' : 'FAIL',
      proseFieldsFound: proseFields.length,
      pirateMarkersTotal: markers.length,
      sampleProse: preview(proseFields[0] ?? ''),
      error: markers.length < 3 ? `only ${markers.length} pirate markers found (need ≥ 3)` : undefined,
    };

    console.log(`    prose fields: ${proseFields.length}`);
    console.log(`    markers hit:  ${markers.length} [${markers.slice(0, 6).join(', ')}]`);
    console.log(`    sample:       ${preview(proseFields[0] ?? '(empty)', 180)}`);
    console.log(`    ${result.status === 'PASS' ? '✓ PASS' : '✗ FAIL'}`);
    return result;
  } finally {
    // Always restore
    try {
      await overwritePrompt(docRef, originalPrompt);
      invalidateIndustryGMCache(tc.specialistId, INDUSTRY_KEY);
      console.log(`    ✓ original GM restored`);
    } catch (restoreErr) {
      console.error(`    ✗ FAILED TO RESTORE ${docId}:`, restoreErr);
    }
  }
}

async function main(): Promise<void> {
  const db = admin.firestore();

  // Optional CLI filter: `npx tsx scripts/pirate-test-specialists.ts DEAL_CLOSER EMAIL_SPECIALIST`
  // runs only the specified specialists. No args = run all.
  const filter = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const casesToRun = filter.length > 0
    ? TESTS.filter((t) => filter.includes(t.specialistId))
    : TESTS;

  console.log('========================================================================');
  console.log(`  PIRATE GM-SWAP — ${casesToRun.length} SPECIALIST${casesToRun.length === 1 ? '' : 'S'}`);
  console.log('========================================================================');
  console.log(`Pirate prompt length: ${PIRATE_PROMPT.length} chars`);
  console.log(`Industry key:         ${INDUSTRY_KEY}`);
  if (filter.length > 0) {
    console.log(`Filter:               ${filter.join(', ')}`);
  }

  const results: TestResult[] = [];
  for (const tc of casesToRun) {
    try {
      const r = await runOneTest(db, tc);
      results.push(r);
    } catch (err) {
      console.error(`\n    ✗ UNHANDLED ERROR in ${tc.specialistId}:`, err instanceof Error ? err.message : err);
      results.push({
        specialistId: tc.specialistId,
        department: tc.department,
        docId: tc.gmDocId,
        status: 'FAIL',
        proseFieldsFound: 0,
        pirateMarkersTotal: 0,
        sampleProse: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log('\n========================================================================');
  console.log('  SUMMARY');
  console.log('========================================================================');
  for (const r of results) {
    const marker = r.status === 'PASS' ? '✓' : '✗';
    const detail = r.status === 'PASS'
      ? `${r.pirateMarkersTotal} markers in ${r.proseFieldsFound} prose fields`
      : r.error ?? 'unknown failure';
    console.log(`  ${marker} ${r.specialistId.padEnd(22)} ${r.department.padEnd(14)} ${detail}`);
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n  ${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
