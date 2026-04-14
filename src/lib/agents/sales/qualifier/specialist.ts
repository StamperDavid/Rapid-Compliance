/**
 * Lead Qualifier Specialist — REAL AI AGENT (Task #46 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a pure hand-coded template —
 * TITLE_AUTHORITY_MAP lookup, INDUSTRY_BUDGET_MULTIPLIERS table,
 * `scoreBudget`/`scoreAuthority`/`scoreNeed`/`scoreTimeline` each running
 * deterministic arithmetic over a bag of signals, `SYSTEM_PROMPT` defined
 * but never sent to an LLM. The output was numerically plausible but
 * strategically worthless — a bag-of-signals BANT score can't tell you
 * what a lead's actual intent is or what your next move should be.
 *
 * After the rebuild, Lead Qualifier is a real LLM-backed analyst. Callers
 * (currently just Sales Manager's future dispatch path, plus the
 * `AGENT_IDS.LEAD_QUALIFIER` factory) supply lead data + optional scraper
 * intelligence + optional ICP override, and the specialist loads the
 * GM-backed system prompt, builds a lead-specific user prompt, calls
 * OpenRouter, validates against Zod, and returns a structured BANT
 * analysis with per-component signals, rationale, insights, data gaps,
 * and a recommended next action.
 *
 * Supported action (single):
 *   - qualify_lead — full BANT + ICP analysis with strategic recommendation
 *
 * Pattern matches Tasks #62-#66: GM-loaded system prompt with hardcoded
 * DEFAULT_SYSTEM_PROMPT fallback (lead data is external-content analysis,
 * not content generation), Zod input + output schemas, callOpenRouter with
 * truncation backstop, `__internal` export for harness reuse.
 *
 * @module agents/sales/qualifier/specialist
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'sales/qualifier/specialist.ts';
const SPECIALIST_ID = 'LEAD_QUALIFIER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['qualify_lead'] as const;

/**
 * Realistic max_tokens floor for the worst-case Lead Qualifier response.
 *
 * Derivation:
 *   QualifyLeadResultSchema worst case:
 *     4 BANT components × (5 signals × 200 + rationale 800) = 4 × 1800 = 7200
 *     insights 6 × 500 = 3000
 *     dataGaps 8 × 200 = 1600
 *     recommendedAction 500
 *     rationale 3000
 *     ≈ 15,300 chars total prose
 *     /3.0 chars/token = 5,100 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 6,625 tokens minimum.
 *
 *   Setting the floor at 8,000 tokens covers the schema with safety
 *   margin. The truncation backstop in callOpenRouter catches any
 *   overflow and fails loud.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 8000;

interface LeadQualifierGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are the Lead Qualifier for SalesVelocity.ai — the Sales-layer specialist who reads lead data (contact, company, engagement signals, optional scraper intelligence) and produces structured BANT qualification with strategic judgment. You think like a senior sales operations analyst who has qualified thousands of B2B leads across SaaS, e-commerce, professional services, and enterprise software, and knows the difference between a Series C unicorn poking around for curiosity and a lean 20-person agency that is genuinely ready to buy.

## Your role in the swarm

You do NOT fetch lead data (upstream systems already have the contact, company, engagement, and optional scraper intelligence). You read what you are given, reason about what it means, and produce structured BANT output that downstream specialists (Outreach Specialist, Deal Closer, Merchandiser) act on.

Bag-of-signals arithmetic — summing points for company size plus points for funding plus points for title lookup — is NOT lead qualification. It is a hand-built proxy for human judgment. Lead qualification is reading the data as a human analyst would, spotting what is actually there, discounting noise, and producing a score that reflects real purchase probability.

## BANT framework

Score each of the four BANT components on a 0-25 scale:

### Budget (0-25)
Can the lead afford this? Signals include:
- Company size (employee range, estimated revenue)
- Recent funding rounds (Series A/B/C/D, round size, runway implications)
- Pricing page engagement (visits, time on page, comparison behavior)
- Technology stack (premium tools in the stack signal willingness to pay)
- Industry benchmarks (some industries spend more on software than others)

A well-funded Series C SaaS company viewing pricing three times last week has strong budget signals. A bootstrapped 5-person shop using free tools has weak signals. Do not confuse "large company" with "has budget for us" — a 10,000-person enterprise with no engagement is not budget-qualified.

### Authority (0-25)
Is the contact a decision-maker? Signals include:
- Job title seniority (C-level, VP, Director, Manager, IC)
- Functional fit (CRO buys sales tools; CFO buys finance tools; VP Eng buys dev tools)
- Email domain (corporate vs personal — personal email is a red flag for B2B)
- LinkedIn seniority and network size
- Organizational context (small company founder has more authority than enterprise director)

A CEO of a 30-person agency has more purchase authority than a VP of Sales at a 5,000-person enterprise who needs sign-off from three layers. Contextualize.

### Need (0-25)
Is there a real problem we solve? Signals include:
- Pain points visible in the lead's public content (blog posts, job descriptions, website complaints)
- Competitor product usage (switching opportunity)
- Technology stack gaps that match our capability
- Industry challenges and trends
- Engagement patterns (what they clicked, what they downloaded)

Note: generic "we need sales automation" is weak need. Specific "we are hiring 3 SDRs and they burn 6 hours a day on manual outreach" is strong need.

### Timeline (0-25)
When are they buying? Signals include:
- Stated urgency in communications
- Contract expiration dates for competing tools
- Hiring activity (scaling teams signal immediate need)
- Fiscal year considerations (budget available now vs Q4 freeze)
- Active evaluation activity (demo requests, comparison shopping)

A lead who says "we need this live by next month for the Black Friday push" has strong timeline. A lead who says "we are researching tools for next year" has weak timeline.

## ICP alignment (0-100)

Separately from BANT, score how well the lead matches the Ideal Customer Profile (industry fit, company size fit, title fit, geographic fit, tech stack fit, disqualifier presence). ICP alignment is NOT a subset of BANT — a lead can have strong BANT but poor ICP alignment (they can afford it and need it but they are not who we target) or vice versa.

## Qualification tier (HOT | WARM | COLD | DISQUALIFIED)

- HOT: total BANT >= 75, ICP alignment >= 70, no disqualifiers — act this week
- WARM: total BANT >= 50, ICP alignment >= 50 — nurture with content + outreach
- COLD: total BANT >= 25 OR ICP alignment >= 40 — mark for monthly touch
- DISQUALIFIED: BANT < 25 AND ICP alignment < 40, OR hard disqualifier present (student, personal email only, competitor employee, sanctioned geography) — drop

## Hard rules

- NEVER inflate scores without supporting signals from the data. If a signal is absent, score it low.
- NEVER fabricate data. If you don't know the company's funding history, say so in dataGaps.
- Component confidence reflects how MUCH data you had, not how HIGH the score is. A 25/25 budget score from two weak signals is low-confidence.
- Signals you output MUST be grounded in the input data (name the field or quote the text).
- recommendedAction MUST be specific and executable — not "follow up" but "schedule a 15-minute discovery call to confirm the migration from Salesforce by end of Q2".
- dataGaps MUST be specific fields that, if known, would meaningfully change the score.
- insights MUST NOT just restate scores — they are strategic observations the downstream Outreach Specialist or Deal Closer should act on.

## Output format

Respond with ONLY a valid JSON object matching the schema described in the user prompt. No markdown fences. No preamble. No prose outside the JSON.`;

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Lead Qualifier',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REVENUE_DIRECTOR',
    capabilities: [
      'bant_scoring',
      'lead_qualification',
      'icp_alignment',
      'market_intelligence_integration',
      'qualification_reporting',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['qualify_lead'],
  outputSchema: {
    type: 'object',
    properties: {
      leadId: { type: 'string' },
      bantScore: { type: 'object' },
      icpAlignment: { type: 'number' },
      qualification: { type: 'string' },
      recommendedAction: { type: 'string' },
      insights: { type: 'array' },
      dataGaps: { type: 'array' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const EmployeeRangeEnum = z.enum(['1-10', '11-50', '51-200', '201-500', '500+', 'unknown']);
export type EmployeeRange = z.infer<typeof EmployeeRangeEnum>;

const SenioritySchema = z.enum([
  'C-Level',
  'VP',
  'Director',
  'Manager',
  'Individual',
  'Unknown',
]);

const LeadContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().min(3).max(320),
  title: z.string().min(1).max(200),
  phone: z.string().max(40).optional(),
  linkedinUrl: z.string().max(500).optional(),
  linkedinConnections: z.number().int().min(0).max(100000).optional(),
  seniority: SenioritySchema.optional(),
});

const LeadCompanySchema = z.object({
  name: z.string().min(1).max(300),
  domain: z.string().min(2).max(300),
  industry: z.string().min(1).max(200),
  employeeRange: EmployeeRangeEnum,
  estimatedRevenue: z.number().min(0).max(1_000_000_000_000).optional(),
  fundingStage: z.string().max(100).optional(),
  fundingAmount: z.number().min(0).max(100_000_000_000).optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional(),
  headquarters: z.string().max(300).optional(),
  techStack: z.array(z.string().min(1).max(100)).max(50).optional(),
});

const LeadEngagementSchema = z.object({
  pagesViewed: z.array(z.string().min(1).max(500)).max(100).default([]),
  formSubmissions: z.array(z.string().min(1).max(300)).max(30).default([]),
  emailInteractions: z.array(z.string().min(1).max(300)).max(50).default([]),
  chatInteractions: z.array(z.string().min(1).max(300)).max(30).optional(),
  downloadedAssets: z.array(z.string().min(1).max(300)).max(30).optional(),
  webinarAttendance: z.array(z.string().min(1).max(300)).max(20).optional(),
  demoRequested: z.boolean().optional(),
  pricingPageViews: z.number().int().min(0).max(1000).optional(),
  lastActivityDate: z.string().max(50).optional(),
});

const ScraperIntelligenceSchema = z.object({
  keyFindings: z.object({
    companyName: z.string().max(300).nullable().optional(),
    industry: z.string().max(200).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    employeeRange: EmployeeRangeEnum.optional(),
    valueProposition: z.string().max(1000).optional(),
    targetCustomer: z.string().max(1000).optional(),
  }).optional(),
  businessSignals: z.object({
    isHiring: z.boolean().optional(),
    openPositions: z.number().int().min(0).max(10000).optional(),
    hasEcommerce: z.boolean().optional(),
    hasBlog: z.boolean().optional(),
  }).optional(),
  techSignals: z.object({
    detectedPlatforms: z.array(z.string().min(1).max(100)).max(40).optional(),
    detectedTools: z.array(z.string().min(1).max(100)).max(80).optional(),
    techMaturity: z.string().max(100).optional(),
  }).optional(),
  strategicObservations: z.array(z.string().min(5).max(500)).max(10).optional(),
}).optional();

const ICPProfileSchema = z.object({
  targetIndustries: z.array(z.string().min(1).max(200)).max(30),
  targetCompanySizes: z.array(EmployeeRangeEnum).max(6),
  targetTitles: z.array(z.string().min(1).max(200)).max(40),
  targetTechStack: z.array(z.string().min(1).max(200)).max(40).optional(),
  targetRevenue: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }).optional(),
  targetGeographies: z.array(z.string().min(1).max(200)).max(40).optional(),
  mustHaveSignals: z.array(z.string().min(1).max(300)).max(20).optional(),
  disqualifiers: z.array(z.string().min(1).max(300)).max(20).optional(),
});

const ScoringWeightsSchema = z.object({
  budget: z.number().min(0).max(5),
  authority: z.number().min(0).max(5),
  need: z.number().min(0).max(5),
  timeline: z.number().min(0).max(5),
});

const QualifyLeadPayloadSchema = z.object({
  action: z.literal('qualify_lead'),
  leadId: z.string().min(1).max(300),
  contact: LeadContactSchema,
  company: LeadCompanySchema,
  engagement: LeadEngagementSchema.optional(),
  scraperIntel: ScraperIntelligenceSchema,
  icp: ICPProfileSchema.optional(),
  customWeights: ScoringWeightsSchema.optional(),
  notes: z.string().max(3000).optional(),
});

export type QualifyLeadPayload = z.infer<typeof QualifyLeadPayloadSchema>;
export type LeadContact = z.infer<typeof LeadContactSchema>;
export type LeadCompany = z.infer<typeof LeadCompanySchema>;
export type LeadEngagement = z.infer<typeof LeadEngagementSchema>;
export type ScraperIntelligence = NonNullable<z.infer<typeof ScraperIntelligenceSchema>>;
export type ICPProfile = z.infer<typeof ICPProfileSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const QualificationTierEnum = z.enum(['HOT', 'WARM', 'COLD', 'DISQUALIFIED']);
export type QualificationTier = z.infer<typeof QualificationTierEnum>;

const BANTComponentScoreSchema = z.object({
  score: z.number().int().min(0).max(25),
  signals: z.array(z.string().min(5).max(400)).min(1).max(5),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(20).max(800),
});

export type BANTComponentScore = z.infer<typeof BANTComponentScoreSchema>;

const BANTScoreSchema = z.object({
  budget: BANTComponentScoreSchema,
  authority: BANTComponentScoreSchema,
  need: BANTComponentScoreSchema,
  timeline: BANTComponentScoreSchema,
  total: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
});

export type BANTScore = z.infer<typeof BANTScoreSchema>;

const QualifyLeadResultSchema = z.object({
  action: z.literal('qualify_lead'),
  leadId: z.string().min(1).max(300),
  qualifiedAt: z.string().min(10).max(60),
  bantScore: BANTScoreSchema,
  icpAlignment: z.number().int().min(0).max(100),
  qualification: QualificationTierEnum,
  recommendedAction: z.string().min(20).max(500),
  insights: z.array(z.string().min(20).max(500)).min(2).max(6),
  dataGaps: z.array(z.string().min(5).max(200)).max(8),
  rationale: z.string().min(100).max(3000),
});

export type QualifyLeadResult = z.infer<typeof QualifyLeadResultSchema>;
export type QualificationResult = QualifyLeadResult;
export type QualificationRequest = QualifyLeadPayload;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: LeadQualifierGMConfig;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);

  if (!gmRecord) {
    logger.warn(
      `[LeadQualifier] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback. ` +
      `Run node scripts/seed-lead-qualifier-gm.js to promote to GM-backed analysis.`,
      { file: FILE },
    );
    return {
      gm: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        model: 'claude-sonnet-4.6',
        temperature: 0.3,
        maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
        supportedActions: [...SUPPORTED_ACTIONS],
      },
      resolvedSystemPrompt: DEFAULT_SYSTEM_PROMPT,
      source: 'fallback',
    };
  }

  const config = gmRecord.config as Partial<LeadQualifierGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Lead Qualifier GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: LeadQualifierGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.3,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  return { gm, resolvedSystemPrompt: systemPrompt, source: 'gm' };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

async function callOpenRouter(ctx: LlmCallContext, userPrompt: string): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens: ctx.gm.maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Lead Qualifier: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the input payload. ` +
      `Realistic worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: qualify_lead
// ============================================================================

function formatScraperIntel(intel: ScraperIntelligence | undefined): string {
  if (!intel) { return '(none provided)'; }
  const lines: string[] = [];
  if (intel.keyFindings) {
    const kf = intel.keyFindings;
    if (kf.description) { lines.push(`Description: ${kf.description}`); }
    if (kf.valueProposition) { lines.push(`Value proposition: ${kf.valueProposition}`); }
    if (kf.targetCustomer) { lines.push(`Target customer: ${kf.targetCustomer}`); }
  }
  if (intel.businessSignals) {
    const bs = intel.businessSignals;
    const parts: string[] = [];
    if (bs.isHiring !== undefined) { parts.push(`isHiring=${bs.isHiring}`); }
    if (bs.openPositions !== undefined) { parts.push(`openPositions=${bs.openPositions}`); }
    if (bs.hasEcommerce !== undefined) { parts.push(`hasEcommerce=${bs.hasEcommerce}`); }
    if (bs.hasBlog !== undefined) { parts.push(`hasBlog=${bs.hasBlog}`); }
    if (parts.length > 0) { lines.push(`Business signals: ${parts.join(', ')}`); }
  }
  if (intel.techSignals) {
    const ts = intel.techSignals;
    if (ts.detectedPlatforms && ts.detectedPlatforms.length > 0) {
      lines.push(`Detected platforms: ${ts.detectedPlatforms.join(', ')}`);
    }
    if (ts.detectedTools && ts.detectedTools.length > 0) {
      lines.push(`Detected tools: ${ts.detectedTools.slice(0, 30).join(', ')}`);
    }
    if (ts.techMaturity) { lines.push(`Tech maturity: ${ts.techMaturity}`); }
  }
  if (intel.strategicObservations && intel.strategicObservations.length > 0) {
    lines.push(`Strategic observations:\n  - ${intel.strategicObservations.join('\n  - ')}`);
  }
  return lines.length > 0 ? lines.join('\n') : '(empty intelligence object)';
}

function formatEngagement(e: LeadEngagement | undefined): string {
  if (!e) { return '(no engagement data)'; }
  const lines: string[] = [];
  if (e.pagesViewed.length > 0) {
    lines.push(`Pages viewed (${e.pagesViewed.length}): ${e.pagesViewed.slice(0, 20).join(', ')}`);
  }
  if (e.formSubmissions.length > 0) {
    lines.push(`Form submissions: ${e.formSubmissions.join(', ')}`);
  }
  if (e.emailInteractions.length > 0) {
    lines.push(`Email interactions: ${e.emailInteractions.slice(0, 10).join(', ')}`);
  }
  if (e.chatInteractions && e.chatInteractions.length > 0) {
    lines.push(`Chat interactions: ${e.chatInteractions.slice(0, 10).join(', ')}`);
  }
  if (e.downloadedAssets && e.downloadedAssets.length > 0) {
    lines.push(`Downloaded assets: ${e.downloadedAssets.join(', ')}`);
  }
  if (e.webinarAttendance && e.webinarAttendance.length > 0) {
    lines.push(`Webinar attendance: ${e.webinarAttendance.join(', ')}`);
  }
  if (e.demoRequested !== undefined) { lines.push(`Demo requested: ${e.demoRequested}`); }
  if (e.pricingPageViews !== undefined) { lines.push(`Pricing page views: ${e.pricingPageViews}`); }
  if (e.lastActivityDate) { lines.push(`Last activity: ${e.lastActivityDate}`); }
  return lines.length > 0 ? lines.join('\n') : '(no engagement signals)';
}

function formatICP(icp: ICPProfile | undefined): string {
  if (!icp) { return '(no ICP override — use your judgment about our ideal customer)'; }
  const lines = [
    `Target industries: ${icp.targetIndustries.join(', ')}`,
    `Target company sizes: ${icp.targetCompanySizes.join(', ')}`,
    `Target titles: ${icp.targetTitles.join(', ')}`,
  ];
  if (icp.targetTechStack && icp.targetTechStack.length > 0) {
    lines.push(`Target tech stack: ${icp.targetTechStack.join(', ')}`);
  }
  if (icp.targetRevenue) {
    lines.push(`Target revenue: $${icp.targetRevenue.min.toLocaleString()} - $${icp.targetRevenue.max.toLocaleString()}`);
  }
  if (icp.targetGeographies && icp.targetGeographies.length > 0) {
    lines.push(`Target geographies: ${icp.targetGeographies.join(', ')}`);
  }
  if (icp.mustHaveSignals && icp.mustHaveSignals.length > 0) {
    lines.push(`Must-have signals: ${icp.mustHaveSignals.join('; ')}`);
  }
  if (icp.disqualifiers && icp.disqualifiers.length > 0) {
    lines.push(`Disqualifiers: ${icp.disqualifiers.join('; ')}`);
  }
  return lines.join('\n');
}

function formatWeights(w: ScoringWeights | undefined): string {
  if (!w) { return '(default: budget=1, authority=1, need=1, timeline=1)'; }
  return `budget=${w.budget}, authority=${w.authority}, need=${w.need}, timeline=${w.timeline}`;
}

function buildQualifyLeadPrompt(req: QualifyLeadPayload): string {
  const techStackLine = req.company.techStack && req.company.techStack.length > 0
    ? `Tech stack: ${req.company.techStack.join(', ')}`
    : 'Tech stack: (unknown)';

  const fundingLine = req.company.fundingStage
    ? `Funding: ${req.company.fundingStage}${req.company.fundingAmount ? ` ($${req.company.fundingAmount.toLocaleString()})` : ''}`
    : 'Funding: (unknown)';

  return [
    'ACTION: qualify_lead',
    '',
    `Lead ID: ${req.leadId}`,
    '',
    '## Contact',
    `Name: ${req.contact.name}`,
    `Email: ${req.contact.email}`,
    `Title: ${req.contact.title}`,
    req.contact.seniority ? `Seniority: ${req.contact.seniority}` : '',
    req.contact.linkedinUrl ? `LinkedIn: ${req.contact.linkedinUrl}` : '',
    req.contact.linkedinConnections !== undefined ? `LinkedIn connections: ${req.contact.linkedinConnections}` : '',
    '',
    '## Company',
    `Name: ${req.company.name}`,
    `Domain: ${req.company.domain}`,
    `Industry: ${req.company.industry}`,
    `Employee range: ${req.company.employeeRange}`,
    req.company.estimatedRevenue !== undefined ? `Estimated revenue: $${req.company.estimatedRevenue.toLocaleString()}` : '',
    fundingLine,
    req.company.foundedYear ? `Founded: ${req.company.foundedYear}` : '',
    req.company.headquarters ? `Headquarters: ${req.company.headquarters}` : '',
    techStackLine,
    '',
    '## Engagement',
    formatEngagement(req.engagement),
    '',
    '## Scraper intelligence',
    formatScraperIntel(req.scraperIntel),
    '',
    '## Ideal Customer Profile',
    formatICP(req.icp),
    '',
    '## Scoring weights (relative component importance)',
    formatWeights(req.customWeights),
    '',
    req.notes ? `## Notes from caller\n${req.notes}\n` : '',
    '---',
    '',
    'Produce structured BANT + ICP analysis. Respond with ONLY a valid JSON object:',
    '',
    '{',
    `  "action": "qualify_lead",`,
    `  "leadId": "${req.leadId}",`,
    '  "qualifiedAt": "<current ISO 8601 timestamp>",',
    '  "bantScore": {',
    '    "budget":    { "score": <0-25>, "signals": ["<1-5 specific signals from the data>"], "confidence": <0-1>, "rationale": "<20-800 chars why>" },',
    '    "authority": { "score": <0-25>, "signals": ["<1-5 specific signals>"], "confidence": <0-1>, "rationale": "<20-800 chars why>" },',
    '    "need":      { "score": <0-25>, "signals": ["<1-5 specific signals>"], "confidence": <0-1>, "rationale": "<20-800 chars why>" },',
    '    "timeline":  { "score": <0-25>, "signals": ["<1-5 specific signals>"], "confidence": <0-1>, "rationale": "<20-800 chars why>" },',
    '    "total": <sum of four component scores, 0-100>,',
    '    "confidence": <weighted average of component confidences, 0-1>',
    '  },',
    '  "icpAlignment": <integer 0-100>,',
    '  "qualification": "<HOT | WARM | COLD | DISQUALIFIED>",',
    '  "recommendedAction": "<20-500 chars — specific executable next step, not a generic \'follow up\'>",',
    '  "insights": ["<2-6 strategic observations the downstream specialists should act on — NOT restatements of the scores>"],',
    '  "dataGaps": ["<0-8 specific missing data points that would meaningfully change the score>"],',
    '  "rationale": "<100-3000 chars strategic explanation tying the BANT scores, ICP alignment, and recommended action together>"',
    '}',
    '',
    'Hard rules:',
    '- bantScore.total MUST be the exact sum of the four component scores. Do not fudge the math.',
    '- Every signal you list MUST be grounded in a field from the input data (name the field or quote the text).',
    '- Apply the scoring weights multiplicatively to each component score if customWeights is provided — heavier weight means that component matters more to the final decision but NOT that its raw score changes.',
    '- qualification tier rules: HOT = total>=75 AND icp>=70 AND no disqualifiers; WARM = total>=50 AND icp>=50; COLD = total>=25 OR icp>=40; DISQUALIFIED = total<25 AND icp<40, OR disqualifier present.',
    '- Apply the disqualifiers list from the ICP strictly — a single disqualifier match overrides BANT.',
  ].filter((line) => line !== '').join('\n');
}

async function executeQualifyLead(
  req: QualifyLeadPayload,
  ctx: LlmCallContext,
): Promise<QualifyLeadResult> {
  const userPrompt = buildQualifyLeadPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Lead Qualifier output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = QualifyLeadResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Lead Qualifier output did not match expected schema: ${issueSummary}`);
  }

  const data = result.data;

  // Enforce the bantScore.total = sum invariant even if the LLM fudged the math.
  const expectedTotal =
    data.bantScore.budget.score +
    data.bantScore.authority.score +
    data.bantScore.need.score +
    data.bantScore.timeline.score;
  if (data.bantScore.total !== expectedTotal) {
    throw new Error(
      `Lead Qualifier bantScore.total=${data.bantScore.total} does not equal sum of components=${expectedTotal}`,
    );
  }

  return data;
}

// ============================================================================
// LEAD QUALIFIER CLASS
// ============================================================================

export class LeadQualifierSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Lead Qualifier initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, [
          'Lead Qualifier: payload must be an object',
        ]);
      }

      // Normalize legacy shape: the pre-rebuild input was
      // { lead: LeadData, scraperIntel?, icp?, customWeights? }.
      // The new shape flattens lead fields to the top level.
      const normalized = this.normalizePayload(rawPayload);

      const inputValidation = QualifyLeadPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Lead Qualifier: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[LeadQualifier] Executing qualify_lead taskId=${taskId} leadId=${payload.leadId}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeQualifyLead(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[LeadQualifier] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Accept two input shapes:
   *   1. New flat: { action, leadId, contact, company, engagement?, ... }
   *   2. Legacy:   { action?, lead: { leadId, contact, company, engagement, ... }, scraperIntel?, icp?, customWeights? }
   */
  private normalizePayload(raw: Record<string, unknown>): Record<string, unknown> {
    if (raw.contact !== undefined && raw.company !== undefined) {
      return { ...raw, action: raw.action ?? 'qualify_lead' };
    }

    if (raw.lead !== null && typeof raw.lead === 'object') {
      const lead = raw.lead as Record<string, unknown>;
      return {
        action: raw.action ?? 'qualify_lead',
        leadId: lead.leadId ?? raw.leadId,
        contact: lead.contact,
        company: lead.company,
        engagement: lead.engagement,
        scraperIntel: raw.scraperIntel ?? lead.scraperIntel,
        icp: raw.icp,
        customWeights: raw.customWeights,
        notes: raw.notes,
      };
    }

    return { ...raw, action: raw.action ?? 'qualify_lead' };
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };
    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 620, boilerplate: 80 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createLeadQualifierSpecialist(): LeadQualifierSpecialist {
  return new LeadQualifierSpecialist();
}

let instance: LeadQualifierSpecialist | null = null;

export function getLeadQualifierSpecialist(): LeadQualifierSpecialist {
  instance ??= createLeadQualifierSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS (exported for proof-of-life harness + regression executor)
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  DEFAULT_SYSTEM_PROMPT,
  loadGMConfig,
  stripJsonFences,
  buildQualifyLeadPrompt,
  executeQualifyLead,
  QualifyLeadPayloadSchema,
  QualifyLeadResultSchema,
  BANTScoreSchema,
};
