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
// LinkedIn Expert cases
// ---------------------------------------------------------------------------

const LINKEDIN_EXPERT_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'linkedin_expert_saas_thought_leadership',
    agentId: 'LINKEDIN_EXPERT',
    name: 'SaaS thought leadership post (AI agent swarms)',
    description:
      'The canonical generate_content case for LinkedIn Expert. Exercises hook presence/quality, hashtag count range, alternative-angles count, content strategy depth, cliche detection (WARN), and topic-echo fidelity (WARN). Mirrors what MarketingManager.delegateToLinkedIn sends at runtime for a B2B SaaS thought-leadership post.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'saas', 'thought_leadership', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.post.hashtags.length',
        kind: 'arrayLength',
        min: 3,
        max: 10,
        reason: 'Schema allows 3-10 hashtags. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.alternativeAngles.length',
        kind: 'arrayLength',
        min: 2,
        max: 5,
        reason: 'Schema allows 2-5 alternative angles. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Why AI agent swarms will replace fragmented SaaS stacks by 2027',
      contentType: 'post',
      targetAudience: 'B2B SaaS founders and CTOs',
      tone: 'professional yet bold',
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole LinkedIn Expert surface.',
  },
  {
    caseId: 'linkedin_expert_realestate_lead_gen',
    agentId: 'LINKEDIN_EXPERT',
    name: 'Real estate lead gen post (luxury open house)',
    description:
      'Industry-switching stress case. Exercises generate_content with a real-estate audience and authoritative tone to catch regressions where the LLM ignores industry context. Same structural invariants as the SaaS case with different topic-echo seed.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'real_estate', 'lead_gen', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.post.hashtags.length',
        kind: 'arrayLength',
        min: 3,
        max: 10,
        reason: 'Schema allows 3-10 hashtags. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.alternativeAngles.length',
        kind: 'arrayLength',
        min: 2,
        max: 5,
        reason: 'Schema allows 2-5 alternative angles. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: '3 open house strategies that luxury agents use to close above asking price',
      contentType: 'post',
      targetAudience: 'Real estate agents',
      tone: 'authoritative',
    },
    notes: 'Industry-switching regressions surface if the LLM returns generic SaaS content instead of real-estate-specific language.',
  },
  {
    caseId: 'linkedin_expert_carousel_agency',
    agentId: 'LINKEDIN_EXPERT',
    name: 'Carousel post for agency onboarding (content-type stress)',
    description:
      'Content-type stress case. Exercises generate_content with contentType=carousel and a conversational tone targeting agency owners. Tests whether the LLM adapts its output to a carousel format context while still satisfying the structural schema. Same invariant shape as canonical cases.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'carousel', 'agency', 'content_type_stress', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.post.hashtags.length',
        kind: 'arrayLength',
        min: 3,
        max: 10,
        reason: 'Schema allows 3-10 hashtags. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.alternativeAngles.length',
        kind: 'arrayLength',
        min: 2,
        max: 5,
        reason: 'Schema allows 2-5 alternative angles. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'The 5-step client onboarding process that reduced our agency churn by 60%',
      contentType: 'carousel',
      targetAudience: 'Marketing agency owners',
      tone: 'conversational',
    },
    notes: 'Content-type regressions surface if the model ignores the carousel format or produces content indistinguishable from a standard post.',
  },
];

// ---------------------------------------------------------------------------
// TikTok Expert cases
// ---------------------------------------------------------------------------

const TIKTOK_EXPERT_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'tiktok_expert_saas_viral_hook',
    agentId: 'TIKTOK_EXPERT',
    name: 'SaaS viral hook video (AI sales automation)',
    description:
      'The canonical generate_content case for TikTok Expert. Exercises hook presence/quality, caption presence, hashtag count range, content strategy depth, cliche detection (WARN), and topic-echo fidelity (WARN). Mirrors what MarketingManager sends at runtime for a B2B SaaS viral video.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'saas', 'viral', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.hashtags.length',
        kind: 'arrayLength',
        min: 3,
        max: 15,
        reason: 'Schema allows 3-15 hashtags. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.hooks.alternatives.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 alternative hooks. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Why AI sales automation agents will replace your entire SDR team by 2027',
      contentType: 'short_video',
      targetAudience: 'B2B SaaS founders and sales leaders',
      tone: 'bold and provocative',
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole TikTok Expert surface.',
  },
  {
    caseId: 'tiktok_expert_realestate_tutorial',
    agentId: 'TIKTOK_EXPERT',
    name: 'Real estate tutorial video (luxury staging)',
    description:
      'Industry-switching stress case. Exercises generate_content with a real-estate audience and authoritative tone to catch regressions where the LLM ignores industry context. Same structural invariants as the SaaS case with different topic-echo seed.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'real_estate', 'tutorial', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.hashtags.length',
        kind: 'arrayLength',
        min: 3,
        max: 15,
        reason: 'Schema allows 3-15 hashtags. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.hooks.alternatives.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 alternative hooks. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: '5 open house staging tricks that sell luxury homes in 48 hours',
      contentType: 'tutorial',
      targetAudience: 'Real estate agents and luxury realtors',
      tone: 'authoritative and energetic',
    },
    notes: 'Industry-switching regressions surface if the LLM returns generic SaaS content instead of real-estate-specific language.',
  },
  {
    caseId: 'tiktok_expert_trend_ecommerce',
    agentId: 'TIKTOK_EXPERT',
    name: 'Trend-format video for ecommerce (dropshipping)',
    description:
      'Content-type stress case. Exercises generate_content with contentType=trend and a conversational tone targeting ecommerce entrepreneurs. Tests whether the LLM adapts to a trend-based format while still satisfying the structural schema. Same invariant shape as canonical cases.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'trend', 'ecommerce', 'content_type_stress', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.hashtags.length',
        kind: 'arrayLength',
        min: 3,
        max: 15,
        reason: 'Schema allows 3-15 hashtags. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.hooks.alternatives.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 alternative hooks. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'The product research method that found me 3 winning dropshipping products this week',
      contentType: 'trend',
      targetAudience: 'Ecommerce entrepreneurs and dropshippers',
      tone: 'conversational and hype',
    },
    notes: 'Content-type regressions surface if the model ignores the trend format or produces content indistinguishable from a standard video.',
  },
];

// ---------------------------------------------------------------------------
// Twitter/X Expert cases
// ---------------------------------------------------------------------------

const TWITTER_X_EXPERT_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'twitter_expert_saas_thread',
    agentId: 'TWITTER_X_EXPERT',
    name: 'SaaS thought leadership thread (AI agent swarms)',
    description:
      'The canonical generate_content case for Twitter/X Expert. Exercises hook presence/quality, tweet character limits (280), thread minimum length, standalone tweet presence, content strategy depth, cliche detection (WARN), and topic-echo fidelity (WARN).',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'saas', 'thread', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.thread.length',
        kind: 'arrayLength',
        min: 3,
        max: 15,
        reason: 'Schema allows 3-15 tweets. Any count inside the range is a valid editorial choice.',
      },
      {
        path: '$.hooks.alternatives.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 alternative hooks. Any count inside the range is valid.',
      },
      {
        path: '$.hashtags.length',
        kind: 'arrayLength',
        min: 0,
        max: 5,
        reason: 'Schema allows 0-5 hashtags. Twitter culture uses fewer hashtags. Zero is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Why AI agent swarms will replace your entire SaaS tool stack by 2027',
      contentType: 'thread',
      targetAudience: 'B2B SaaS founders and CTOs',
      tone: 'sharp and opinionated',
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole Twitter/X Expert surface.',
  },
  {
    caseId: 'twitter_expert_realestate_hot_take',
    agentId: 'TWITTER_X_EXPERT',
    name: 'Real estate hot take (open houses are dead)',
    description:
      'Industry-switching + hot_take content-type stress case. Exercises whether the LLM adapts to real estate context with a provocative tone, while keeping all tweets under 280 chars.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'real_estate', 'hot_take', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.thread.length',
        kind: 'arrayLength',
        min: 3,
        max: 15,
        reason: 'Schema allows 3-15 tweets.',
      },
      {
        path: '$.hooks.alternatives.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 alternative hooks.',
      },
      {
        path: '$.hashtags.length',
        kind: 'arrayLength',
        min: 0,
        max: 5,
        reason: 'Schema allows 0-5 hashtags.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Open houses are dead — here is what smart real estate agents do instead with virtual tours and AI',
      contentType: 'hot_take',
      targetAudience: 'Real estate agents and brokers',
      tone: 'provocative',
    },
    notes: 'Industry-switching regressions surface if the LLM returns SaaS content instead of real-estate language.',
  },
  {
    caseId: 'twitter_expert_educational_ecommerce',
    agentId: 'TWITTER_X_EXPERT',
    name: 'Educational thread for ecommerce (checkout optimization)',
    description:
      'Content-type stress case with educational format and data-driven tone targeting ecommerce founders. Tests whether the LLM produces a bookmark-worthy educational thread while respecting character limits.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'educational', 'ecommerce', 'content_type_stress', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.thread.length',
        kind: 'arrayLength',
        min: 3,
        max: 15,
        reason: 'Schema allows 3-15 tweets.',
      },
      {
        path: '$.hooks.alternatives.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 alternative hooks.',
      },
      {
        path: '$.hashtags.length',
        kind: 'arrayLength',
        min: 0,
        max: 5,
        reason: 'Schema allows 0-5 hashtags.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: '7 checkout page tweaks that recovered $2M in abandoned ecommerce carts — real conversion data',
      contentType: 'educational',
      targetAudience: 'Ecommerce founders and DTC brands',
      tone: 'data-driven and direct',
    },
    notes: 'Content-type regressions surface if the model ignores the educational format or produces generic content.',
  },
];

// ---------------------------------------------------------------------------
// Facebook Ads Expert cases
// ---------------------------------------------------------------------------

const FACEBOOK_ADS_EXPERT_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'facebook_ads_saas_lead_gen',
    agentId: 'FACEBOOK_ADS_EXPERT',
    name: 'SaaS lead gen ad (AI sales automation)',
    description:
      'The canonical generate_content case for Facebook Ads Expert. Exercises headline presence, variation count, CTA validation, content strategy depth, and topic-echo fidelity.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'saas', 'lead_ad', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.adCreative.variations.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 variations. Any count inside the range is valid.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'AI-powered sales automation SaaS platform that replaces your entire tool stack',
      contentType: 'lead_ad',
      targetAudience: 'B2B SaaS founders, VPs of Sales, Revenue leaders',
      tone: 'professional and conversion-focused',
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole Facebook Ads Expert surface.',
  },
  {
    caseId: 'facebook_ads_realestate_retargeting',
    agentId: 'FACEBOOK_ADS_EXPERT',
    name: 'Real estate retargeting ad (luxury home listing)',
    description:
      'Industry-switching stress case. Tests whether the LLM adapts to real estate context with retargeting creative for warm audiences.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'real_estate', 'retargeting', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.adCreative.variations.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 variations.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Luxury home listing with virtual tour and open house follow-up for interested buyers',
      contentType: 'retargeting',
      targetAudience: 'Home buyers who visited listing pages in last 30 days',
      tone: 'aspirational and urgent',
    },
    notes: 'Industry-switching regressions surface if the LLM returns SaaS ad copy instead of real estate.',
  },
  {
    caseId: 'facebook_ads_ecommerce_carousel',
    agentId: 'FACEBOOK_ADS_EXPERT',
    name: 'Ecommerce carousel ad (summer fashion sale)',
    description:
      'Content-type stress case with carousel format targeting fashion consumers. Tests ad format adaptation.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'ecommerce', 'carousel', 'content_type_stress', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.adCreative.variations.length',
        kind: 'arrayLength',
        min: 2,
        max: 4,
        reason: 'Schema allows 2-4 variations.',
      },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Summer fashion collection launch with 30% discount for early access email subscribers',
      contentType: 'carousel',
      targetAudience: 'Women 25-45 interested in fashion and online shopping',
      tone: 'trendy and exclusive',
    },
    notes: 'Content-type regressions surface if the model ignores carousel format.',
  },
];

// ---------------------------------------------------------------------------
// Growth Analyst cases
// ---------------------------------------------------------------------------

const GROWTH_ANALYST_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'growth_analyst_saas_acquisition',
    agentId: 'GROWTH_ANALYST',
    name: 'SaaS customer acquisition growth analysis',
    description:
      'Canonical growth analysis case. Exercises experiment count, prioritized actions, KPI targets, strategy depth, and topic-echo fidelity.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'saas', 'acquisition', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.experiments.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 experiments.' },
      { path: '$.prioritizedActions.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 actions.' },
      { path: '$.kpiTargets.length', kind: 'arrayLength', min: 3, max: 8, reason: 'Schema allows 3-8 KPI targets.' },
      { path: '$.analysis.opportunities.length', kind: 'arrayLength', min: 3, max: 8, reason: 'Schema allows 3-8 opportunities.' },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Customer acquisition strategy for B2B SaaS — improving trial-to-paid conversion and reducing CAC',
      contentType: 'growth_analysis',
      targetAudience: 'B2B SaaS founders scaling from $1M to $10M ARR',
      tone: 'analytical and direct',
      campaignGoal: 'Double trial-to-paid conversion rate within 90 days',
    },
    notes: 'Baseline case — any delta here flags upgrades across the whole Growth Analyst surface.',
  },
  {
    caseId: 'growth_analyst_realestate_leads',
    agentId: 'GROWTH_ANALYST',
    name: 'Real estate lead generation growth analysis',
    description:
      'Industry-switching stress case. Tests whether the LLM adapts growth analysis to real estate context.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'real_estate', 'lead_gen', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.experiments.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 experiments.' },
      { path: '$.prioritizedActions.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 actions.' },
      { path: '$.kpiTargets.length', kind: 'arrayLength', min: 3, max: 8, reason: 'Schema allows 3-8 KPI targets.' },
      { path: '$.analysis.opportunities.length', kind: 'arrayLength', min: 3, max: 8, reason: 'Schema allows 3-8 opportunities.' },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Lead generation strategy for luxury real estate market — increasing qualified buyer pipeline',
      contentType: 'growth_analysis',
      targetAudience: 'Luxury real estate agents and brokerages',
      tone: 'strategic and data-driven',
      campaignGoal: 'Generate 50 qualified luxury buyer leads per month',
    },
    notes: 'Industry-switching regressions surface if the LLM returns SaaS growth advice instead of real estate.',
  },
  {
    caseId: 'growth_analyst_ecommerce_retention',
    agentId: 'GROWTH_ANALYST',
    name: 'Ecommerce customer retention growth analysis',
    description:
      'Content-type stress case with retention focus instead of acquisition. Tests whether the LLM produces retention-specific experiments and KPIs.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_content', 'ecommerce', 'retention', 'content_type_stress', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.experiments.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 experiments.' },
      { path: '$.prioritizedActions.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 actions.' },
      { path: '$.kpiTargets.length', kind: 'arrayLength', min: 3, max: 8, reason: 'Schema allows 3-8 KPI targets.' },
      { path: '$.analysis.opportunities.length', kind: 'arrayLength', min: 3, max: 8, reason: 'Schema allows 3-8 opportunities.' },
    ],
    inputPayload: {
      action: 'generate_content',
      topic: 'Customer retention strategy for DTC ecommerce — reducing churn and increasing repeat purchase rate',
      contentType: 'growth_analysis',
      targetAudience: 'DTC ecommerce founders doing $500K-$5M annual revenue',
      tone: 'practical and results-focused',
      campaignGoal: 'Increase repeat purchase rate from 20% to 35% in 6 months',
    },
    notes: 'Content-type regressions surface if the model produces acquisition-focused analysis instead of retention.',
  },
];

// ---------------------------------------------------------------------------
// UX/UI Architect cases
// ---------------------------------------------------------------------------

const UX_UI_ARCHITECT_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'ux_ui_architect_saas_b2b',
    agentId: 'UX_UI_ARCHITECT',
    name: 'B2B SaaS design system (dashboard + marketing)',
    description:
      'Canonical design system case. Exercises token shape (colors, typography scale, spacing, radius, shadows, breakpoints), component count range, design principles count, WCAG citation, and context echo in rationale.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_design_system', 'saas', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.componentGuidelines.length', kind: 'arrayLength', min: 4, max: 8, reason: 'Schema allows 4-8 components.' },
      { path: '$.designPrinciples.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 principles.' },
      { path: '$.tokens.typography.scale.length', kind: 'arrayLength', min: 6, max: 9, reason: 'Schema allows 6-9 typography steps.' },
      { path: '$.tokens.colors.neutral.length', kind: 'arrayLength', min: 5, max: 10, reason: 'Schema allows 5-10 neutral steps.' },
      { path: '$.tokens.spacing.scale.length', kind: 'arrayLength', min: 6, max: 10, reason: 'Schema allows 6-10 spacing steps.' },
    ],
    inputPayload: {
      action: 'generate_design_system',
      context:
        'B2B SaaS sales velocity platform — clean, data-dense dashboard UI, trust-building marketing site, converts enterprise buyers',
      requirements: {
        targetAudience: 'B2B SaaS founders and revenue operators scaling from $1M to $10M ARR',
        accessibilityLevel: 'AA',
        industryHint: 'saas_sales_ops',
        styleDirection: 'modern, confident, precise — not playful, not corporate',
        priorityComponents: ['Button', 'Input', 'Card', 'Table', 'Modal'],
      },
    },
    notes: 'Baseline case — any delta here flags upgrades across the whole UX/UI Architect surface.',
  },
  {
    caseId: 'ux_ui_architect_realestate_luxury',
    agentId: 'UX_UI_ARCHITECT',
    name: 'Luxury real estate design system (editorial)',
    description:
      'Industry-switching stress case. Tests whether the LLM adapts design language from SaaS to editorial real estate — different color mood, different type hierarchy, different component emphasis.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_design_system', 'real_estate', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.componentGuidelines.length', kind: 'arrayLength', min: 4, max: 8, reason: 'Schema allows 4-8 components.' },
      { path: '$.designPrinciples.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 principles.' },
      { path: '$.tokens.typography.scale.length', kind: 'arrayLength', min: 6, max: 9, reason: 'Schema allows 6-9 typography steps.' },
      { path: '$.tokens.colors.neutral.length', kind: 'arrayLength', min: 5, max: 10, reason: 'Schema allows 5-10 neutral steps.' },
      { path: '$.tokens.spacing.scale.length', kind: 'arrayLength', min: 6, max: 10, reason: 'Schema allows 6-10 spacing steps.' },
    ],
    inputPayload: {
      action: 'generate_design_system',
      context:
        'Luxury real estate brokerage website — editorial photography, generous whitespace, slow reveal animations, high-end buyer experience',
      requirements: {
        targetAudience: 'Affluent buyers and sellers shopping $2M-$20M properties',
        accessibilityLevel: 'AA',
        industryHint: 'real_estate',
        styleDirection: 'editorial, understated, timeless — never loud or trendy',
        priorityComponents: ['Button', 'Input', 'Card', 'Gallery', 'Nav'],
      },
    },
    notes: 'Industry-switching regressions surface if the LLM returns SaaS-style tokens instead of editorial real-estate design.',
  },
  {
    caseId: 'ux_ui_architect_ecommerce_dtc',
    agentId: 'UX_UI_ARCHITECT',
    name: 'DTC ecommerce design system (mobile-first, bold)',
    description:
      'Tone-and-style stress case. Tests whether the LLM produces a bold, high-energy design system instead of defaulting to a conservative SaaS look.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_design_system', 'ecommerce', 'style_stress', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.componentGuidelines.length', kind: 'arrayLength', min: 4, max: 8, reason: 'Schema allows 4-8 components.' },
      { path: '$.designPrinciples.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 principles.' },
      { path: '$.tokens.typography.scale.length', kind: 'arrayLength', min: 6, max: 9, reason: 'Schema allows 6-9 typography steps.' },
      { path: '$.tokens.colors.neutral.length', kind: 'arrayLength', min: 5, max: 10, reason: 'Schema allows 5-10 neutral steps.' },
      { path: '$.tokens.spacing.scale.length', kind: 'arrayLength', min: 6, max: 10, reason: 'Schema allows 6-10 spacing steps.' },
    ],
    inputPayload: {
      action: 'generate_design_system',
      context:
        'DTC ecommerce brand — high-velocity product pages, fast checkout, mobile-first, bold photography and confident CTAs',
      requirements: {
        targetAudience: 'Millennial and Gen-Z shoppers on mobile, repeat purchasers of lifestyle goods',
        accessibilityLevel: 'AA',
        industryHint: 'ecommerce_dtc',
        styleDirection: 'bold, energetic, playful but premium',
        priorityComponents: ['Button', 'Input', 'Card', 'ProductCard', 'Badge'],
      },
    },
    notes: 'Style-stress regressions surface if the model produces conservative SaaS tokens instead of bold mobile-first ecommerce design.',
  },
];

// ---------------------------------------------------------------------------
// Workflow Optimizer cases
// ---------------------------------------------------------------------------

const WORKFLOW_OPTIMIZER_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'workflow_optimizer_saas_content_engine',
    agentId: 'WORKFLOW_OPTIMIZER',
    name: 'SaaS weekly content engine (canonical)',
    description:
      'Canonical workflow composition case. Exercises node count range, prose input/output/depends fields, unique node ids, total duration sanity, and critical-path reference-by-id.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['compose_workflow', 'saas', 'content', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.nodes.length', kind: 'arrayLength', min: 3, max: 12, reason: 'Schema allows 3-12 nodes.' },
      { path: '$.riskMitigation.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 risks.' },
    ],
    inputPayload: {
      action: 'compose_workflow',
      goal:
        'Produce one full weekly content package for a B2B SaaS sales velocity platform targeting founders and revenue operators: one SEO-optimized blog post, one LinkedIn thought-leadership post, one short-form TikTok video script, and three social image assets — all coordinated around a single weekly theme and ready for the calendar.',
      context: 'Weekly content cadence. Theme selection should lean on trending industry topics and existing brand DNA. All outputs must share a unified hook and call-to-action.',
      constraints: {
        maxDurationSeconds: 1800,
        priority: 'high',
        maxParallelism: 4,
      },
    },
    notes: 'Baseline case — any delta here flags upgrades across the whole Workflow Optimizer surface.',
  },
  {
    caseId: 'workflow_optimizer_realestate_lead_engine',
    agentId: 'WORKFLOW_OPTIMIZER',
    name: 'Luxury real estate weekly lead engine',
    description:
      'Industry-switching stress case with editorial tone. Tests whether the LLM adapts agent choices and parallelization to a long-sales-cycle luxury market.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['compose_workflow', 'real_estate', 'lead_gen', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.nodes.length', kind: 'arrayLength', min: 3, max: 12, reason: 'Schema allows 3-12 nodes.' },
      { path: '$.riskMitigation.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 risks.' },
    ],
    inputPayload: {
      action: 'compose_workflow',
      goal:
        'Build a weekly luxury real estate lead generation engine: research one neighborhood market trend, produce one editorial blog post, one LinkedIn post targeting wealth managers, two Instagram-ready property images, and a follow-up email nurture cadence for the leads captured.',
      context: 'Long sales cycle market. Editorial tone. Brand restraint is important — no loud or trendy visuals.',
      constraints: {
        maxDurationSeconds: 2400,
        priority: 'medium',
      },
    },
    notes: 'Industry-switching regressions surface if the LLM returns a SaaS-style content engine instead of a luxury editorial lead engine.',
  },
  {
    caseId: 'workflow_optimizer_ecommerce_product_launch',
    agentId: 'WORKFLOW_OPTIMIZER',
    name: 'DTC ecommerce product launch (critical, multi-channel)',
    description:
      'Complexity-stress case. Tests whether the LLM scales up the workflow to the larger scope (8-12 nodes), uses critical priority appropriately, and maintains sane critical path + parallelization.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['compose_workflow', 'ecommerce', 'product_launch', 'complexity_stress', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.nodes.length', kind: 'arrayLength', min: 3, max: 12, reason: 'Schema allows 3-12 nodes.' },
      { path: '$.riskMitigation.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 risks.' },
    ],
    inputPayload: {
      action: 'compose_workflow',
      goal:
        'Launch a new DTC lifestyle product across all channels in one week: build the product landing page, compose Facebook ad creative (primary + 3 variants), produce one TikTok video script with hook variations, generate five product lifestyle images, schedule everything across the content calendar, and set up a welcome email sequence for first-time buyers.',
      context: 'Fast-velocity DTC brand. Mobile-first. Emphasis on repeat-purchase funnel setup, not one-time sales.',
      constraints: {
        maxDurationSeconds: 3600,
        priority: 'critical',
        maxParallelism: 6,
      },
    },
    notes: 'Complexity-stress regressions surface if the LLM returns a minimal 3-node workflow for a clearly multi-channel launch.',
  },
];

// ---------------------------------------------------------------------------
// Copy Specialist cases (Architect-layer strategic messaging picker, Task #39)
// ---------------------------------------------------------------------------

const COPY_SPECIALIST_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'copy_specialist_saas_sales_ops_landing',
    agentId: 'COPY_SPECIALIST',
    name: 'SaaS sales-ops cold-traffic landing (canonical)',
    description:
      'Canonical strategic messaging case. Exercises framework enum, CTA strategy enum, pillars count range, key objections count range, prose page messaging notes, and rationale brief-echo.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_copy', 'saas', 'landing', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.siteWideMessagingPillars.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 pillars.' },
      { path: '$.keyObjections.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 objections.' },
    ],
    inputPayload: {
      action: 'generate_copy',
      pageType: 'landing',
      funnelType: 'lead_generation',
      targetAudience: 'B2B SaaS founders and revenue operators ($1M-$10M ARR) drowning in disconnected sales tools and frustrated with cold-outreach agencies that promise leads but deliver spam',
      toneOfVoice: 'confident and direct, peer-to-peer founder voice — never corporate marketing speak',
      industry: 'B2B SaaS — sales velocity platform',
      brief:
        'Build the cold-traffic landing page for SalesVelocity.ai targeting founders running their own outbound today. The page must convert problem-aware visitors who arrived from a LinkedIn ad about "stop sending more cold emails." We sell a complete sales velocity platform that pairs every client with real human specialists running their outbound, content, and pipeline — not a self-serve dashboard. Pricing is month-to-month with a 30-day results guarantee. Top objections we see in sales calls: "I just signed a 12-month agency contract three months ago," "I do not have time to onboard another tool," and "how is this different from a VA service." Brand pillars we want repeated: team-not-tools, results-before-retainer, no contracts ever.',
    },
    notes: 'Baseline case — any delta here flags upgrades across the whole Copy Specialist surface.',
  },
  {
    caseId: 'copy_specialist_realestate_luxury_homepage',
    agentId: 'COPY_SPECIALIST',
    name: 'Luxury real estate brokerage homepage (industry switch)',
    description:
      'Industry-switching stress case. Tests whether the LLM adapts framework + CTA + voice direction to a long-cycle editorial luxury market with restraint as the brand pillar.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_copy', 'real_estate', 'luxury', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.siteWideMessagingPillars.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 pillars.' },
      { path: '$.keyObjections.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 objections.' },
    ],
    inputPayload: {
      action: 'generate_copy',
      pageType: 'homepage',
      funnelType: 'lead_capture_long_cycle',
      targetAudience: 'Wealth-managed individuals, family offices, and corporate executives evaluating luxury residential properties in markets with 6-18 month average sale cycles. They have seen every glossy real estate site and are skeptical of agents who lead with "exclusive" and "luxury" as adjectives.',
      toneOfVoice: 'restrained editorial — confident without being loud, sophisticated without being stuffy. Think Wall Street Journal feature article, not yacht-broker pitch deck.',
      industry: 'Luxury residential real estate',
      brief:
        'Build the homepage for a luxury real estate brokerage operating in three markets (Aspen, Naples, Hamptons). The brokerage represents a small curated portfolio of $5M-$50M residential properties. The page must establish editorial credibility and capture leads who are 6-18 months away from purchase. The lead magnet is a quarterly market intelligence report tied to wealth-preservation themes. Top objections: "every luxury agent claims discretion and access — what makes you different," "I already have a relationship with another broker in this market," and "I am not ready to look yet, I am just researching." Brand pillars: market intelligence first sales second, the curated few not the listing flood, discretion is the product.',
    },
    notes: 'Industry-switching regressions surface if the LLM returns a SaaS-style aggressive lead capture instead of an editorial long-cycle authority play.',
  },
  {
    caseId: 'copy_specialist_ecommerce_dtc_launch_landing',
    agentId: 'COPY_SPECIALIST',
    name: 'DTC sleep supplement launch landing (mobile-first)',
    description:
      'Complexity-stress case. Tests whether the LLM scales messaging strategy to a fast-velocity mobile-first DTC launch with real urgency and founder-led voice.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['generate_copy', 'ecommerce', 'dtc', 'product_launch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.siteWideMessagingPillars.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 pillars.' },
      { path: '$.keyObjections.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 objections.' },
    ],
    inputPayload: {
      action: 'generate_copy',
      pageType: 'product_launch',
      funnelType: 'paid_traffic_to_purchase',
      targetAudience: 'Mobile-first millennial and Gen Z lifestyle shoppers who arrived from a TikTok or Instagram ad. Decision speed is fast (60-90 seconds on the page) but they are skeptical of dropshipping fronts. They check reviews, founder stories, and shipping policy before tapping buy.',
      toneOfVoice: 'energetic and confident with a founder-led voice. Specific product details, real founder face, no marketing-speak. The brand is small enough to be authentic, large enough to ship reliably.',
      industry: 'DTC lifestyle products — wellness and home',
      brief:
        'Build the launch landing page for a new DTC sleep-supplement product (a melatonin-free magnesium-glycinate complex with L-theanine). The page must convert cold paid traffic from TikTok and Instagram in under 90 seconds on mobile. The offer is launch pricing ($39 down from $49) for the first 1,000 orders, free shipping over $35, and a 60-day money-back guarantee. Top objections: "is this just another generic supplement," "how do I know this will not just be melatonin in a fancy bottle," and "I have been burned by Instagram ads before." Brand pillars: the formula your sleep doctor would actually approve, founder is a real chronic-insomnia survivor, third-party tested every batch.',
    },
    notes: 'Complexity-stress regressions surface if the LLM returns a generic SaaS-style framework when the brief clearly calls for an urgency-led DTC launch strategy.',
  },
];

// ---------------------------------------------------------------------------
// Funnel Engineer cases
// ---------------------------------------------------------------------------

const FUNNEL_ENGINEER_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'funnel_engineer_saas_b2b',
    agentId: 'FUNNEL_ENGINEER',
    name: 'B2B SaaS free-trial funnel (canonical)',
    description:
      'Canonical funnel design case. Exercises stage count, tactics/KPI prose fields, realistic conversion percentages, A/B test count, bottleneck risks, and rationale price-point reference.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['design_funnel', 'saas', 'free_trial', 'canonical', 'baseline'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.stages.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 stages.' },
      { path: '$.abTestRoadmap.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 tests.' },
      { path: '$.keyBottleneckRisks.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 risks.' },
    ],
    inputPayload: {
      action: 'design_funnel',
      context:
        'B2B SaaS sales velocity platform targeting B2B SaaS founders and revenue operators scaling $1M-$10M ARR. Primary goal: drive qualified free trial signups that convert to paid within 30 days.',
      requirements: {
        funnelType: 'free_trial',
        businessModel: 'saas_sales_ops',
        targetAudience: 'B2B SaaS founders and revenue operators scaling from $1M to $10M ARR',
        pricePoint: 'mid',
        productName: 'SalesVelocity.ai',
        trafficSource: 'LinkedIn paid + organic content + SEO',
      },
    },
    notes: 'Baseline case — any delta here flags upgrades across the whole Funnel Engineer surface.',
  },
  {
    caseId: 'funnel_engineer_realestate_luxury',
    agentId: 'FUNNEL_ENGINEER',
    name: 'Luxury real estate high-ticket funnel',
    description:
      'Industry-switching stress case with long sales cycle. Tests whether the LLM adapts funnel shape, stage count, and KPIs to high-ticket consultation vs SaaS free trial.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['design_funnel', 'real_estate', 'high_ticket', 'industry_switch', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.stages.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 stages.' },
      { path: '$.abTestRoadmap.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 tests.' },
      { path: '$.keyBottleneckRisks.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 risks.' },
    ],
    inputPayload: {
      action: 'design_funnel',
      context:
        'Luxury real estate brokerage funnel for high-ticket property transactions. Sales cycle is 6-18 months. Primary goal: move qualified affluent buyers from awareness through in-person property viewings.',
      requirements: {
        funnelType: 'high_ticket_consultation',
        businessModel: 'real_estate_luxury',
        targetAudience: 'Affluent buyers shopping $2M-$20M properties',
        pricePoint: 'high',
        productName: 'Legacy Estates Brokerage',
        trafficSource: 'Editorial content + Google Ads + broker referrals',
      },
    },
    notes: 'Industry-switching regressions surface if the LLM returns a SaaS-style trial funnel instead of a high-ticket consultation journey.',
  },
  {
    caseId: 'funnel_engineer_ecommerce_dtc',
    agentId: 'FUNNEL_ENGINEER',
    name: 'DTC ecommerce repeat-purchase funnel',
    description:
      'Business-model stress case with focus on retention instead of acquisition. Tests whether the LLM produces retention-weighted stages and KPIs.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['design_funnel', 'ecommerce', 'dtc', 'retention', 'stress'],
    createdBy: 'seed-script',
    shapeTolerances: [
      { path: '$.stages.length', kind: 'arrayLength', min: 3, max: 7, reason: 'Schema allows 3-7 stages.' },
      { path: '$.abTestRoadmap.length', kind: 'arrayLength', min: 3, max: 6, reason: 'Schema allows 3-6 tests.' },
      { path: '$.keyBottleneckRisks.length', kind: 'arrayLength', min: 2, max: 5, reason: 'Schema allows 2-5 risks.' },
    ],
    inputPayload: {
      action: 'design_funnel',
      context:
        'DTC ecommerce brand for premium lifestyle goods. Fast-velocity mobile-first purchase flow with emphasis on repeat purchase and subscription conversion.',
      requirements: {
        funnelType: 'dtc_repeat_purchase',
        businessModel: 'ecommerce_dtc',
        targetAudience: 'Millennial and Gen-Z shoppers on mobile, repeat purchasers of lifestyle goods',
        pricePoint: 'low',
        productName: 'North Point Goods',
        trafficSource: 'TikTok + Meta paid social + influencer partnerships',
      },
    },
    notes: 'Business-model regressions surface if the model produces B2B SaaS-style stages instead of DTC repeat-purchase stages.',
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
  LINKEDIN_EXPERT: LINKEDIN_EXPERT_CASES,
  TIKTOK_EXPERT: TIKTOK_EXPERT_CASES,
  TWITTER_X_EXPERT: TWITTER_X_EXPERT_CASES,
  FACEBOOK_ADS_EXPERT: FACEBOOK_ADS_EXPERT_CASES,
  GROWTH_ANALYST: GROWTH_ANALYST_CASES,
  UX_UI_ARCHITECT: UX_UI_ARCHITECT_CASES,
  FUNNEL_ENGINEER: FUNNEL_ENGINEER_CASES,
  WORKFLOW_OPTIMIZER: WORKFLOW_OPTIMIZER_CASES,
  COPY_SPECIALIST: COPY_SPECIALIST_CASES,
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
