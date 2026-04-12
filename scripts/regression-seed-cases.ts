/**
 * Regression CLI — Seed Initial Case Corpus
 *
 * Creates the canned test cases for a given agent. Cases are authored inline
 * here so the corpus is reviewable in git history even though the documents
 * live in Firestore. Re-running the seed is a no-op for existing cases — use
 * --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/regression-seed-cases.ts --agent=COPYWRITER
 *   npx tsx scripts/regression-seed-cases.ts --agent=COPYWRITER --force
 */

import {
  createCase,
  upsertCasePreservingBaselines,
} from '../src/lib/regression/regression-service';
import type { RegressionCase } from '../src/types/regression';

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Copywriter cases
// ---------------------------------------------------------------------------

const COPYWRITER_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'copywriter_home_page_4_sections',
    agentId: 'COPYWRITER',
    name: 'Home page with 4 sections',
    description:
      'The canonical page-copy case. Exercises the h2↔sections invariant, the sectionId mapping rule, and the avoid-phrases guard. Mirrors the input used in scripts/test-copywriter-specialist.ts so the harness tests the same contract the pirate proof-of-life covered.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['page_copy', 'hero', 'small'],
    createdBy: 'seed-script',
    inputPayload: {
      action: 'generate_page_copy',
      industryKey: 'saas_sales_ops',
      input: {
        pageId: 'home',
        pageName: 'Home Page',
        pagePurpose: 'Convert B2B SaaS revenue leaders into 15-minute pipeline reviews',
        sections: [
          { id: 'hero', name: 'Hero', purpose: 'Headline + subheadline + primary CTA' },
          { id: 'how_it_works', name: 'How It Works', purpose: '3-step process showing the AI agent swarm in action' },
          { id: 'proof', name: 'Proof', purpose: 'Why this is different from GoHighLevel and Vendasta' },
          { id: 'cta', name: 'Final CTA', purpose: 'Book a pipeline review' },
        ],
        seoKeywords: ['AI sales agents', 'revenue automation', 'SaaS sales operations'],
        toneOfVoice: 'direct, confident, no fluff',
        keyPhrases: ['AI agent swarm', 'sales velocity', 'every department'],
        avoidPhrases: ['cutting-edge', 'best-in-class', 'game-changer', 'revolutionary', 'solution'],
      },
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole Copywriter surface.',
  },
  {
    caseId: 'copywriter_long_landing_6_sections',
    agentId: 'COPYWRITER',
    name: 'Long-form landing with 6 sections',
    description:
      'Stress-tests the h2↔sections invariant at higher section counts. Also exercises longer keyword lists and stricter avoid-phrase constraints. Catches regressions where a new model starts merging, reordering, or dropping sections.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['page_copy', 'long_form', 'stress'],
    createdBy: 'seed-script',
    inputPayload: {
      action: 'generate_page_copy',
      industryKey: 'saas_sales_ops',
      input: {
        pageId: 'features-landing',
        pageName: 'Features Landing',
        pagePurpose: 'Deep-dive feature page for buyers comparing SalesVelocity against tool-stack alternatives',
        sections: [
          { id: 'hero', name: 'Hero', purpose: 'Top-of-funnel hook for feature-comparison visitors' },
          { id: 'core_value', name: 'Core Value', purpose: 'What coordinated agent swarms replace' },
          { id: 'integrations', name: 'Integrations', purpose: 'Which tools we replace and which we connect to' },
          { id: 'automation', name: 'Automation', purpose: '24/7 autonomous execution across departments' },
          { id: 'proof', name: 'Proof', purpose: 'Real customer outcomes and integration breadth' },
          { id: 'cta', name: 'Final CTA', purpose: 'Book a demo walkthrough' },
        ],
        seoKeywords: ['AI business operations platform', 'sales and marketing automation', 'agent swarm replace stack'],
        toneOfVoice: 'confident, analytical, substantive',
        keyPhrases: ['all-in-one platform', 'AI agent swarm', 'replace your entire stack'],
        avoidPhrases: ['guaranteed', 'revolutionary', 'game-changer', 'seamless', 'synergy'],
      },
    },
    notes: 'Catches section-merge and ordering regressions that only appear at higher section counts.',
  },
  {
    caseId: 'copywriter_proposal_industrial_saas',
    agentId: 'COPYWRITER',
    name: 'Proposal for industrial SaaS lead',
    description:
      'The canonical proposal case. Exercises personalization fidelity (company name, contact name, pain points, tech stack) and the 3-5 sections invariant. Also tests the server-side overwrite of proposalId/leadId/generatedAt — those fields must appear in the output with server-provided values regardless of what the model returns.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['proposal', 'personalization', 'small'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.sections.length',
        kind: 'arrayLength',
        min: 3,
        max: 5,
        reason: 'Proposal spec allows 3-5 sections; any count inside the range is a valid editorial choice, not a regression.',
      },
    ],
    inputPayload: {
      action: 'generate_proposal',
      industryKey: 'saas_sales_ops',
      input: {
        leadId: 'regression_lead_acme_001',
        companyName: 'Acme Robotics',
        contactName: 'Dana Ruiz, VP of Revenue',
        industry: 'Industrial SaaS',
        painPoints: [
          'Outbound team of 4 SDRs hitting 32% of quota',
          'No content production — last blog post 7 months ago',
          'Pipeline reviews happening in spreadsheets',
        ],
        techStack: ['Salesforce', 'Outreach.io', 'Gong'],
        companySize: '180 employees',
        requestedInfo: ['pricing', 'implementation timeline', 'integration with Salesforce'],
      },
    },
    notes: 'Personalization regressions show up as invariant fails if the openingHook drops the company name or tech stack.',
  },
];

// ---------------------------------------------------------------------------
// Video Specialist cases
// ---------------------------------------------------------------------------

const VIDEO_SPECIALIST_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'video_specialist_youtube_documentary_75s',
    agentId: 'VIDEO_SPECIALIST',
    name: 'YouTube documentary explainer (75s, canonical)',
    description:
      'The canonical script_to_storyboard case. Exercises the master-format platform rules, the duration-sum invariant, the sequential sceneNumber invariant, and the avoid-phrases guard. Mirrors what ContentManager.generateVideoContent sends at runtime.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['script_to_storyboard', 'youtube', 'documentary', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.scenes.length',
        kind: 'arrayLength',
        min: 4,
        max: 10,
        reason: 'YouTube 60-150s videos run 4-10 scenes per the master-format platform discipline in the GM.',
      },
    ],
    inputPayload: {
      action: 'script_to_storyboard',
      industryKey: 'saas_sales_ops',
      input: {
        script: 'Introducing SalesVelocity.ai — an AI agent swarm that runs your revenue engine end-to-end. Every department, always on, coordinated through one brain. Replace the patchwork stack your team built over the last decade.',
        brief: 'Cold-introduction explainer for B2B SaaS founders and revenue leaders',
        platform: 'youtube',
        style: 'documentary',
        targetDuration: 75,
        targetAudience: 'B2B SaaS founders and revenue operations leaders',
        callToAction: 'Book a 15-minute pipeline review',
      },
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole Video Specialist surface.',
  },
  {
    caseId: 'video_specialist_tiktok_energetic_30s',
    agentId: 'VIDEO_SPECIALIST',
    name: 'TikTok energetic hook (30s, short form stress)',
    description:
      'Stress-tests platform discipline (hook in 3s) and style discipline (shorter scenes, handheld/dolly camera) at a different duration and platform than Case 1. Catches regressions where a new model stops respecting platform cues.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['script_to_storyboard', 'tiktok', 'energetic', 'short_form', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.scenes.length',
        kind: 'arrayLength',
        min: 4,
        max: 8,
        reason: 'TikTok 15-45s videos run 4-8 short scenes per the platform discipline.',
      },
    ],
    inputPayload: {
      action: 'script_to_storyboard',
      industryKey: 'saas_sales_ops',
      input: {
        script: '',
        brief: 'Short vertical hook video explaining in 30 seconds why your revenue stack is actually slowing you down and what replacing it with an AI agent swarm looks like',
        platform: 'tiktok',
        style: 'energetic',
        targetDuration: 30,
        targetAudience: 'Early-stage founders scrolling TikTok',
        callToAction: 'Comment "swarm" to see the demo',
      },
    },
    notes: 'Catches regressions where a new model stops respecting short-form platform cues — slower cuts, missing hook in first scene, etc.',
  },
  {
    caseId: 'video_specialist_linkedin_talking_head_60s_personalized',
    agentId: 'VIDEO_SPECIALIST',
    name: 'LinkedIn personalized outbound (60s, personalization stress)',
    description:
      'Personalization stress case matching generatePersonalizedVideo live dispatch. The opening scene must echo the prospect company and contact name — the personalization_echo invariant flags drift as WARN (review-only) rather than FAIL so David can review and decide.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['script_to_storyboard', 'linkedin', 'talking_head', 'personalization', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.scenes.length',
        kind: 'arrayLength',
        min: 3,
        max: 8,
        reason: 'LinkedIn 30-90s videos run 3-8 scenes per the platform discipline.',
      },
    ],
    inputPayload: {
      action: 'script_to_storyboard',
      industryKey: 'saas_sales_ops',
      input: {
        script: 'Hi Dana, I saw Acme Robotics is running Salesforce plus Outreach.io plus Gong and your SDR team is hitting 32% of quota. That stack is the problem — not the quota. Here is what changes when you replace it with a coordinated agent swarm.',
        brief: 'Personalized 1:1 outbound video for Dana Ruiz, VP of Revenue at Acme Robotics. Reference the company name, the contact name, their tech stack, and the SDR quota miss in the opening scene.',
        platform: 'linkedin',
        style: 'talking_head',
        targetDuration: 60,
        targetAudience: 'Dana Ruiz, VP of Revenue at Acme Robotics (industrial SaaS, 180 employees)',
        callToAction: "Book a 20-minute deep-dive on Acme's Salesforce → agent-swarm migration path",
        tone: 'confident, direct, executive peer-to-peer',
      },
    },
    notes: 'Personalization regressions surface via the personalization_echo invariant (scene[0].scriptText must contain "acme" or "dana"). That invariant is configured WARN-only in the executor so drift is flagged for owner review, not hard-blocking.',
  },
];

// ---------------------------------------------------------------------------
// Calendar Coordinator cases
// ---------------------------------------------------------------------------

const CALENDAR_COORDINATOR_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'calendar_coordinator_canonical_1month',
    agentId: 'CALENDAR_COORDINATOR',
    name: 'Canonical 4-page 3-platform 1-month schedule',
    description:
      'The canonical case. Mirrors what ContentManager.generateContentCalendar sends at runtime (AI-determined date mode via duration string). Tests schedule shape, content-id fidelity, platform fidelity, frequency-recommendation generation, and platform-balance WARN review.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['plan_calendar', 'canonical', 'baseline', 'ai_determined_dates'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.schedule.length',
        kind: 'arrayLength',
        min: 12,
        max: 80,
        reason: '4 content items × 3 platforms × varying posts-per-item-per-duration. Wide range of valid schedule sizes inside the spec.',
      },
    ],
    inputPayload: {
      action: 'plan_calendar',
      industryKey: 'saas_sales_ops',
      input: {
        contentItems: [
          { id: 'home', type: 'page_launch', title: 'Home Page' },
          { id: 'features', type: 'page_launch', title: 'Features Landing' },
          { id: 'pricing', type: 'page_launch', title: 'Pricing' },
          { id: 'about', type: 'page_launch', title: 'About Us' },
        ],
        platforms: ['twitter', 'linkedin', 'facebook'],
        duration: '1 month',
        timezone: 'America/New_York',
      },
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole Calendar Coordinator surface.',
  },
  {
    caseId: 'calendar_coordinator_multiplatform_stress',
    agentId: 'CALENDAR_COORDINATOR',
    name: '4-platform 1-month multi-platform stress',
    description:
      'Stress case. 3 content items across 4 platforms (twitter/linkedin/instagram/tiktok) over 1 month. Tests multi-platform cadence variety beyond the canonical 3-platform case while staying within Sonnet 4.6 deterministic range. Larger stress inputs (6+ platforms × 3+ months) produced non-deterministic output at temperature 0 during the Task #25 baseline run, which broke the regression diff contract — scope-bounded here so the sanity run is stable.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['plan_calendar', 'stress', 'multi_platform', 'ai_determined_dates'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.schedule.length',
        kind: 'arrayLength',
        min: 18,
        max: 60,
        reason: '3 content items × 4 platforms × 1 month yields ~22-43 valid entries per the target-size heuristic; widen to 18-60 to cover creative variance.',
      },
    ],
    inputPayload: {
      action: 'plan_calendar',
      industryKey: 'saas_sales_ops',
      input: {
        contentItems: [
          { id: 'home', type: 'page_launch', title: 'Home Page' },
          { id: 'features', type: 'page_launch', title: 'Features Landing' },
          { id: 'pricing', type: 'page_launch', title: 'Pricing' },
        ],
        platforms: ['twitter', 'linkedin', 'instagram', 'tiktok'],
        duration: '1 month',
        timezone: 'America/New_York',
      },
    },
    notes: 'Stress-tests cadence across 4 platforms with diverse cadence norms (twitter high-cadence, linkedin low-cadence, instagram + tiktok visual). A new model that ignores TikTok entirely or piles all posts on Twitter fails here. Scope bounded below the non-determinism threshold for claude-sonnet-4.6.',
  },
  {
    caseId: 'calendar_coordinator_unusual_content_ids_fidelity',
    agentId: 'CALENDAR_COORDINATOR',
    name: 'Unusual content IDs fidelity stress (explicit date mode)',
    description:
      'Content-id fidelity stress case. 3 content items with unusual, easy-to-mangle ids (study_acme_2026Q1, whitepaper_industrial_iot, webinar_series_kickoff). Uses EXPLICIT date mode (startDate + endDate) to exercise the dual-mode input path. Invariants catch regressions where a new model mangles, abbreviates, or hallucinates ids.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['plan_calendar', 'content_fidelity', 'stress', 'explicit_dates'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.schedule.length',
        kind: 'arrayLength',
        min: 6,
        max: 40,
        reason: '3 content items × 2 platforms × 1 month explicit range yields 6-40 valid entries.',
      },
    ],
    inputPayload: {
      action: 'plan_calendar',
      industryKey: 'saas_sales_ops',
      input: {
        contentItems: [
          { id: 'study_acme_2026Q1', type: 'case_study', title: 'Acme Robotics Q1 2026 Win' },
          { id: 'whitepaper_industrial_iot', type: 'whitepaper', title: 'Industrial IoT Revenue Automation' },
          { id: 'webinar_series_kickoff', type: 'webinar', title: 'Revenue Swarm Webinar Kickoff' },
        ],
        platforms: ['linkedin', 'twitter'],
        startDate: '2026-04-13',
        endDate: '2026-05-13',
        timezone: 'America/New_York',
      },
    },
    notes: 'Fidelity regressions show up as everyContentIdEchoed or noHallucinatedContentIds failures if the model mangles the unusual ids. Also exercises the EXPLICIT date mode path (no duration string).',
  },
];

// ---------------------------------------------------------------------------
// Asset Generator cases
// ---------------------------------------------------------------------------

const ASSET_GENERATOR_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'asset_generator_canonical_saas_package',
    agentId: 'ASSET_GENERATOR',
    name: 'Canonical 3-page SaaS brand asset package',
    description:
      'The canonical case. Mirrors what BuilderManager.buildAssetPackage sends at runtime (brandName + brandStyle + industry + brandColors + pages + tagline + companyDescription). Tests logo variations, prompt length, hero/page coverage, 4-platform social graphic coverage, and brand-name fidelity in strategy fields. Harness validates the LLM PLAN output (AssetPackagePlanSchema) — DALL-E image generation is NOT called by the regression executor.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_asset_package', 'canonical', 'baseline', 'saas'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.heroes.variations.length',
        kind: 'arrayLength',
        min: 2,
        max: 5,
        reason: '3 pages requested — LLMs may decide 2 or 4 heroes is appropriate inside the creative spec. Any count inside the range is valid.',
      },
      {
        path: '$.socialGraphics.variations.length',
        kind: 'arrayLength',
        min: 4,
        max: 8,
        reason: '4 platforms × 1-2 post types per platform. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.banners.variations.length',
        kind: 'arrayLength',
        min: 1,
        max: 4,
        reason: 'Banner count is discretionary — 1-4 banners is inside the creative spec.',
      },
    ],
    inputPayload: {
      action: 'generate_asset_package',
      input: {
        brandName: 'SalesVelocity.ai',
        brandStyle: 'modern',
        industry: 'saas_sales_ops',
        brandColors: { primary: '#1E40AF', secondary: '#10B981', accent: '#F59E0B' },
        pages: [
          { id: 'home', name: 'Home' },
          { id: 'features', name: 'Features' },
          { id: 'pricing', name: 'Pricing' },
        ],
        tagline: 'Outbound sales, automated.',
        companyDescription: 'AI-powered sales operations platform for B2B teams.',
      },
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole Asset Generator surface.',
  },
  {
    caseId: 'asset_generator_minimalist_finance_package',
    agentId: 'ASSET_GENERATOR',
    name: 'Minimalist finance brand (industry vocabulary stress)',
    description:
      'Industry-tuning stress case. Minimalist finance brand with restrained 2-color palette and 2 pages. Tests whether the LLM tunes its strategy vocabulary to the industry (trust/stability/confidence/wealth/private/advisory) — flagged as WARN via industryAppropriateLanguage so drift is reviewed rather than hard-blocking. Also catches regressions where the brand name is dropped from strategy fields.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_asset_package', 'finance', 'industry_fidelity', 'minimalist', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.heroes.variations.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: '2 pages requested — LLMs may add a 3rd or 4th hero inside the creative spec.',
      },
      {
        path: '$.socialGraphics.variations.length',
        kind: 'arrayLength',
        min: 4,
        max: 8,
        reason: '4 platforms × 1-2 post types per platform. Any count inside the range is valid.',
      },
      {
        path: '$.banners.variations.length',
        kind: 'arrayLength',
        min: 1,
        max: 3,
        reason: 'Minimalist style — 1-3 banners is inside the creative spec.',
      },
    ],
    inputPayload: {
      action: 'generate_asset_package',
      input: {
        brandName: 'Meridian Capital',
        brandStyle: 'minimalist',
        industry: 'finance',
        brandColors: { primary: '#0F172A', secondary: '#94A3B8' },
        pages: [
          { id: 'home', name: 'Home' },
          { id: 'wealth', name: 'Wealth Management' },
        ],
        tagline: 'Quiet confidence.',
        companyDescription: 'Private wealth advisory for high-net-worth individuals.',
      },
    },
    notes: 'Industry-vocabulary regressions surface via industry_appropriate_language (WARN-only). Any missing finance keyword (trust/stability/confidence/wealth/private/advisory) below the 50% threshold is flagged for owner review, not a hard-block.',
  },
  {
    caseId: 'asset_generator_playful_consumer_no_pages',
    agentId: 'ASSET_GENERATOR',
    name: 'Playful consumer brand with no pages (default-hero stress)',
    description:
      'Default-hero stress case. Playful DTC consumer brand with empty pages array — the prompt explicitly instructs the LLM to emit exactly one hero with pageId="default" when no pages are provided. heroes_count_between_1_and_1 catches regressions where a new model fabricates extra heroes or drops the default.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_asset_package', 'consumer', 'no_pages', 'playful', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.heroes.variations.length',
        kind: 'arrayLength',
        min: 1,
        max: 1,
        reason: 'No pages provided — exactly one default hero per the specialist user prompt contract.',
      },
      {
        path: '$.socialGraphics.variations.length',
        kind: 'arrayLength',
        min: 4,
        max: 8,
        reason: '4 platforms × 1-2 post types per platform. Any count inside the range is valid.',
      },
      {
        path: '$.banners.variations.length',
        kind: 'arrayLength',
        min: 1,
        max: 3,
        reason: 'Banner count is discretionary — 1-3 banners is inside the creative spec.',
      },
    ],
    inputPayload: {
      action: 'generate_asset_package',
      input: {
        brandName: 'Bloomberry',
        brandStyle: 'playful',
        industry: 'consumer_retail',
        brandColors: { primary: '#EC4899', secondary: '#FB923C', accent: '#FACC15' },
        pages: [],
        tagline: 'Snacks that smile back.',
        companyDescription: 'DTC better-for-you snack brand.',
      },
    },
    notes: 'Catches regressions where the model fabricates extra heroes when pages=[] or drops the default hero entirely. Also exercises the playful/vibrant 3-color palette which needs different strategy language than the SaaS or finance cases.',
  },
];

// ---------------------------------------------------------------------------
// SEO Expert cases
// ---------------------------------------------------------------------------

const SEO_EXPERT_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'seo_expert_keyword_research_saas',
    agentId: 'SEO_EXPERT',
    name: 'SaaS keyword research (AI sales automation seed)',
    description:
      'The canonical keyword_research case. Exercises keyword count range, search intent enum validation, duplicate detection, seed-echo fidelity, and priority ordering (first 3 keywords should be achievable difficulty). Mirrors what MarketingManager.getSEOKeywordGuidance sends at runtime for the default SaaS vertical.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['keyword_research', 'saas', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.keywords.length',
        kind: 'arrayLength',
        min: 10,
        max: 20,
        reason: 'targetCount=15, but LLMs may return 10-20 inside the schema range. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'keyword_research',
      seed: 'AI sales automation',
      industry: 'saas_sales_ops',
      targetCount: 15,
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole SEO Expert keyword_research surface.',
  },
  {
    caseId: 'seo_expert_keyword_research_realestate',
    agentId: 'SEO_EXPERT',
    name: 'Real estate keyword research (luxury marketing seed)',
    description:
      'Industry-switching stress case. Exercises keyword_research with a different seed and industry to catch regressions where the LLM ignores the industry context or fails to adapt vocabulary. Same structural invariants as the SaaS case but with different count range and seed echo.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['keyword_research', 'real_estate', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.keywords.length',
        kind: 'arrayLength',
        min: 8,
        max: 18,
        reason: 'targetCount=12, but LLMs may return 8-18 inside the schema range. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'keyword_research',
      seed: 'luxury real estate marketing',
      industry: 'real_estate',
      targetCount: 12,
    },
    notes: 'Industry-switching regressions surface if the LLM returns generic SaaS keywords instead of real-estate-specific terms.',
  },
  {
    caseId: 'seo_expert_domain_analysis_rapidcompliance',
    agentId: 'SEO_EXPERT',
    name: 'Domain analysis for rapidcompliance.us',
    description:
      'The canonical domain_analysis case. Exercises summary presence and length, recommendation count range, technical health score validation (0-100), content gap presence, and domain-echo fidelity in the summary. Tests the full domain assessment output contract.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['domain_analysis', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.recommendations.length',
        kind: 'arrayLength',
        min: 3,
        max: 10,
        reason: 'Schema allows 3-10 recommendations. Any count inside the range is valid.',
      },
      {
        path: '$.contentGaps.length',
        kind: 'arrayLength',
        min: 1,
        max: 15,
        reason: 'Schema allows 1-15 content gaps. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'domain_analysis',
      domain: 'rapidcompliance.us',
      keywordLimit: 20,
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole SEO Expert domain_analysis surface.',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface CliArgs {
  agent: string;
  force: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let agent = '';
  let force = false;
  for (const arg of argv) {
    if (arg.startsWith('--agent=')) agent = arg.slice('--agent='.length);
    else if (arg === '--force') force = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/regression-seed-cases.ts --agent=<ID> [--force]');
      process.exit(0);
    }
  }
  if (agent === '') {
    console.error('Missing --agent flag.');
    process.exit(1);
  }
  return { agent, force };
}

const AGENT_CASE_BANK: Record<string, Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[]> = {
  COPYWRITER: COPYWRITER_CASES,
  VIDEO_SPECIALIST: VIDEO_SPECIALIST_CASES,
  CALENDAR_COORDINATOR: CALENDAR_COORDINATOR_CASES,
  ASSET_GENERATOR: ASSET_GENERATOR_CASES,
  SEO_EXPERT: SEO_EXPERT_CASES,
};

async function main(): Promise<void> {
  const args = parseArgs();
  const cases = AGENT_CASE_BANK[args.agent];
  if (!cases || cases.length === 0) {
    console.error(`No seed corpus defined for agent "${args.agent}".`);
    process.exit(1);
  }

  console.log(`\nSeeding ${cases.length} regression cases for ${args.agent}...\n`);

  let created = 0;
  let skipped = 0;
  let overwritten = 0;

  for (const c of cases) {
    if (args.force) {
      // Force mode: upsert everything except baselines (baselines are
      // preserved so tolerance/note/input edits don't destroy recorded work).
      try {
        await upsertCasePreservingBaselines(c);
        console.log(`  ~ ${c.caseId}  (${c.name})  [upserted, baselines preserved]`);
        overwritten += 1;
      } catch (err) {
        console.error(`  ✗ ${c.caseId}: ${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    try {
      await createCase({
        ...c,
        createdAt: now(),
      });
      console.log(`  + ${c.caseId}  (${c.name})`);
      created += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists')) {
        console.log(`  = ${c.caseId}  (exists — skipped; use --force to upsert)`);
        skipped += 1;
      } else {
        console.error(`  ✗ ${c.caseId}: ${msg}`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, skipped: ${skipped}, overwritten: ${overwritten}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script crashed:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
