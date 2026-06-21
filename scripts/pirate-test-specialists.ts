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
import { recordVerification } from '../src/lib/agents/shared/verification-ledger';
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
// ── Coverage expansion (Jun 16 2026): all remaining LLM-backed specialists ──
import { getFacebookAdsExpert } from '../src/lib/agents/marketing/facebook/specialist';
import { getTwitterExpert } from '../src/lib/agents/marketing/twitter/specialist';
import { getTikTokExpert } from '../src/lib/agents/marketing/tiktok/specialist';
import { getThreadsExpert } from '../src/lib/agents/marketing/threads/specialist';
import { getBlueskyExpert } from '../src/lib/agents/marketing/bluesky/specialist';
import { getMastodonExpert } from '../src/lib/agents/marketing/mastodon/specialist';
import { getDiscordExpert } from '../src/lib/agents/marketing/discord/specialist';
import { getTwitchExpert } from '../src/lib/agents/marketing/twitch/specialist';
import { getWhatsAppBusinessExpert } from '../src/lib/agents/marketing/whatsapp-business/specialist';
import { getGoogleBusinessExpert } from '../src/lib/agents/marketing/google-business/specialist';
import { getPaidAdsSpecialist } from '../src/lib/agents/marketing/paid-ads/specialist';
import { getBudgetStrategist } from '../src/lib/agents/marketing/budget/specialist';
import { getGrowthAnalyst } from '../src/lib/agents/marketing/growth-analyst/specialist';
import { getSEOExpert } from '../src/lib/agents/marketing/seo/specialist';
import { getCopySpecialist } from '../src/lib/agents/architect/copy/specialist';
import { getFunnelPathologist } from '../src/lib/agents/architect/funnel/specialist';
import { getUXUISpecialist } from '../src/lib/agents/architect/ux-ui/specialist';
import { getFunnelEngineer } from '../src/lib/agents/builder/funnel/specialist';
import { getUxUiArchitect } from '../src/lib/agents/builder/ux-ui/specialist';
import { getWorkflowOptimizer } from '../src/lib/agents/builder/workflow/specialist';
import { getCalendarCoordinator } from '../src/lib/agents/content/calendar/specialist';
import { getVideoSpecialist } from '../src/lib/agents/content/video/specialist';
import { getInsightsAnalyst } from '../src/lib/agents/intelligence/insights-analyst/specialist';
import { getSmsSpecialist } from '../src/lib/agents/outreach/sms/specialist';
import { getSalesChatSpecialist } from '../src/lib/agents/sales-chat/specialist';
import { getPromptEngineer } from '../src/lib/agents/prompt-engineer/specialist';
import type { BaseSpecialist } from '../src/lib/agents/base-specialist';
import type { AgentMessage, AgentReport } from '../src/lib/agents/types';
// ── LLM-only run targets (Jun 16 2026): agents whose GM-driven LLM step is not
//    reachable via the generic execute() factory path, but whose prose IS
//    grep-able once the prompt-authoring/copy step is exercised directly. ──
import { __internal as assetGeneratorInternal } from '../src/lib/agents/builder/assets/specialist';
import { getSchedulingSpecialist } from '../src/lib/agents/operations/scheduling/specialist';
import { OpenRouterProvider } from '../src/lib/ai/openrouter-provider';
import { getActiveJasperGoldenMaster, invalidateJasperGMCache } from '../src/lib/orchestrator/jasper-golden-master';

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

## RESPECT ALL LIMITS — be TERSELY piratey

CRITICAL: Honor every length and count constraint the schema implies. If a text field has a maximum character length (e.g. a tweet/post capped at 280 chars), stay WELL UNDER it — short, punchy pirate works fine ("Arrr, stop wastin' yer doubloons!"). If an array has a maximum number of elements (e.g. at most 2 alternates), return NO MORE than that many. Brevity is mandatory: a 200-char pirate tweet beats a 320-char one that gets rejected. Pack the pirate flavor into FEW words.

Output MUST be a single valid JSON object and nothing else — no markdown code fences, no commentary before or after, no trailing text. Keep it complete and well-formed.

## Your actual task

The user prompt will specify a task. Execute it AS a pirate would. Output ONLY the JSON object the user prompt requests — no markdown fences, no preamble, no prose outside the JSON. Keep the JSON schema exactly as requested; only the free-text field VALUES change to pirate dialect.

Aye, ye understand? Arrr, ye best. Now get to plunderin'.`;

/**
 * APPEND variant — for agents with a complex, deeply-nested output schema whose
 * structural rules live in the real GM systemPrompt (e.g. SHOT_PLAN_PLANNER's
 * layout block-type enums + object-shaped lookBible/floorPlan). Full-replace
 * pirate prompts throw those rules away and the strict schema rejects the
 * output. Appending keeps the agent's REAL instructions and only injects the
 * dialect — a hardcoded fake still cannot comply, so it remains a valid
 * fake-detector while letting complex-schema agents stay schema-valid.
 */
const PIRATE_APPEND = `

## ADDITIONAL TEST DIRECTIVE — PIRATE DIALECT (overrides voice only)
In ADDITION to every instruction above, write every free-text field VALUE in
exaggerated pirate dialect — use "arrr", "matey", "ye", "yer", "aye",
"landlubber", "doubloon", "plunder", "shiver me timbers", "me hearties"
heavily. Keep ALL structure exactly as specified above: obey every schema
shape, enum value, number, hex code, date, URL, and array/length limit — only
the human-readable text wording becomes pirate. Do not break the JSON shape.`;

interface TestCase {
  specialistId: string;
  department: string;
  gmDocId: string;
  /**
   * Standard execute()-based path. Required UNLESS `llmOnlyRun` is provided.
   * When `llmOnlyRun` is set, the harness skips message-building + execute()
   * entirely and uses the returned prose strings directly.
   */
  specialistFactory?: () => BaseSpecialist;
  buildPayload?: () => Record<string, unknown>;
  extractProseFields?: (report: AgentReport) => string[];
  /**
   * LLM-only override: exercise the agent's GM-driven LLM step directly and
   * return the prose strings to grep for pirate markers. Used for agents whose
   * LLM path is not reachable through the generic execute() factory (image-
   * first asset planning, plain-function planners, or CRM/meeting-gated copy).
   * The GM swap + cache invalidation + restore + ledger write are identical to
   * the standard path; only the "produce prose" step differs.
   */
  llmOnlyRun?: () => Promise<string[]>;
  /**
   * How the pirate prompt is applied. 'replace' (default) overwrites the GM
   * systemPrompt entirely. 'append' keeps the real GM and appends only the
   * dialect directive — required for agents whose strict output schema rules
   * live in the real prompt (e.g. SHOT_PLAN_PLANNER).
   */
  pirateMode?: 'replace' | 'append';
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
      brief: 'Cold outreach email introducing SalesVelocity.ai. Key points: AI agents handle qualification so reps only talk to hot leads, 14-day free trial, $299/month flat with no tiers and no feature gating. Tone: confident, direct, no fluff. Target: SaaS founders who have tried and failed with traditional outbound tools.',
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
      niche: 'B2B SaaS sales automation',
      location: 'United States',
      limit: 5,
      includeAnalysis: true,
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
    // NOTE: The Technographic Scout's LLM path (executeAnalyzeTechStack) only
    // fires when REAL tech signatures are detected from a live URL scrape.
    // execute() always calls scanTechStack(payload.url) — extra fields like
    // `action` or `detectedTechnologies` are ignored.  The pirate-prompt swap
    // is still valid, but the test requires a URL whose HTML contains at least
    // one of the 60+ TECH_SIGNATURES (scripts/globals/HTML patterns).
    // example.com has no detectable signatures, so the LLM step is skipped and
    // zero pirate markers appear in the output.
    // Resolution: use salesforce.com which consistently loads HubSpot and
    // various analytics pixels that match multiple signatures, guaranteeing
    // the LLM analysis path is entered.
    specialistId: 'TECHNOGRAPHIC_SCOUT',
    department: 'Intelligence',
    gmDocId: `sgm_technographic_scout_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getTechnographicScout(),
    buildPayload: () => ({
      url: 'https://www.salesforce.com',
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
      leadId: 'L_pirate_test_qualifier',
      contact: {
        name: 'Jane Smith',
        email: 'jane.smith@techcorp.io',
        title: 'VP of Sales',
        seniority: 'VP',
      },
      company: {
        name: 'TechCorp',
        domain: 'techcorp.io',
        industry: 'SaaS',
        employeeRange: '51-200',
        fundingStage: 'Series B',
      },
      notes: 'Expressed frustration with current CRM and wants AI-powered automation.',
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
      interactionHistory: {
        leadId: 'v_pirate_test',
        segment: 'smb',
        source: 'organic_search',
        pageViews: {
          pricingPageViews: 4,
          featurePageViews: 3,
          totalPageViews: 12,
          totalTimeOnSiteMinutes: 18,
        },
        returnVisits: {
          totalVisits: 3,
          daysActiveInLast30: 5,
        },
        hasActiveCoupon: false,
      },
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'OBJ_HANDLER',
    department: 'Sales',
    gmDocId: `sgm_obj_handler_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getObjectionHandlerSpecialist(),
    buildPayload: () => ({
      action: 'handle_objection',
      objection: {
        rawObjection: 'We already have HubSpot and switching would be too expensive and disruptive.',
        context: {
          dealValue: 30000,
          industry: 'SaaS',
          competitorMentioned: 'HubSpot',
          companySize: '50-200',
        },
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
        firstName: 'Sarah',
        lastName: 'Chen',
        title: 'Head of Revenue',
        companyName: 'GrowthCo',
        industry: 'B2B SaaS',
        employeeRange: '50-200 employees',
      },
      channel: 'email',
      tone: 'professional',
      campaignGoal: 'Book a 15-minute discovery call about AI sales automation',
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
    specialistId: 'REV_MGR',
    department: 'Trust',
    gmDocId: `sgm_rev_mgr_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getReviewManagerSpecialist(),
    buildPayload: () => ({
      action: 'analyze_reviews',
      businessContext: {
        brandName: 'SalesVelocity.ai',
        industry: 'B2B SaaS',
      },
      reviews: [
        { id: 'rev1', platform: 'google', rating: 5, text: 'Amazing product, saved our sales team 20 hours per week.', reviewerName: 'Mike T.', reviewDate: '2026-03-15' },
        { id: 'rev2', platform: 'google', rating: 2, text: 'Onboarding was confusing, took 3 weeks to get value.', reviewerName: 'Sarah K.', reviewDate: '2026-03-20' },
        { id: 'rev3', platform: 'g2', rating: 4, text: 'Great AI features but the pricing page is unclear.', reviewerName: 'Tom L.', reviewDate: '2026-04-01' },
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
    specialistId: 'CASE_STUDY',
    department: 'Trust',
    gmDocId: `sgm_case_study_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getCaseStudyBuilderSpecialist(),
    buildPayload: () => ({
      action: 'build_case_study',
      businessContext: {
        brandName: 'SalesVelocity.ai',
        industry: 'B2B SaaS',
        productName: 'SalesVelocity.ai AI Agent Swarm',
      },
      successStory: {
        id: 'cs_pirate_test',
        clientName: 'GrowthCo',
        clientIndustry: 'B2B SaaS',
        clientSize: '50-200 employees',
        beforeState: {
          challenges: [{ title: 'Slow Lead Response', description: 'Manually qualifying 500 inbound leads per month with 4 SDRs. Response time averaged 18 hours.', impact: 'Lost 60% of qualified leads before first contact', severity: 'HIGH' as const }],
          metrics: [{ label: 'Response Time', value: 18, unit: 'hours' }],
          painPoints: ['60% of qualified leads went cold before first contact'],
          context: 'GrowthCo had a growing inbound pipeline but their SDR team could not keep up.',
        },
        afterState: {
          outcomes: [{ title: 'Instant Lead Response', description: 'AI agents qualify leads in under 4 minutes', impact: '99.6% faster response time' }],
          metrics: [{ label: 'Response Time', value: 4, unit: 'minutes' }],
          benefits: ['Qualified lead conversion rate increased 340%', 'SDR team reduced from 4 to 1'],
          context: 'SalesVelocity.ai AI agents handle qualification, outreach, and proposals automatically.',
        },
        implementation: {
          approach: 'Deployed AI agent swarm: Lead Qualifier for BANT scoring, Email Specialist for outreach, Deal Closer for proposals.',
          timeline: '2 weeks from signup to full deployment',
        },
      },
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: The Growth Strategist's LLM path lives in analyzeDemographics(),
    // invoked when taskType === 'DEMOGRAPHIC_TARGETING'.  The other task types
    // (BUSINESS_REVIEW, SEO_STRATEGY, AD_SPEND_ANALYSIS, CHANNEL_ATTRIBUTION)
    // are fully deterministic — they aggregate Firestore metrics and apply
    // rule-based logic with no OpenRouter call.  The earlier 'analyze_growth'
    // action was wrong — execute() reads `payload.taskType`, not `payload.action`.
    specialistId: 'GROWTH_STRATEGIST',
    department: 'Standalone',
    gmDocId: `sgm_growth_strategist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getGrowthStrategist(),
    buildPayload: () => ({
      taskType: 'DEMOGRAPHIC_TARGETING',
      periodDays: 30,
    }),
    extractProseFields: extractAllProse,
  },
  // ═══════════════════════════════════════════════════════════════════
  // COVERAGE EXPANSION (Jun 16 2026) — all remaining LLM-backed specialists.
  // The three agents previously excluded by design are now covered via the
  // `llmOnlyRun` override (defined at the BOTTOM of this array): ASSET_GENERATOR,
  // SHOT_PLAN_PLANNER, and SCHEDULING_SPECIALIST. Each exercises its GM-driven
  // LLM step directly (prompt-authoring / plan generation / meeting copy) and
  // returns the prose strings for marker-grepping, since their LLM path is not
  // reachable through the generic execute() factory.
  // ═══════════════════════════════════════════════════════════════════
  // ── Marketing (14) ──
  {
    specialistId: 'FACEBOOK_ADS_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_facebook_ads_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getFacebookAdsExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'AI sales agents that qualify leads before reps touch them',
      contentType: 'single_image_ad',
      targetAudience: 'SaaS founders and VP Sales at 50-500 person B2B SaaS companies',
      tone: 'confident',
      campaignGoal: 'drive free-trial signups for SalesVelocity.ai',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'X_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_x_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getTwitterExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'Why AI sales agents are replacing the traditional SDR stack',
      contentType: 'thread',
      targetAudience: 'SaaS founders and VP Sales',
      tone: 'confident',
      campaignGoal: 'thought leadership on autonomous outbound sales',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'TIKTOK_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_tiktok_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getTikTokExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'POV: your AI sales swarm closes deals while you sleep',
      contentType: 'short_video',
      targetAudience: 'Founders and small-business owners on TikTok',
      tone: 'punchy and energetic',
      campaignGoal: 'brand awareness for SalesVelocity.ai',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'THREADS_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_threads_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getThreadsExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'The end of manual lead qualification for B2B SaaS teams',
      contentType: 'post',
      targetAudience: 'Founders and revenue leaders on Threads',
      tone: 'conversational',
      campaignGoal: 'spark conversation about AI in the sales stack',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'BLUESKY_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_bluesky_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getBlueskyExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'Autonomous AI agents running a real B2B sales pipeline',
      contentType: 'post',
      targetAudience: 'Tech-fluent founders and builders on Bluesky',
      tone: 'plain-spoken and anti-hype',
      campaignGoal: 'credibility with a tech-savvy audience',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'MASTODON_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_mastodon_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getMastodonExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'How AI agents qualify and nurture B2B SaaS leads end to end',
      contentType: 'post',
      targetAudience: 'Open-source-minded technologists on Mastodon',
      tone: 'authentic and conversational',
      campaignGoal: 'awareness for SalesVelocity.ai among technical users',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: 'channel_post' avoids the embed/scheduled-event invariants.
    specialistId: 'DISCORD_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_discord_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getDiscordExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'New SalesVelocity.ai feature: AI agents that draft proposals automatically',
      contentType: 'channel_post',
      targetAudience: 'SalesVelocity.ai community members in the Discord server',
      tone: 'casual and community-first',
      campaignGoal: 'drive engagement in the community channel',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: Twitch contentType is a strict enum; 'chat_announcement' = widest ceiling.
    specialistId: 'TWITCH_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_twitch_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getTwitchExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'Live build session: wiring an AI sales agent swarm in real time',
      contentType: 'chat_announcement',
      targetAudience: 'Developers and founders watching the brand stream',
      tone: 'casual and hype-without-cringe',
      campaignGoal: 'announce the live stream in chat',
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'WHATSAPP_BUSINESS_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_whatsapp_business_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getWhatsAppBusinessExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'Re-engagement broadcast: your SalesVelocity.ai trial is waiting',
      contentType: 'broadcast_template',
      targetAudience: 'Opted-in trial users from the past 30 days',
      tone: 'warm and concise',
      campaignGoal: 'bring lapsed trial users back into the product',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: preferredCta + ctaUrl steer the CALL/URL cross-field invariant to URL.
    specialistId: 'GOOGLE_BUSINESS_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_google_business_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getGoogleBusinessExpert(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'SalesVelocity.ai: AI agents that run your B2B sales pipeline',
      contentType: 'post',
      targetAudience: 'Business owners searching Google for sales automation',
      tone: 'professional',
      campaignGoal: 'drive clicks to the free-trial signup page',
      preferredCta: 'SIGN_UP',
      ctaUrl: 'https://www.salesvelocity.ai',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: Paid Ads uses 'plan_campaign', not 'generate_content'.
    specialistId: 'PAID_ADS_SPECIALIST',
    department: 'Marketing',
    gmDocId: `sgm_paid_ads_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getPaidAdsSpecialist(),
    buildPayload: () => ({
      action: 'plan_campaign',
      campaignGoal: 'leads',
      totalBudget: 10000,
      durationDays: 30,
      targetAudience: 'SaaS founders and VP Sales at 50-500 person B2B SaaS companies looking for AI sales automation',
      industry: 'B2B SaaS',
      availablePlatforms: ['Google Ads', 'Meta Ads', 'LinkedIn Ads'],
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: Budget uses 'analyze_budget'; totalBudgetUsd = sum of currentSpendUsd
    // so the allocation-math hard-guard passes through the prose-only swap.
    specialistId: 'BUDGET_STRATEGIST',
    department: 'Marketing',
    gmDocId: `sgm_budget_strategist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getBudgetStrategist(),
    buildPayload: () => ({
      action: 'analyze_budget',
      totalBudgetUsd: 10000,
      windowDays: 30,
      platforms: [
        { platform: 'google_ads', displayName: 'Google Ads', currentSpendUsd: 5000, conversions: 70, conversionSource: 'crm' },
        { platform: 'meta_ads', displayName: 'Meta Ads', currentSpendUsd: 3000, conversions: 35, conversionSource: 'ga4' },
        { platform: 'linkedin_ads', displayName: 'LinkedIn Ads', currentSpendUsd: 2000, conversions: 15, conversionSource: 'platform_self_reported' },
      ],
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'GROWTH_ANALYST',
    department: 'Marketing',
    gmDocId: `sgm_growth_analyst_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getGrowthAnalyst(),
    buildPayload: () => ({
      action: 'generate_content',
      topic: 'Growth strategy for scaling SalesVelocity.ai trial-to-paid conversion',
      contentType: 'growth_analysis',
      targetAudience: 'SaaS founders evaluating AI sales automation',
      tone: 'data-driven',
      campaignGoal: 'identify the highest-leverage growth experiments for the next quarter',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: SEO uses 'keyword_research' (lighter LLM path), not 'generate_content'.
    specialistId: 'SEO_EXPERT',
    department: 'Marketing',
    gmDocId: `sgm_seo_expert_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getSEOExpert(),
    buildPayload: () => ({
      action: 'keyword_research',
      seed: 'AI sales automation',
      industry: 'B2B SaaS sales operations',
      targetCount: 8,
    }),
    extractProseFields: extractAllProse,
  },
  // ── Architect (3) ──
  {
    // NOTE: factory getCopySpecialist() → runtime SPECIALIST_ID 'COPY_STRATEGIST'.
    specialistId: 'COPY_STRATEGIST',
    department: 'Architect',
    gmDocId: `sgm_copy_strategist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getCopySpecialist(),
    buildPayload: () => ({
      action: 'generate_copy',
      pageType: 'homepage',
      funnelType: 'free_trial self-serve SaaS funnel',
      targetAudience: 'SaaS founders and VP Sales at 50-500 person B2B SaaS companies who are drowning in manual outbound',
      toneOfVoice: 'confident, direct, no fluff',
      industry: 'B2B SaaS sales automation',
      brief: 'Pick the strategic messaging direction for the SalesVelocity.ai homepage. The product is an AI agent swarm that runs the sales pipeline: qualification, outreach, and proposals. $299/month flat, no tiers, 14-day free trial. The audience has been burned by traditional outbound tools and generic AI wrappers.',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: factory getFunnelPathologist() → SPECIALIST_ID 'FUNNEL_STRATEGIST'.
    specialistId: 'FUNNEL_STRATEGIST',
    department: 'Architect',
    gmDocId: `sgm_funnel_strategist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getFunnelPathologist(),
    buildPayload: () => ({
      action: 'analyze_funnel',
      funnelType: 'free_trial self-serve SaaS',
      businessType: 'B2B SaaS sales automation platform',
      stages: [
        { name: 'Awareness', goal: 'Cold founders discover SalesVelocity via content and ads' },
        { name: 'Trial Signup', goal: 'Visitor starts a 14-day free trial' },
        { name: 'Activation', goal: 'User connects CRM and watches first AI agent qualify a lead' },
        { name: 'Paid Conversion', goal: 'Trial converts to $299/month paid plan' },
      ],
      conversionPoints: [
        { location: 'pricing page', action: 'click start free trial', target: 'trial signup form' },
        { location: 'onboarding', action: 'connect CRM', target: 'activation' },
      ],
      brief: 'Diagnose the strategic funnel for SalesVelocity.ai. Self-serve B2B SaaS, $299/month flat, 14-day free trial. The biggest worry is trials sign up but never connect their CRM, so they never see the AI agents do real work before the trial expires.',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: factory getUXUISpecialist() → SPECIALIST_ID 'UX_UI_STRATEGIST'.
    specialistId: 'UX_UI_STRATEGIST',
    department: 'Architect',
    gmDocId: `sgm_ux_ui_strategist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getUXUISpecialist(),
    buildPayload: () => ({
      action: 'design_page',
      pageType: 'homepage',
      industry: 'B2B SaaS sales automation',
      toneOfVoice: 'confident, modern, enterprise-credible',
      funnelType: 'free_trial self-serve SaaS',
      sections: ['Hero', 'Social Proof', 'How the Agent Swarm Works', 'Pricing', 'Final CTA'],
      brief: 'Pick the strategic design direction for the SalesVelocity.ai homepage. The audience is SaaS founders and VP Sales evaluating an AI agent swarm. Dark UI with blue accent highlights is the house style. The page must make a skeptical buyer trust autonomous AI agents with real revenue work.',
    }),
    extractProseFields: extractAllProse,
  },
  // ── Builder (3; ASSET_GENERATOR excluded — image-first) ──
  {
    specialistId: 'FUNNEL_ENGINEER',
    department: 'Builder',
    gmDocId: `sgm_funnel_engineer_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getFunnelEngineer(),
    buildPayload: () => ({
      action: 'design_funnel',
      context: 'Design a complete conversion funnel for SalesVelocity.ai — an AI agent swarm that runs the sales pipeline for B2B SaaS teams. $299/month flat, 14-day free trial. Audience: SaaS founders and VP Sales burned by manual outbound. Traffic from LinkedIn thought-leadership and content SEO. Need full stage breakdown, per-stage KPIs, A/B test roadmap, and CPA estimate.',
      requirements: {
        funnelType: 'free trial self-serve',
        businessModel: 'B2B SaaS subscription',
        targetAudience: 'SaaS founders and VP Sales at 50-500 person B2B SaaS companies',
        pricePoint: 'mid',
        productName: 'SalesVelocity.ai',
        trafficSource: 'LinkedIn organic + content SEO',
        currentConversionRate: 0.03,
      },
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: factory getUxUiArchitect() (lowercase x/i) → 'UX_UI_ARCHITECT'.
    specialistId: 'UX_UI_ARCHITECT',
    department: 'Builder',
    gmDocId: `sgm_ux_ui_architect_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getUxUiArchitect(),
    buildPayload: () => ({
      action: 'generate_design_system',
      context: 'Generate a complete design system for SalesVelocity.ai, a B2B SaaS sales-automation platform. The product is an AI agent swarm dashboard. House style is a dark UI with a blue accent. Must feel enterprise-credible and modern, cover Button, Input, and Card at minimum, and serve data-dense pipeline and analytics views.',
      requirements: {
        targetAudience: 'SaaS founders and revenue operators using a data-dense AI agent dashboard',
        accessibilityLevel: 'AA',
        brandColors: ['#1E40AF', '#0F172A', '#38BDF8'],
        industryHint: 'B2B SaaS sales automation',
        styleDirection: 'dark UI, modern, enterprise-credible, blue accent',
        priorityComponents: ['Button', 'Input', 'Card', 'Table', 'Badge'],
      },
    }),
    extractProseFields: extractAllProse,
  },
  {
    specialistId: 'WORKFLOW_OPTIMIZER',
    department: 'Builder',
    gmDocId: `sgm_workflow_optimizer_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getWorkflowOptimizer(),
    buildPayload: () => ({
      action: 'compose_workflow',
      goal: 'Compose a multi-agent workflow that launches a full LinkedIn-led demand-generation campaign for SalesVelocity.ai: research target accounts, generate thought-leadership content, produce a short product-walkthrough video, schedule posts, and route engaged prospects into the AI qualification pipeline.',
      context: 'SalesVelocity.ai is an AI agent swarm for B2B SaaS sales automation. $299/month flat, 14-day free trial. Audience: SaaS founders and VP Sales. Campaign must run within a 1-week setup window.',
      constraints: {
        maxDurationSeconds: 86400,
        requiredAgents: ['LINKEDIN_EXPERT', 'COPYWRITER', 'VIDEO_SPECIALIST'],
        priority: 'high',
        maxParallelism: 4,
      },
      availableAgents: ['LINKEDIN_EXPERT', 'SEO_EXPERT', 'COPYWRITER', 'VIDEO_SPECIALIST', 'GROWTH_ANALYST', 'CALENDAR_COORDINATOR', 'ASSET_GENERATOR'],
    }),
    extractProseFields: extractAllProse,
  },
  // ── Content (2; SHOT_PLAN_PLANNER excluded — no execute() factory) ──
  {
    specialistId: 'CALENDAR_COORDINATOR',
    department: 'Content',
    gmDocId: `sgm_calendar_coordinator_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getCalendarCoordinator(),
    buildPayload: () => ({
      action: 'plan_calendar',
      contentItems: [
        { id: 'ci_blog_ai_sdr', type: 'blog_post', title: 'How AI Sales Agents Replace SDR Teams in 2026' },
        { id: 'ci_case_growthco', type: 'case_study', title: 'GrowthCo cut response time from 18 hours to 4 minutes' },
        { id: 'ci_demo_clip', type: 'video', title: '60-second SalesVelocity.ai agent swarm demo' },
      ],
      platforms: ['linkedin', 'twitter', 'youtube'],
      startDate: '2026-07-06',
      endDate: '2026-07-31',
      timezone: 'America/New_York',
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: 'script_to_storyboard' returns an editorial storyboard (prose), not video.
    specialistId: 'VIDEO_SPECIALIST',
    department: 'Content',
    gmDocId: `sgm_video_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getVideoSpecialist(),
    buildPayload: () => ({
      action: 'script_to_storyboard',
      platform: 'linkedin',
      style: 'cinematic',
      targetDuration: 60,
      brief: 'A short-form video introducing SalesVelocity.ai: AI agents qualify leads, run outreach, and draft proposals so reps only talk to hot prospects. 14-day free trial, $299/month flat. Target: SaaS founders and VP Sales tired of failed outbound tools.',
      targetAudience: 'SaaS founders and VP Sales at 50-500 person B2B SaaS companies',
      callToAction: 'Start a 14-day free trial at SalesVelocity.ai',
      tone: 'confident, direct, no fluff',
    }),
    extractProseFields: extractAllProse,
  },
  // ── Intelligence (1) ──
  {
    specialistId: 'INSIGHTS_ANALYST',
    department: 'Intelligence',
    gmDocId: `sgm_insights_analyst_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getInsightsAnalyst(),
    buildPayload: () => ({
      action: 'analyze_platform_activity',
      snapshot: {
        periodDays: 7,
        pipeline: {
          newLeads: 14,
          stalledDeals: [
            { name: 'Acme Corp', stage: 'Demo Booked', daysInStage: 9 },
            { name: 'GrowthCo', stage: 'Proposal Sent', daysInStage: 12 },
          ],
        },
        social: { postsPublished: 0, connectedAccounts: ['linkedin'] },
        content: { draftsAwaitingReview: 3, lastPublishedDaysAgo: 21 },
        calendar: { connected: true, upcomingMeetingsWithoutPrepDoc: 1 },
        integrations: { sendgridSenderVerified: false, twilioTfnApproved: false },
        catalog: { productCount: 0 },
      },
    }),
    extractProseFields: extractAllProse,
  },
  // ── Outreach (1; SMS depends on seeded SMS purpose types) ──
  {
    specialistId: 'SMS_SPECIALIST',
    department: 'Outreach',
    gmDocId: `sgm_sms_specialist_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getSmsSpecialist(),
    buildPayload: () => ({
      action: 'compose_sms',
      campaignName: 'Q2 trial reactivation',
      targetAudience: 'SaaS founders and VP Sales who started a SalesVelocity.ai free trial but never connected their CRM',
      goal: 'Get the prospect to reply YES to reactivate their trial and book a 15-minute setup call',
      brief: 'Re-engagement SMS to a lapsed free-trial user. Remind them the AI agents qualify leads before reps touch them, the trial is still warm for 7 more days, and one reply books a setup call. Tone: confident, direct, no fluff. Include a single clear CTA and a STOP opt-out footer for US TCPA compliance.',
    }),
    extractProseFields: extractAllProse,
  },
  // ── Standalone LLM agents (2) ──
  {
    specialistId: 'AI_CHAT_SALES_AGENT',
    department: 'Standalone',
    gmDocId: `sgm_ai_chat_sales_agent_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getSalesChatSpecialist(),
    buildPayload: () => ({
      action: 'respond_to_visitor',
      visitorId: 'v_pirate_test_chat',
      channel: 'website',
      userMessage: "Hi, I run sales at a 120-person B2B SaaS company and we're drowning in unqualified inbound leads. Does SalesVelocity actually qualify leads before my reps see them, and roughly what does it cost?",
      conversationHistory: [
        { role: 'assistant', content: 'Hey! Welcome to SalesVelocity.ai — happy to help. What are you trying to solve on the sales side?' },
        { role: 'user', content: 'Mostly our reps waste hours on leads that go nowhere.' },
      ],
    }),
    extractProseFields: extractAllProse,
  },
  {
    // NOTE: vague correction nudges toward CLARIFICATION_NEEDED branch (no verbatim guard).
    specialistId: 'PROMPT_ENGINEER',
    department: 'Standalone',
    gmDocId: `sgm_prompt_engineer_${INDUSTRY_KEY}_v1`,
    specialistFactory: () => getPromptEngineer(),
    buildPayload: () => ({
      action: 'propose_prompt_edit',
      targetSpecialistId: 'EMAIL_SPECIALIST',
      targetSpecialistName: 'Email Specialist',
      currentSystemPrompt: [
        'You are the Email Specialist for SalesVelocity.ai, a B2B SaaS sales automation platform.',
        '',
        '## Tone and Voice',
        'Write in a confident, professional tone. Keep emails concise and benefit-led.',
        '',
        '## Personalization',
        'Reference the prospect company and role where possible. Avoid generic openers.',
        '',
        '## Call to Action',
        'Every email ends with exactly one clear call to action that asks for a specific next step.',
        '',
        '## Brand DNA',
        'SalesVelocity.ai: confident, direct, no fluff. Flat $299/month pricing, no tiers.',
      ].join('\n'),
      correctedReportExcerpt: 'Subject: Quick question. Body: Hi there, I wanted to reach out about our amazing product that can revolutionize your sales process. Let me know if you would like to learn more!',
      humanCorrection: {
        grade: 'request_revision',
        explanation: 'This is way too vague and generic. It does not mention the prospect company or role anywhere, the opener is a tired cliche, and "let me know if you want to learn more" is not a real call to action.',
      },
      priorVersionCount: 0,
    }),
    extractProseFields: extractAllProse,
  },
  // ═══════════════════════════════════════════════════════════════════
  // LLM-ONLY OVERRIDES (Jun 16 2026) — agents whose GM-driven LLM step is not
  // reachable via the generic execute() factory. Each runs the prompt-authoring
  // / plan / copy step directly and returns its prose for marker-grepping. The
  // GM swap + cache invalidation + restore + ledger write are handled by the
  // shared runOneTest() machinery exactly as for the execute()-based tests.
  // All three use specialistGoldenMasters, so findActiveGM() reaches them.
  // ═══════════════════════════════════════════════════════════════════
  {
    // ASSET_GENERATOR — verifies the LLM prompt-AUTHORING step (no image
    // generation). loadGMConfig reads the (now-pirate) GM; we call OpenRouter
    // ourselves with the real system prompt + the real user prompt, parse the
    // plan JSON, and grep the authored strategies/prompts/altText/rationales.
    specialistId: 'ASSET_GENERATOR',
    department: 'Builder',
    gmDocId: `sgm_asset_generator_${INDUSTRY_KEY}_v1`,
    llmOnlyRun: async (): Promise<string[]> => {
      const REQ = {
        action: 'generate_asset_package' as const,
        brandName: 'SalesVelocity.ai',
        brandStyle: 'modern, dark UI with blue accent, enterprise-credible',
        industry: 'B2B SaaS sales automation',
        brandColors: { primary: '#1E40AF', secondary: '#0F172A', accent: '#38BDF8' },
        pages: [{ id: 'home', name: 'Home' }],
        tagline: 'AI agents that run your sales pipeline',
        companyDescription:
          'An AI agent swarm that qualifies leads, runs outreach, and drafts proposals.',
      };
      const ctx = await assetGeneratorInternal.loadGMConfig('saas_sales_ops');
      const userPrompt = assetGeneratorInternal.buildGenerateAssetPackageUserPrompt(REQ);
      const provider = new OpenRouterProvider(PLATFORM_ID);
      const resp = await provider.chat({
        model: ctx.gm.model,
        messages: [
          { role: 'system', content: ctx.resolvedSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: ctx.gm.temperature,
        maxTokens: ctx.gm.maxTokens,
      });
      const parsed: unknown = JSON.parse(
        assetGeneratorInternal.stripJsonFences(resp.content ?? ''),
      );
      const out: string[] = [];
      collectStrings(parsed, out);
      return out;
    },
  },
  {
    // SHOT_PLAN_PLANNER — planner.ts exports plain functions (no execute()).
    // generateShotPlan loads its GM via getActiveSpecialistGMByIndustry, so the
    // standard GM swap reaches it. userId 'pirate_test_user' yields an empty
    // cast (read-only, no writes).
    specialistId: 'SHOT_PLAN_PLANNER',
    department: 'Content',
    gmDocId: `sgm_shot_plan_planner_${INDUSTRY_KEY}_v1`,
    // Append-mode: the ShotPlan schema is deeply nested (layout block-type enums,
    // object-shaped lookBible/floorPlan) and those rules live in the real GM.
    // Full-replace pirate prompts strip them and the strict schema rejects the
    // output, so keep the real GM and inject only the dialect.
    pirateMode: 'append',
    llmOnlyRun: async (): Promise<string[]> => {
      const { generateShotPlan } = await import('../src/lib/agents/content/shot-plan/planner');
      const plan = await generateShotPlan({
        brief:
          'A 30-second product demo for SalesVelocity.ai: AI agents qualify leads, run outreach, and draft proposals so reps only talk to hot prospects. Dark UI, blue accent, confident and modern.',
        userId: 'pirate_test_user',
        shotCount: 2,
        title: 'SalesVelocity Agent Swarm Demo',
      });
      const out: string[] = [];
      collectStrings(plan, out);
      return out;
    },
  },
  {
    // VIDEO_ENGINE_PROMPT_SPECIALIST — specialist.ts exports a plain function
    // (no execute()). generateEnginePrompt loads its GM via
    // getActiveSpecialistGMByIndustry, so the standard GM swap reaches it.
    // Read-only (no Firestore writes).
    specialistId: 'VIDEO_ENGINE_PROMPT_SPECIALIST',
    department: 'Content',
    gmDocId: `sgm_video_engine_prompt_specialist_${INDUSTRY_KEY}_v1`,
    // Append-mode: the output has a structured rule (generationType enum) that
    // lives in the real GM; a full-replace pirate prompt would break the schema.
    pirateMode: 'append',
    llmOnlyRun: async (): Promise<string[]> => {
      const { generateEnginePrompt } = await import('../src/lib/agents/content/video-engine-prompt/specialist');
      const result = await generateEnginePrompt({
        shotIntent:
          'Medium close-up of a confident founder at a standing desk in a dark modern office with blue accent lighting; she turns to camera and gestures at a glowing dashboard as AI agents light up across the screen. Cinematic, shot on ARRI, shallow depth of field, teal-and-amber grade.',
        hasCharacterReferences: true,
        hasContinuationFrame: false,
        hasDialogue: true,
        aspectRatio: '16:9',
        durationSec: 5,
        candidateEngines: ['seedance', 'kling'],
      });
      const out: string[] = [];
      collectStrings(result, out);
      return out;
    },
  },
  {
    // SCHEDULING_SPECIALIST — execute()-based, but its single LLM call (brand-
    // voiced meeting title + description) only fires after real CRM + meeting
    // I/O. This run seeds disposable docs, suppresses Zoom (autoCreateZoom:false),
    // invokes create_meeting, extracts the prose, then deletes EVERY doc it
    // touched in a finally block. CONFIRMED SAFE: scheduler-engine.ts gates the
    // entire createZoomMeeting() call behind `if (schedulerConfig.autoCreateZoom)`
    // (line 109), so no real Zoom meeting is created.
    specialistId: 'SCHEDULING_SPECIALIST',
    department: 'Operations',
    gmDocId: `sgm_scheduling_specialist_${INDUSTRY_KEY}_v1`,
    llmOnlyRun: async (): Promise<string[]> => {
      const db = admin.firestore();
      const ORG_BASE = 'organizations/rapid-compliance-root';
      const LEAD_ID = 'L_pirate_sched_test';
      const SCHED_ID = 'pirate_test_sched';
      // A concrete far-future weekday (Tuesday, 2027-06-15) at 15:00 UTC.
      const START_TIME = '2027-06-15T15:00:00Z';

      const leadRef = db.doc(`${ORG_BASE}/leads/${LEAD_ID}`);
      const schedRef = db.doc(`${ORG_BASE}/meetingSchedulers/${SCHED_ID}`);
      const bookingRef = db.doc(`${ORG_BASE}/settings/booking`);

      // Save the original booking config so we can restore it (or delete if none).
      const originalBookingSnap = await bookingRef.get();
      const originalBooking = originalBookingSnap.exists ? originalBookingSnap.data() : null;

      // All days enabled, 00:00-23:59, so the slot passes availability validation
      // regardless of the server's local timezone.
      const allDayHours = {
        monday: { enabled: true, start: '00:00', end: '23:59' },
        tuesday: { enabled: true, start: '00:00', end: '23:59' },
        wednesday: { enabled: true, start: '00:00', end: '23:59' },
        thursday: { enabled: true, start: '00:00', end: '23:59' },
        friday: { enabled: true, start: '00:00', end: '23:59' },
        saturday: { enabled: true, start: '00:00', end: '23:59' },
        sunday: { enabled: true, start: '00:00', end: '23:59' },
      };

      let createdMeetingId: string | undefined;

      try {
        // SETUP — disposable lead, scheduler config, and an all-days booking config.
        await leadRef.set({
          email: 'pirate-test@example.com',
          firstName: 'Pirate',
          lastName: 'Test',
          createdAt: new Date().toISOString(),
        });
        await schedRef.set({
          id: SCHED_ID,
          name: 'Pirate Test Scheduler',
          duration: 30,
          bufferBefore: 0,
          bufferAfter: 0,
          assignmentType: 'manual',
          assignedUsers: ['operator'],
          autoCreateZoom: false,
          sendReminders: false,
          reminderTimes: [],
          workingHours: allDayHours,
        });
        await bookingRef.set({
          timezone: 'America/Denver',
          defaultMeetingDuration: 30,
          workingHours: allDayHours,
        });

        const specialist = getSchedulingSpecialist();
        await specialist.initialize();
        const msg: AgentMessage = {
          id: `pirate_test_SCHEDULING_SPECIALIST_${Date.now()}`,
          timestamp: new Date(),
          from: 'PIRATE_TEST_HARNESS',
          to: 'SCHEDULING_SPECIALIST',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: {
            action: 'create_meeting',
            startTime: START_TIME,
            durationMinutes: 30,
            attendeeRef: { type: 'lead', id: LEAD_ID },
            schedulerConfigId: SCHED_ID,
          },
          requiresResponse: true,
          traceId: `pirate_trace_${Date.now()}`,
        };

        const report = await specialist.execute(msg);
        if (report.status !== 'COMPLETED') {
          const errMsg = (report.errors ?? []).join(' | ') || 'no errors in report';
          console.log(`    ✗ scheduling create_meeting failed: ${errMsg.slice(0, 300)}`);
          return [];
        }
        const data = report.data as { id?: string } | null;
        createdMeetingId = typeof data?.id === 'string' ? data.id : undefined;
        return extractAllProse(report);
      } finally {
        // TEARDOWN — leave NO residue.
        // 1. Delete the meeting record if one was created.
        if (createdMeetingId) {
          try {
            await db.doc(`${ORG_BASE}/meetings/${createdMeetingId}`).delete();
          } catch (e) {
            console.error('    ✗ teardown: failed to delete meeting', e);
          }
        }
        // 2. Delete any activity docs spawned for the disposable lead.
        try {
          const activitiesSnap = await db.collection(`${ORG_BASE}/activities`).get();
          const deletions: Array<Promise<FirebaseFirestore.WriteResult>> = [];
          for (const doc of activitiesSnap.docs) {
            const a = doc.data() as { relatedTo?: Array<{ entityId?: string }> };
            const touchesLead = Array.isArray(a.relatedTo)
              && a.relatedTo.some((r) => r?.entityId === LEAD_ID);
            if (touchesLead) {
              deletions.push(doc.ref.delete());
            }
          }
          await Promise.all(deletions);
        } catch (e) {
          console.error('    ✗ teardown: failed to clean activities', e);
        }
        // 3. Delete any scheduledReminders the engine may have written (none with
        //    sendReminders:false, but be thorough).
        try {
          const remSnap = await db.collection(`${ORG_BASE}/scheduledReminders`).get();
          const remDeletions: Array<Promise<FirebaseFirestore.WriteResult>> = [];
          for (const doc of remSnap.docs) {
            const r = doc.data() as { meetingId?: string };
            if (createdMeetingId && r.meetingId === createdMeetingId) {
              remDeletions.push(doc.ref.delete());
            }
          }
          await Promise.all(remDeletions);
        } catch (e) {
          console.error('    ✗ teardown: failed to clean scheduledReminders', e);
        }
        // 4. Delete the round-robin state subdoc + disposable scheduler config.
        try {
          await db.doc(`${ORG_BASE}/meetingSchedulers/${SCHED_ID}/state/roundRobin`).delete();
        } catch {
          // ignore — only present for round-robin assignment
        }
        try {
          await schedRef.delete();
        } catch (e) {
          console.error('    ✗ teardown: failed to delete scheduler config', e);
        }
        // 5. Delete the disposable lead.
        try {
          await leadRef.delete();
        } catch (e) {
          console.error('    ✗ teardown: failed to delete lead', e);
        }
        // 6. Restore the original booking config (or delete if none existed).
        try {
          if (originalBooking) {
            await bookingRef.set(originalBooking);
          } else {
            await bookingRef.delete();
          }
        } catch (e) {
          console.error('    ✗ teardown: failed to restore booking config', e);
        }
      }
    },
  },
  {
    // VIDEO_EDITOR_SPECIALIST — specialist.ts exports a plain function (no
    // execute() factory). findClippableMoments loads its GM via
    // getActiveSpecialistGMByIndustry, so the standard GM swap reaches it. We
    // feed a fixed in-memory transcript so NO Deepgram call is made — only the
    // GM-driven LLM step runs, and we grep the moments' reason/caption prose.
    specialistId: 'VIDEO_EDITOR_SPECIALIST',
    department: 'Content',
    gmDocId: `sgm_video_editor_specialist_${INDUSTRY_KEY}_v1`,
    llmOnlyRun: async (): Promise<string[]> => {
      const { findClippableMoments } = await import(
        '../src/lib/agents/content/video-editor/specialist'
      );
      // A simple word-timed transcript covering ~30s of a fake product talk.
      const SCRIPT = [
        'Most', 'sales', 'teams', 'waste', 'half', 'their', 'day', 'on', 'leads', 'that',
        'go', 'nowhere', 'and', 'nobody', 'talks', 'about', 'it', 'here', 'is', 'the',
        'fix', 'AI', 'agents', 'qualify', 'every', 'lead', 'before', 'a', 'rep', 'ever',
        'sees', 'it', 'so', 'your', 'reps', 'only', 'ever', 'talk', 'to', 'hot',
        'prospects', 'that', 'is', 'the', 'whole', 'game', 'start', 'a', 'free', 'trial',
      ];
      const words = SCRIPT.map((word, i) => ({
        word,
        start: i * 0.6,
        end: i * 0.6 + 0.5,
        confidence: 0.95,
      }));
      const durationSeconds = words[words.length - 1].end;
      const moments = await findClippableMoments({
        transcription: {
          transcript: SCRIPT.join(' '),
          words,
          durationSeconds,
          confidence: 0.95,
        },
        durationSeconds,
        maxMoments: 4,
      });
      const out: string[] = [];
      collectStrings(moments, out);
      return out;
    },
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
    // Swap to pirate. 'append' keeps the real GM (its strict schema rules) and
    // only injects the dialect; 'replace' (default) overwrites entirely.
    const swappedPrompt = tc.pirateMode === 'append'
      ? `${originalPrompt}${PIRATE_APPEND}`
      : PIRATE_PROMPT;
    await overwritePrompt(docRef, swappedPrompt);
    invalidateIndustryGMCache(tc.specialistId, INDUSTRY_KEY);
    console.log(`    ✓ pirate prompt written (${swappedPrompt.length} chars, mode=${tc.pirateMode ?? 'replace'}), cache cleared`);

    let proseFields: string[];

    if (tc.llmOnlyRun) {
      // LLM-only path: the agent's GM-driven prose step is exercised directly
      // (no AgentMessage, no execute()). The function returns the prose strings
      // and does its own disposable-doc setup/teardown where needed.
      console.log(`    → running llmOnlyRun() (GM-driven LLM step, no execute())...`);
      proseFields = await tc.llmOnlyRun();
      console.log(`    ← llmOnlyRun returned ${proseFields.length} prose strings`);
    } else {
      // Standard execute()-based path.
      if (!tc.specialistFactory || !tc.buildPayload) {
        throw new Error(
          `TestCase ${tc.specialistId} has neither llmOnlyRun nor specialistFactory+buildPayload`,
        );
      }
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

      const extract = tc.extractProseFields ?? extractAllProse;
      proseFields = extract(report);
    }

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

// ═══════════════════════════════════════════════════════════════════════════
// JASPER (MASTER_ORCHESTRATOR) — fully custom test
//
// Jasper's prompt is NOT in specialistGoldenMasters. It lives as a TOP-LEVEL
// `systemPrompt` field on the active doc in `.../goldenMasters` where
// agentType === 'orchestrator' AND isActive === true. The doc is resolved
// dynamically (not by hardcoded id). We swap the top-level systemPrompt to
// pirate, invalidate Jasper's GM cache, call the LLM directly with the loaded
// GM prompt, grep for markers, then restore in a finally block.
// ═══════════════════════════════════════════════════════════════════════════
async function runJasperPirateTest(db: FirebaseFirestore.Firestore): Promise<TestResult> {
  const department = 'Orchestrator';
  console.log(`\n→   ${'MASTER_ORCHESTRATOR'.padEnd(22)} (${department})`);

  const COLLECTION_PATH = `organizations/${PLATFORM_ID}/goldenMasters`;
  const snap = await db.collection(COLLECTION_PATH)
    .where('agentType', '==', 'orchestrator')
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    const errResult: TestResult = {
      specialistId: 'MASTER_ORCHESTRATOR',
      department,
      docId: '(none)',
      status: 'FAIL',
      proseFieldsFound: 0,
      pirateMarkersTotal: 0,
      sampleProse: '',
      error: `No active orchestrator GM found in ${COLLECTION_PATH}`,
    };
    console.log(`    ✗ ${errResult.error}`);
    return errResult;
  }

  const docSnap = snap.docs[0];
  const docRef = docSnap.ref;
  const docId = docSnap.id;
  const data = docSnap.data() as { systemPrompt?: string; systemPromptSnapshot?: string };
  const originalSystemPrompt = data.systemPrompt ?? '';
  const hasSnapshot = typeof data.systemPromptSnapshot === 'string';
  const originalSnapshot = hasSnapshot ? (data.systemPromptSnapshot ?? '') : undefined;

  console.log(`    GM doc:       ${docId}`);
  console.log(`    original len: ${originalSystemPrompt.length} chars`);

  if (originalSystemPrompt.length < 100) {
    const errResult: TestResult = {
      specialistId: 'MASTER_ORCHESTRATOR',
      department,
      docId,
      status: 'FAIL',
      proseFieldsFound: 0,
      pirateMarkersTotal: 0,
      sampleProse: '',
      error: `Jasper GM top-level systemPrompt is empty/short (length=${originalSystemPrompt.length})`,
    };
    console.log(`    ✗ ${errResult.error}`);
    return errResult;
  }

  let result: TestResult = {
    specialistId: 'MASTER_ORCHESTRATOR',
    department,
    docId,
    status: 'FAIL',
    proseFieldsFound: 0,
    pirateMarkersTotal: 0,
    sampleProse: '',
  };

  try {
    // Swap the top-level systemPrompt (+ snapshot if it exists) to pirate.
    const update: Record<string, string> = { systemPrompt: PIRATE_PROMPT };
    if (hasSnapshot) { update.systemPromptSnapshot = PIRATE_PROMPT; }
    await docRef.update(update);
    invalidateJasperGMCache();
    console.log(`    ✓ pirate prompt written to top-level systemPrompt, Jasper cache cleared`);

    const gm = await getActiveJasperGoldenMaster();
    if (!gm) {
      throw new Error('getActiveJasperGoldenMaster() returned null after swap');
    }

    const provider = new OpenRouterProvider(PLATFORM_ID);
    console.log(`    → calling OpenRouter with Jasper GM prompt...`);
    const resp = await provider.chat({
      // 'claude-sonnet-4' is the ModelName; the provider maps it to the
      // OpenRouter slug 'anthropic/claude-sonnet-4' internally.
      model: 'claude-sonnet-4',
      messages: [
        { role: 'system', content: gm.systemPrompt },
        { role: 'user', content: 'Say hello and tell me in two sentences what you do.' },
      ],
      temperature: 0.7,
      maxTokens: 512,
    });

    const content = resp.content ?? '';
    const markers = countPirateMarkers(content);

    result = {
      ...result,
      status: markers.length >= 3 ? 'PASS' : 'FAIL',
      proseFieldsFound: 1,
      pirateMarkersTotal: markers.length,
      sampleProse: preview(content),
      error: markers.length < 3 ? `only ${markers.length} pirate markers found (need ≥ 3)` : undefined,
    };

    console.log(`    markers hit:  ${markers.length} [${markers.slice(0, 6).join(', ')}]`);
    console.log(`    sample:       ${preview(content, 180)}`);
    console.log(`    ${result.status === 'PASS' ? '✓ PASS' : '✗ FAIL'}`);
    return result;
  } finally {
    // Always restore the original top-level systemPrompt (+ snapshot).
    try {
      const restore: Record<string, string> = { systemPrompt: originalSystemPrompt };
      if (hasSnapshot && originalSnapshot !== undefined) {
        restore.systemPromptSnapshot = originalSnapshot;
      }
      await docRef.update(restore);
      invalidateJasperGMCache();
      console.log(`    ✓ original Jasper GM restored`);
    } catch (restoreErr) {
      console.error(`    ✗ FAILED TO RESTORE Jasper GM ${docId}:`, restoreErr);
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
    let r: TestResult;
    try {
      r = await runOneTest(db, tc);
    } catch (err) {
      console.error(`\n    ✗ UNHANDLED ERROR in ${tc.specialistId}:`, err instanceof Error ? err.message : err);
      r = {
        specialistId: tc.specialistId,
        department: tc.department,
        docId: tc.gmDocId,
        status: 'FAIL',
        proseFieldsFound: 0,
        pirateMarkersTotal: 0,
        sampleProse: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(r);

    // Persist this run's outcome to the verification ledger so the telemetry
    // page can show each agent's real last-verified status. Runs for BOTH
    // pass and fail (error string included on fail). A ledger-write failure
    // must not abort the rest of the suite.
    try {
      await recordVerification({
        agentId: tc.specialistId,
        status: r.status === 'PASS' ? 'pass' : 'fail',
        markersFound: r.pirateMarkersTotal,
        proseFieldsFound: r.proseFieldsFound,
        error: r.error,
        runAt: new Date().toISOString(),
        industryKey: INDUSTRY_KEY,
      });
    } catch (ledgerErr) {
      console.error(
        `    ✗ FAILED TO RECORD VERIFICATION for ${tc.specialistId}:`,
        ledgerErr instanceof Error ? ledgerErr.message : ledgerErr,
      );
    }
  }

  // ── Jasper (MASTER_ORCHESTRATOR) — separate GM location, fully custom test. ──
  // Runs unless a CLI filter is set that does not include it.
  const runJasper = filter.length === 0 || filter.includes('MASTER_ORCHESTRATOR');
  if (runJasper) {
    let jr: TestResult;
    try {
      jr = await runJasperPirateTest(db);
    } catch (err) {
      console.error(`\n    ✗ UNHANDLED ERROR in MASTER_ORCHESTRATOR:`, err instanceof Error ? err.message : err);
      jr = {
        specialistId: 'MASTER_ORCHESTRATOR',
        department: 'Orchestrator',
        docId: '(unknown)',
        status: 'FAIL',
        proseFieldsFound: 0,
        pirateMarkersTotal: 0,
        sampleProse: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(jr);

    try {
      await recordVerification({
        agentId: 'MASTER_ORCHESTRATOR',
        status: jr.status === 'PASS' ? 'pass' : 'fail',
        markersFound: jr.pirateMarkersTotal,
        proseFieldsFound: jr.proseFieldsFound,
        error: jr.error,
        runAt: new Date().toISOString(),
        industryKey: INDUSTRY_KEY,
      });
    } catch (ledgerErr) {
      console.error(
        `    ✗ FAILED TO RECORD VERIFICATION for MASTER_ORCHESTRATOR:`,
        ledgerErr instanceof Error ? ledgerErr.message : ledgerErr,
      );
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
