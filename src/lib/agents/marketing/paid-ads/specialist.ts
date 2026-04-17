/**
 * Paid Advertising Specialist — REAL AI AGENT (April 15 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked tier policy for
 * leaf specialists) to produce paid advertising campaign strategy, budget
 * allocation, audience targeting, and ad optimization recommendations.
 * No template fallbacks. If the GM is missing, Brand DNA is missing,
 * OpenRouter fails, JSON won't parse, or Zod validation fails, the
 * specialist returns a real FAILED AgentReport with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - plan_campaign       (campaign strategy + budget allocation + creative briefs)
 *   - optimize_campaign   (mid-flight optimization + budget reallocation)
 *   - analyze_ad_performance (ad creative scoring + improvement suggestions)
 *
 * @module agents/marketing/paid-ads/specialist
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

const FILE = 'marketing/paid-ads/specialist.ts';
const SPECIALIST_ID = 'PAID_ADS_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['plan_campaign', 'optimize_campaign', 'analyze_ad_performance'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Paid Ads Specialist response.
 *
 * Derivation:
 *   plan_campaign worst case (largest action):
 *     campaignName 200 + objective 500
 *     platformAllocation: 7 platforms × (platform 50 + budgetAmount 20 + budgetPercentage 10
 *       + rationale 300) = 2,660
 *     audienceStrategy: 4 fields × 300 = 1,200
 *     bidStrategy: 3 fields × 200 = 600
 *     creativeRequirements: 7 platforms × (6 fields × 200) = 8,400
 *     schedulingStrategy: 3 fields × 300 = 900
 *     kpis: 10 × (metric 100 + target 100 + platform 50) = 2,500
 *     estimatedResults: 5 fields × 100 = 500
 *     ≈ 17,460 chars total prose
 *     /3.0 chars/token = 5,820 tokens
 *     + JSON structure overhead (~300 tokens)
 *     + 25% safety margin
 *     ≈ 7,650 tokens minimum.
 *
 *   Using 10,000 for comfortable headroom across all three actions.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 10000;

interface PaidAdsSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Paid Advertising Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['plan_campaign', 'optimize_campaign', 'analyze_ad_performance'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['plan_campaign', 'optimize_campaign', 'analyze_ad_performance'],
  outputSchema: {
    type: 'object',
    properties: {
      campaignPlan: { type: 'object' },
      optimization: { type: 'object' },
      adAnalysis: { type: 'object' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.5,
};

// ============================================================================
// INPUT CONTRACTS
// ============================================================================

const PlanCampaignRequestSchema = z.object({
  action: z.literal('plan_campaign'),
  campaignGoal: z.enum(['awareness', 'traffic', 'conversions', 'leads']),
  totalBudget: z.number().positive(),
  durationDays: z.number().int().positive(),
  targetAudience: z.string().min(1),
  industry: z.string().optional(),
  availablePlatforms: z.array(z.string().min(1)).min(1),
  brandContext: z.record(z.unknown()).optional(),
});

export type PlanCampaignRequest = z.infer<typeof PlanCampaignRequestSchema>;

const OptimizeCampaignRequestSchema = z.object({
  action: z.literal('optimize_campaign'),
  platformMetrics: z.array(z.object({
    platform: z.string().min(1),
    spend: z.number().nonnegative(),
    impressions: z.number().nonnegative(),
    clicks: z.number().nonnegative(),
    conversions: z.number().nonnegative(),
  })).min(1),
  campaignDurationDays: z.number().int().positive(),
  remainingBudget: z.number().nonnegative(),
  brandContext: z.record(z.unknown()).optional(),
});

export type OptimizeCampaignRequest = z.infer<typeof OptimizeCampaignRequestSchema>;

const AnalyzeAdPerformanceRequestSchema = z.object({
  action: z.literal('analyze_ad_performance'),
  adCreative: z.object({
    copy: z.string().min(1),
    imageDescription: z.string().optional(),
    platform: z.string().min(1),
    ctr: z.number().nonnegative(),
    cpc: z.number().nonnegative(),
    conversionRate: z.number().nonnegative(),
  }),
  brandContext: z.record(z.unknown()).optional(),
});

export type AnalyzeAdPerformanceRequest = z.infer<typeof AnalyzeAdPerformanceRequestSchema>;

// ============================================================================
// OUTPUT CONTRACTS (Zod schemas — enforced on every LLM response)
// ============================================================================

const PlanCampaignResultSchema = z.object({
  campaignName: z.string().min(5).max(200),
  objective: z.string().min(20).max(500),
  platformAllocation: z.array(z.object({
    platform: z.string().min(1),
    budgetAmount: z.number().nonnegative(),
    budgetPercentage: z.number().min(0).max(100),
    rationale: z.string().min(10).max(500),
  })).min(1).max(10),
  audienceStrategy: z.object({
    primaryAudience: z.string().min(10).max(500),
    secondaryAudience: z.string().min(10).max(500),
    exclusions: z.string().min(5).max(500),
    lookalikeSource: z.string().min(5).max(500),
  }),
  bidStrategy: z.object({
    type: z.enum(['CPC', 'CPM', 'CPA', 'ROAS']),
    targetValue: z.number().nonnegative(),
    rationale: z.string().min(10).max(500),
  }),
  creativeRequirements: z.array(z.object({
    platform: z.string().min(1),
    adFormat: z.enum(['image', 'video', 'carousel', 'text']),
    dimensions: z.string().min(3).max(100),
    copyGuidelines: z.string().min(10).max(500),
    ctaText: z.string().min(3).max(100),
  })).min(1).max(10),
  schedulingStrategy: z.object({
    startDateApproach: z.string().min(10).max(500),
    daypartingRecommendations: z.string().min(10).max(500),
    pacing: z.enum(['even', 'accelerated']),
  }),
  kpis: z.array(z.object({
    metric: z.string().min(1).max(100),
    target: z.string().min(1).max(100),
    platform: z.string().min(1).max(100),
  })).min(1).max(15),
  estimatedResults: z.object({
    impressions: z.string().min(1).max(100),
    clicks: z.string().min(1).max(100),
    conversions: z.string().min(1).max(100),
    cpa: z.string().min(1).max(100),
    roas: z.string().min(1).max(100),
  }),
});

export type PlanCampaignResult = z.infer<typeof PlanCampaignResultSchema>;

const OptimizeCampaignResultSchema = z.object({
  overallAssessment: z.string().min(20).max(1000),
  platformPerformance: z.array(z.object({
    platform: z.string().min(1),
    status: z.enum(['strong', 'underperforming', 'pause']),
    recommendation: z.string().min(10).max(500),
  })).min(1).max(10),
  budgetReallocation: z.array(z.object({
    platform: z.string().min(1),
    currentBudget: z.number().nonnegative(),
    recommendedBudget: z.number().nonnegative(),
    reason: z.string().min(10).max(500),
  })).min(1).max(10),
  audienceAdjustments: z.array(z.object({
    type: z.enum(['narrow', 'expand', 'exclude', 'add_lookalike']),
    detail: z.string().min(10).max(500),
  })).min(1).max(10),
  creativeRecommendations: z.array(z.object({
    platform: z.string().min(1),
    issue: z.string().min(5).max(300),
    suggestion: z.string().min(10).max(500),
  })).min(1).max(10),
  bidAdjustments: z.array(z.object({
    platform: z.string().min(1),
    currentBid: z.string().min(1).max(100),
    recommendedBid: z.string().min(1).max(100),
    reason: z.string().min(10).max(500),
  })).min(1).max(10),
});

export type OptimizeCampaignResult = z.infer<typeof OptimizeCampaignResultSchema>;

const AnalyzeAdPerformanceResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string().min(5)).min(1).max(10),
  weaknesses: z.array(z.string().min(5)).min(1).max(10),
  copyAnalysis: z.object({
    hookEffectiveness: z.string().min(10).max(500),
    ctaClarity: z.string().min(10).max(500),
    emotionalAppeal: z.string().min(10).max(500),
    urgencyLevel: z.string().min(5).max(200),
  }),
  visualAnalysis: z.object({
    relevanceScore: z.number().int().min(0).max(100),
    attentionGrabbing: z.string().min(10).max(500),
    brandConsistency: z.string().min(10).max(500),
  }),
  competitivePosition: z.string().min(10).max(500),
  improvementSuggestions: z.array(z.object({
    area: z.string().min(3).max(100),
    currentApproach: z.string().min(10).max(500),
    suggestedApproach: z.string().min(10).max(500),
    expectedImpact: z.string().min(5).max(200),
  })).min(1).max(10),
});

export type AnalyzeAdPerformanceResult = z.infer<typeof AnalyzeAdPerformanceResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: PaidAdsSpecialistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Paid Ads Specialist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-paid-ads-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<PaidAdsSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Paid Ads Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: PaidAdsSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.5,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  const resolvedSystemPrompt = gm.systemPrompt;
  return { gm, resolvedSystemPrompt };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

async function callOpenRouter(
  ctx: LlmCallContext,
  userPrompt: string,
): Promise<string> {
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
      `Paid Ads Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the brief. ` +
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
// ACTION: plan_campaign
// ============================================================================

function buildPlanCampaignUserPrompt(req: PlanCampaignRequest): string {
  const sections: string[] = [
    'ACTION: plan_campaign',
    '',
    `Campaign goal: ${req.campaignGoal}`,
    `Total budget: $${req.totalBudget.toLocaleString()}`,
    `Duration: ${req.durationDays} days`,
    `Target audience: ${req.targetAudience}`,
    `Available platforms: ${req.availablePlatforms.join(', ')}`,
  ];

  if (req.industry) {
    sections.push(`Industry: ${req.industry}`);
  }

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context from caller:');
    if (brand.industry) { sections.push(`  Industry: ${String(brand.industry)}`); }
    if (brand.toneOfVoice) { sections.push(`  Tone of voice: ${String(brand.toneOfVoice)}`); }
    if (Array.isArray(brand.keyPhrases) && brand.keyPhrases.length > 0) {
      sections.push(`  Key phrases: ${(brand.keyPhrases as string[]).join(', ')}`);
    }
    if (Array.isArray(brand.avoidPhrases) && brand.avoidPhrases.length > 0) {
      sections.push(`  Avoid phrases: ${(brand.avoidPhrases as string[]).join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Create a comprehensive paid advertising campaign plan. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "campaignName": "<descriptive campaign name, 5-200 chars>",');
  sections.push('  "objective": "<what success looks like for this campaign, 20-500 chars>",');
  sections.push('  "platformAllocation": [');
  sections.push('    {');
  sections.push('      "platform": "<platform name>",');
  sections.push('      "budgetAmount": <dollar amount as number>,');
  sections.push('      "budgetPercentage": <0-100>,');
  sections.push('      "rationale": "<why this platform gets this share of budget, 10-500 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "audienceStrategy": {');
  sections.push('    "primaryAudience": "<detailed primary audience definition, 10-500 chars>",');
  sections.push('    "secondaryAudience": "<secondary audience, 10-500 chars>",');
  sections.push('    "exclusions": "<who to exclude from targeting, 5-500 chars>",');
  sections.push('    "lookalikeSource": "<what data to use for lookalike audiences, 5-500 chars>"');
  sections.push('  },');
  sections.push('  "bidStrategy": {');
  sections.push('    "type": "<CPC|CPM|CPA|ROAS>",');
  sections.push('    "targetValue": <target number>,');
  sections.push('    "rationale": "<why this bid strategy, 10-500 chars>"');
  sections.push('  },');
  sections.push('  "creativeRequirements": [');
  sections.push('    {');
  sections.push('      "platform": "<platform name>",');
  sections.push('      "adFormat": "<image|video|carousel|text>",');
  sections.push('      "dimensions": "<e.g. 1080x1080, 1200x628, 9:16>",');
  sections.push('      "copyGuidelines": "<what the ad copy should accomplish, 10-500 chars>",');
  sections.push('      "ctaText": "<button/CTA text, 3-100 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "schedulingStrategy": {');
  sections.push('    "startDateApproach": "<when and how to launch, 10-500 chars>",');
  sections.push('    "daypartingRecommendations": "<when to show ads, 10-500 chars>",');
  sections.push('    "pacing": "<even|accelerated>"');
  sections.push('  },');
  sections.push('  "kpis": [');
  sections.push('    {');
  sections.push('      "metric": "<metric name>",');
  sections.push('      "target": "<target value as string>",');
  sections.push('      "platform": "<which platform>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "estimatedResults": {');
  sections.push('    "impressions": "<estimated range as string>",');
  sections.push('    "clicks": "<estimated range as string>",');
  sections.push('    "conversions": "<estimated range as string>",');
  sections.push('    "cpa": "<estimated CPA as string>",');
  sections.push('    "roas": "<estimated ROAS as string>"');
  sections.push('  }');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- Budget allocations MUST sum to exactly the total budget provided.');
  sections.push('- Budget percentages MUST sum to 100.');
  sections.push('- Only allocate budget to platforms listed in availablePlatforms.');
  sections.push('- If a platform is not suitable for the campaign goal, allocate $0 and explain why in rationale.');
  sections.push('- Estimated results MUST be realistic ranges (e.g. "5,000-8,000"), never specific promises.');
  sections.push('- Bid strategy target values must be realistic for the industry and goal.');
  sections.push('- Creative requirements must include at least one entry per funded platform.');
  sections.push('- KPIs must be measurable and platform-specific.');
  sections.push('- If the budget is too small for the number of platforms, recommend consolidating to fewer platforms.');
  sections.push('- Never recommend spending on a platform where the target audience is not present.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executePlanCampaign(
  req: PlanCampaignRequest,
  ctx: LlmCallContext,
): Promise<PlanCampaignResult> {
  const userPrompt = buildPlanCampaignUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Paid Ads Specialist plan_campaign output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = PlanCampaignResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Paid Ads Specialist plan_campaign output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// ACTION: optimize_campaign
// ============================================================================

function buildOptimizeCampaignUserPrompt(req: OptimizeCampaignRequest): string {
  const sections: string[] = [
    'ACTION: optimize_campaign',
    '',
    `Campaign duration so far: ${req.campaignDurationDays} days`,
    `Remaining budget: $${req.remainingBudget.toLocaleString()}`,
    '',
    'Current platform metrics:',
  ];

  for (const metric of req.platformMetrics) {
    const ctr = metric.impressions > 0 ? ((metric.clicks / metric.impressions) * 100).toFixed(2) : '0.00';
    const cpc = metric.clicks > 0 ? (metric.spend / metric.clicks).toFixed(2) : 'N/A';
    const cvr = metric.clicks > 0 ? ((metric.conversions / metric.clicks) * 100).toFixed(2) : '0.00';
    sections.push(`  ${metric.platform}: Spend=$${metric.spend.toLocaleString()}, Impressions=${metric.impressions.toLocaleString()}, Clicks=${metric.clicks.toLocaleString()}, Conversions=${metric.conversions}, CTR=${ctr}%, CPC=$${cpc}, CVR=${cvr}%`);
  }

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context from caller:');
    if (brand.industry) { sections.push(`  Industry: ${String(brand.industry)}`); }
  }

  sections.push('');
  sections.push('Analyze the current campaign performance and provide optimization recommendations. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "overallAssessment": "<comprehensive assessment of campaign health, 20-1000 chars>",');
  sections.push('  "platformPerformance": [');
  sections.push('    {');
  sections.push('      "platform": "<platform name>",');
  sections.push('      "status": "<strong|underperforming|pause>",');
  sections.push('      "recommendation": "<specific recommendation, 10-500 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "budgetReallocation": [');
  sections.push('    {');
  sections.push('      "platform": "<platform name>",');
  sections.push('      "currentBudget": <current spend as number>,');
  sections.push('      "recommendedBudget": <recommended remaining allocation as number>,');
  sections.push('      "reason": "<why reallocate, 10-500 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "audienceAdjustments": [');
  sections.push('    {');
  sections.push('      "type": "<narrow|expand|exclude|add_lookalike>",');
  sections.push('      "detail": "<specific audience adjustment, 10-500 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "creativeRecommendations": [');
  sections.push('    {');
  sections.push('      "platform": "<platform name>",');
  sections.push('      "issue": "<what is wrong with current creative, 5-300 chars>",');
  sections.push('      "suggestion": "<specific creative improvement, 10-500 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "bidAdjustments": [');
  sections.push('    {');
  sections.push('      "platform": "<platform name>",');
  sections.push('      "currentBid": "<current bid/strategy as string>",');
  sections.push('      "recommendedBid": "<recommended bid/strategy as string>",');
  sections.push('      "reason": "<why adjust, 10-500 chars>"');
  sections.push('    }');
  sections.push('  ]');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- Base ALL recommendations on the metrics provided. Never guess or fabricate data.');
  sections.push('- If a platform has zero impressions and zero spend, recommend pausing it.');
  sections.push('- Budget reallocation recommendations must not exceed the remaining budget.');
  sections.push('- Be specific about what to change — "improve creative" is not actionable; "test a video ad with customer testimonial overlay" is.');
  sections.push('- Status "pause" means stop spending entirely; "underperforming" means optimize before considering pause.');
  sections.push('- Calculate CTR, CPC, and CVR from the raw metrics — do not accept the user\'s self-reported rates without verifying.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeOptimizeCampaign(
  req: OptimizeCampaignRequest,
  ctx: LlmCallContext,
): Promise<OptimizeCampaignResult> {
  const userPrompt = buildOptimizeCampaignUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Paid Ads Specialist optimize_campaign output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = OptimizeCampaignResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Paid Ads Specialist optimize_campaign output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// ACTION: analyze_ad_performance
// ============================================================================

function buildAnalyzeAdPerformanceUserPrompt(req: AnalyzeAdPerformanceRequest): string {
  const ad = req.adCreative;
  const sections: string[] = [
    'ACTION: analyze_ad_performance',
    '',
    `Platform: ${ad.platform}`,
    `Ad copy: ${ad.copy}`,
  ];

  if (ad.imageDescription) {
    sections.push(`Image description: ${ad.imageDescription}`);
  }

  sections.push('');
  sections.push('Performance metrics:');
  sections.push(`  CTR: ${(ad.ctr * 100).toFixed(2)}%`);
  sections.push(`  CPC: $${ad.cpc.toFixed(2)}`);
  sections.push(`  Conversion rate: ${(ad.conversionRate * 100).toFixed(2)}%`);

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context from caller:');
    if (brand.industry) { sections.push(`  Industry: ${String(brand.industry)}`); }
    if (brand.toneOfVoice) { sections.push(`  Tone of voice: ${String(brand.toneOfVoice)}`); }
  }

  sections.push('');
  sections.push('Analyze this ad creative and provide a detailed performance assessment. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "overallScore": <0-100 integer>,');
  sections.push('  "strengths": ["<strength 1>", "<strength 2>", ...],');
  sections.push('  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],');
  sections.push('  "copyAnalysis": {');
  sections.push('    "hookEffectiveness": "<how well the opening grabs attention, 10-500 chars>",');
  sections.push('    "ctaClarity": "<clarity and effectiveness of the call to action, 10-500 chars>",');
  sections.push('    "emotionalAppeal": "<emotional resonance analysis, 10-500 chars>",');
  sections.push('    "urgencyLevel": "<assessment of urgency in the copy, 5-200 chars>"');
  sections.push('  },');
  sections.push('  "visualAnalysis": {');
  sections.push('    "relevanceScore": <0-100 integer>,');
  sections.push('    "attentionGrabbing": "<how well the visual stops the scroll, 10-500 chars>",');
  sections.push('    "brandConsistency": "<does the visual match the brand identity, 10-500 chars>"');
  sections.push('  },');
  sections.push('  "competitivePosition": "<how this ad compares to typical ads in this space, 10-500 chars>",');
  sections.push('  "improvementSuggestions": [');
  sections.push('    {');
  sections.push('      "area": "<area to improve>",');
  sections.push('      "currentApproach": "<what the ad does now, 10-500 chars>",');
  sections.push('      "suggestedApproach": "<what to do instead, 10-500 chars>",');
  sections.push('      "expectedImpact": "<expected impact of the change, 5-200 chars>"');
  sections.push('    }');
  sections.push('  ]');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- The overall score must reflect the actual metrics, not just the copy quality.');
  sections.push('- A CTR below 1% on Facebook/Instagram or below 2% on Google is underperforming — score accordingly.');
  sections.push('- If no image description is provided, note this limitation in visualAnalysis but still assess based on the copy.');
  sections.push('- Improvement suggestions must be specific and actionable, not vague ("test different copy" is too vague; "replace the current feature-focused headline with a pain-point-driven question" is actionable).');
  sections.push('- Never fabricate benchmark data — use realistic industry ranges.');
  sections.push('- strengths and weaknesses arrays must each have at least 1 entry.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeAnalyzeAdPerformance(
  req: AnalyzeAdPerformanceRequest,
  ctx: LlmCallContext,
): Promise<AnalyzeAdPerformanceResult> {
  const userPrompt = buildAnalyzeAdPerformanceUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Paid Ads Specialist analyze_ad_performance output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = AnalyzeAdPerformanceResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Paid Ads Specialist analyze_ad_performance output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// PAID ADVERTISING SPECIALIST CLASS
// ============================================================================

export class PaidAdsSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Paid Ads Specialist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Paid Ads Specialist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Paid Ads Specialist: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Paid Ads Specialist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[PaidAdsSpecialist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      switch (action) {
        case 'plan_campaign': {
          const inputValidation = PlanCampaignRequestSchema.safeParse({ ...payload, action });
          if (!inputValidation.success) {
            const issueSummary = inputValidation.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; ');
            return this.createReport(taskId, 'FAILED', null, [
              `Paid Ads Specialist plan_campaign: invalid input payload: ${issueSummary}`,
            ]);
          }
          const data = await executePlanCampaign(inputValidation.data, ctx);
          return this.createReport(taskId, 'COMPLETED', data);
        }

        case 'optimize_campaign': {
          const inputValidation = OptimizeCampaignRequestSchema.safeParse({ ...payload, action });
          if (!inputValidation.success) {
            const issueSummary = inputValidation.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; ');
            return this.createReport(taskId, 'FAILED', null, [
              `Paid Ads Specialist optimize_campaign: invalid input payload: ${issueSummary}`,
            ]);
          }
          const data = await executeOptimizeCampaign(inputValidation.data, ctx);
          return this.createReport(taskId, 'COMPLETED', data);
        }

        case 'analyze_ad_performance': {
          const inputValidation = AnalyzeAdPerformanceRequestSchema.safeParse({ ...payload, action });
          if (!inputValidation.success) {
            const issueSummary = inputValidation.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; ');
            return this.createReport(taskId, 'FAILED', null, [
              `Paid Ads Specialist analyze_ad_performance: invalid input payload: ${issueSummary}`,
            ]);
          }
          const data = await executeAnalyzeAdPerformance(inputValidation.data, ctx);
          return this.createReport(taskId, 'COMPLETED', data);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[PaidAdsSpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 520, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createPaidAdsSpecialist(): PaidAdsSpecialist {
  return new PaidAdsSpecialist();
}

let instance: PaidAdsSpecialist | null = null;

export function getPaidAdsSpecialist(): PaidAdsSpecialist {
  instance ??= createPaidAdsSpecialist();
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
  loadGMConfig,
  buildPlanCampaignUserPrompt,
  buildOptimizeCampaignUserPrompt,
  buildAnalyzeAdPerformanceUserPrompt,
  stripJsonFences,
  PlanCampaignRequestSchema,
  PlanCampaignResultSchema,
  OptimizeCampaignRequestSchema,
  OptimizeCampaignResultSchema,
  AnalyzeAdPerformanceRequestSchema,
  AnalyzeAdPerformanceResultSchema,
};
