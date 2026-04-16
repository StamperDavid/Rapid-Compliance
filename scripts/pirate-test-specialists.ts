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
import { getMusicPlanner } from '../src/lib/agents/content/music/specialist';
import { getBlogWriter } from '../src/lib/agents/content/blog/specialist';
import { getPodcastSpecialist } from '../src/lib/agents/content/podcast/specialist';
import { getYouTubeExpert } from '../src/lib/agents/marketing/youtube/specialist';
import { getInstagramExpert } from '../src/lib/agents/marketing/instagram/specialist';
import { getPinterestExpert } from '../src/lib/agents/marketing/pinterest/specialist';
import { getCompetitorResearcher } from '../src/lib/agents/intelligence/competitor/specialist';
import { getScraperSpecialist } from '../src/lib/agents/intelligence/scraper/specialist';
import { getTechnographicScout } from '../src/lib/agents/intelligence/technographic/specialist';
import { getTrendScout } from '../src/lib/agents/intelligence/trend/specialist';
import { getLeadQualifierSpecialist } from '../src/lib/agents/sales/qualifier/specialist';
import { getMerchandiserSpecialist } from '../src/lib/agents/sales/merchandiser/specialist';
import { getObjectionHandlerSpecialist } from '../src/lib/agents/sales/objection-handler/specialist';
import { getOutreachSpecialist } from '../src/lib/agents/sales/outreach/specialist';
import { getInventoryManagerSpecialist } from '../src/lib/agents/commerce/inventory/specialist';
import { getReviewManagerSpecialist } from '../src/lib/agents/trust/review-manager/specialist';
import { getGMBSpecialist } from '../src/lib/agents/trust/gmb/specialist';
import { getCaseStudyBuilderSpecialist } from '../src/lib/agents/trust/case-study/specialist';
import { getGrowthStrategist } from '../src/lib/agents/growth-strategist/specialist';
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
  // ═══════════════════════════════════════════════════════════════════
  // NEW SPECIALISTS (built April 15, 2026 session)
  // ═══════════════════════════════════════════════════════════════════
  {
    specialistId: 'MUSIC_PLANNER',
    department: 'Content',
    gmDocId: `sgm_music_planner_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getMusicPlanner(),
    buildPayload: () => ({
      action: 'plan_soundtrack',
      projectDescription: 'A 60-second product demo video for SalesVelocity.ai showing the AI agent swarm delegating tasks across departments. Target audience: SaaS founders. Mood: energetic, confident, modern. Visual style: dark UI with blue accent highlights, screen recordings, animated data visualizations.',
      targetAudience: 'SaaS founders and VP Sales at B2B companies',
      mood: 'energetic and confident',
      videoDurationSeconds: 60,
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'BLOG_WRITER',
    department: 'Content',
    gmDocId: `sgm_blog_writer_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getBlogWriter(),
    buildPayload: () => ({
      action: 'outline_blog_post',
      topic: 'How AI Sales Agents Are Replacing Traditional SDR Teams in 2026',
      targetKeywords: ['AI sales agent', 'SDR automation', 'AI outbound'],
      audience: 'SaaS founders considering AI-powered sales',
      wordCountTarget: 2000,
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'PODCAST_SPECIALIST',
    department: 'Content',
    gmDocId: `sgm_podcast_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getPodcastSpecialist(),
    buildPayload: () => ({
      action: 'plan_episode',
      topic: 'The Death of Cold Calling: How AI Agents Are Rewriting Outbound Sales',
      targetAudience: 'SaaS founders and sales leaders',
      episodeFormat: 'solo',
      durationMinutes: 25,
      brandVoice: 'confident, data-driven, slightly provocative',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'YOUTUBE_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_youtube_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getYouTubeExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'SalesVelocity.ai product walkthrough — how AI agents run your sales pipeline',
      contentType: 'tutorial',
      targetAudience: 'SaaS founders evaluating AI sales tools',
      tone: 'confident and educational',
      campaignGoal: 'drive free trial signups from YouTube',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'INSTAGRAM_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_instagram_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getInstagramExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'AI agents handling your sales pipeline while you focus on strategy',
      contentType: 'carousel',
      targetAudience: 'Entrepreneurs and small business owners on Instagram',
      tone: 'modern, visual, punchy',
      campaignGoal: 'brand awareness for SalesVelocity.ai',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'PINTEREST_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_pinterest_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getPinterestExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'AI-powered sales automation infographic — how the agent swarm works',
      contentType: 'infographic',
      targetAudience: 'Business owners searching for sales tools on Pinterest',
      tone: 'clean, data-rich, visually scannable',
      campaignGoal: 'drive traffic to SalesVelocity.ai landing page',
    }),
    extractProseFields: extractAllProse,
  },
  // ═══════════════════════════════════════════════════════════════════
  // REMAINING UNVERIFIED SPECIALISTS (13 agents, never pirate-tested)
  // ═══════════════════════════════════════════════════════════════════
  {
    specialistId: 'COMPETITOR_RESEARCHER',
    department: 'Intelligence',
    gmDocId: `sgm_competitor_researcher_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getCompetitorResearcher(),
    buildPayload: () => ({
      action: 'research_competitors',
      targets: ['hubspot.com'],
      researchDepth: 'standard',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'SCRAPER_SPECIALIST',
    department: 'Intelligence',
    gmDocId: `sgm_scraper_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getScraperSpecialist(),
    buildPayload: () => ({
      action: 'analyze_scrape',
      url: 'https://example.com',
      scrapedContent: 'Example Corp is a B2B SaaS company offering project management tools for teams of 10-500. Founded in 2020. Pricing: $20/user/month. Key features: Kanban boards, time tracking, invoicing.',
      analysisGoal: 'Extract competitive positioning and pricing strategy',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'TECHNOGRAPHIC_SCOUT',
    department: 'Intelligence',
    gmDocId: `sgm_technographic_scout_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getTechnographicScout(),
    buildPayload: () => ({
      action: 'analyze_tech_stack',
      url: 'https://example.com',
      detectedTechnologies: ['Next.js', 'React', 'Stripe', 'Google Analytics', 'HubSpot'],
      analysisGoal: 'Assess technology maturity and integration opportunities',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'TREND_SCOUT',
    department: 'Intelligence',
    gmDocId: `sgm_trend_scout_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getTrendScout(),
    buildPayload: () => ({
      action: 'scan_signals',
      industry: 'B2B SaaS',
      topics: ['AI sales automation', 'autonomous agents', 'LLM-powered workflows'],
      timeframe: '30 days',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'LEAD_QUALIFIER',
    department: 'Sales',
    gmDocId: `sgm_lead_qualifier_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getLeadQualifierSpecialist(),
    buildPayload: () => ({
      action: 'qualify_lead',
      lead: {
        name: 'Jane Smith',
        title: 'VP of Sales',
        company: 'TechCorp',
        industry: 'SaaS',
        companySize: '100-500',
        inboundSource: 'demo request form',
        notes: 'Expressed frustration with current CRM and wants AI-powered automation.',
      },
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'MERCHANDISER',
    department: 'Sales',
    gmDocId: `sgm_merchandiser_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getMerchandiserSpecialist(),
    buildPayload: () => ({
      action: 'evaluate_nudge',
      visitor: {
        visitorId: 'v_pirate_test',
        currentPage: '/pricing',
        timeOnPage: 45,
        scrollDepth: 0.7,
        previousPages: ['/features', '/about'],
        sessionDuration: 180,
      },
      products: [
        { id: 'starter', name: 'Starter Plan', price: 400, category: 'subscription' },
        { id: 'pro', name: 'Professional Plan', price: 800, category: 'subscription' },
      ],
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'OBJECTION_HANDLER',
    department: 'Sales',
    gmDocId: `sgm_objection_handler_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getObjectionHandlerSpecialist(),
    buildPayload: () => ({
      action: 'handle_objection',
      objection: 'We already have HubSpot and switching would be too expensive and disruptive.',
      context: {
        leadName: 'John Smith',
        company: 'Acme Corp',
        industry: 'SaaS',
        dealStage: 'NEGOTIATION',
        dealValue: 30000,
        competitorMentioned: 'HubSpot',
      },
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'OUTREACH_SPECIALIST',
    department: 'Sales',
    gmDocId: `sgm_outreach_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getOutreachSpecialist(),
    buildPayload: () => ({
      action: 'generate_outreach',
      lead: {
        name: 'Sarah Chen',
        title: 'Head of Revenue',
        company: 'GrowthCo',
        industry: 'B2B SaaS',
        companySize: '50-200',
      },
      goal: 'Book a 15-minute discovery call about AI sales automation',
      channel: 'email',
      tone: 'confident and direct',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'INVENTORY_MANAGER',
    department: 'Commerce',
    gmDocId: `sgm_inventory_manager_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getInventoryManagerSpecialist(),
    buildPayload: () => ({
      action: 'stock_analysis',
      products: [
        { id: 'prod1', name: 'Widget A', currentStock: 150, avgDailySales: 12, reorderPoint: 50 },
        { id: 'prod2', name: 'Widget B', currentStock: 20, avgDailySales: 8, reorderPoint: 30 },
      ],
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'REVIEW_MANAGER',
    department: 'Trust',
    gmDocId: `sgm_review_manager_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getReviewManagerSpecialist(),
    buildPayload: () => ({
      action: 'analyze_reviews',
      reviews: [
        { platform: 'google', rating: 5, text: 'Amazing product, saved our sales team 20 hours per week.', date: '2026-03-15' },
        { platform: 'google', rating: 2, text: 'Onboarding was confusing, took 3 weeks to get value.', date: '2026-03-20' },
        { platform: 'g2', rating: 4, text: 'Great AI features but the pricing page is unclear.', date: '2026-04-01' },
      ],
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'GMB_SPECIALIST',
    department: 'Trust',
    gmDocId: `sgm_gmb_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getGMBSpecialist(),
    buildPayload: () => ({
      action: 'audit_profile',
      businessName: 'SalesVelocity AI',
      category: 'Software company',
      currentDescription: 'AI-powered sales automation platform.',
      hoursSet: true,
      photosCount: 5,
      reviewCount: 23,
      avgRating: 4.2,
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'CASE_STUDY_BUILDER',
    department: 'Trust',
    gmDocId: `sgm_case_study_builder_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getCaseStudyBuilderSpecialist(),
    buildPayload: () => ({
      action: 'build_case_study',
      clientName: 'GrowthCo',
      industry: 'B2B SaaS',
      challenge: 'GrowthCo was manually qualifying 500 inbound leads per month with 4 SDRs. Response time averaged 18 hours. 60% of qualified leads went cold before first contact.',
      solution: 'Deployed SalesVelocity.ai AI agent swarm: Lead Qualifier for instant BANT scoring, Email Specialist for same-hour personalized outreach, Deal Closer for proposal generation.',
      results: 'Response time dropped from 18 hours to 4 minutes. Qualified lead conversion rate increased 340%. SDR team reduced from 4 to 1 (the remaining SDR focuses on enterprise accounts). $2.1M additional pipeline generated in first quarter.',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'GROWTH_STRATEGIST',
    department: 'Standalone',
    gmDocId: `sgm_growth_strategist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getGrowthStrategist(),
    buildPayload: () => ({
      action: 'analyze_growth',
      metrics: {
        mrr: 45000,
        mrrGrowth: 0.12,
        churnRate: 0.04,
        cac: 800,
        ltv: 12000,
        leadCount: 150,
        conversionRate: 0.08,
      },
      industry: 'B2B SaaS',
      goal: 'Reach $100K MRR within 6 months while keeping CAC under $1000',
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
