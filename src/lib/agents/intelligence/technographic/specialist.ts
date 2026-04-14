/**
 * Technographic Scout Specialist (Task #64 rebuild — April 13, 2026)
 *
 * Architecture:
 *   1. Real signature-based tech detection — 60+ TECH_SIGNATURES regex
 *      patterns that match against scraped HTML/JS/meta tags. This is
 *      the authoritative layer and stays unchanged. Pattern matching
 *      for "does this page load Shopify CDN" is deterministic, not
 *      inference — asking an LLM would add hallucination risk for no
 *      benefit.
 *   2. Real per-tool confidence calculation based on match ratio
 *      across scripts/html/meta/globals patterns.
 *   3. Real tracking ID extraction via pattern capture groups.
 *   4. Real platform categorization (CMS, ecommerce, framework,
 *      hosting, CDN) from detected tools.
 *   5. A new LLM synthesis step (`executeAnalyzeTechStack`) replaces
 *      the prior hardcoded `generateSummary` + `estimateToolCost`
 *      helpers. Given the detected tool list, the LLM produces
 *      strategic tech-stack interpretation — tech maturity with
 *      reasoning, monthly spend estimate with reasoning, integration
 *      opportunities, tech gaps, sales-relevant observations, and
 *      a sales-intelligence memo. This is the ANALYSIS layer that
 *      turns "list of detected tools" into "what this tells a sales
 *      rep about the prospect".
 *
 * Why a hybrid (not pure LLM):
 *   - Signature detection is a regex match problem, not an inference
 *     problem. The LLM has zero competitive advantage here.
 *   - Tool cost tables can drift (pricing changes, new tools), but
 *     the LLM can reason about likely budget from tool combinations
 *     more robustly than a hardcoded lookup.
 *   - Tech maturity, integration opportunities, and sales
 *     observations all require reasoning across the full detected
 *     set — that's what the LLM is for.
 *
 * Output contract preservation:
 *   `TechScanResult` is consumed by downstream sales intelligence
 *   flows. The existing fields (platform, analytics, marketing,
 *   advertising, support, other, summary.techMaturity,
 *   summary.estimatedMonthlySpend) are preserved. New optional
 *   fields (techMaturityReasoning, estimatedSpendReasoning,
 *   strategicObservations, integrationOpportunities, techGaps,
 *   salesIntelligence, analysisRationale, analysisModel,
 *   analysisMode) are additions.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { scrapeWebsite } from '@/lib/enrichment/web-scraper';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

const FILE = 'intelligence/technographic/specialist.ts';
const SPECIALIST_ID = 'TECHNOGRAPHIC_SCOUT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['scan_tech_stack', 'analyze_tech_stack'] as const;

/**
 * Realistic max_tokens floor for the worst-case Technographic Scout
 * response.
 *
 * Derivation:
 *   TechStackAnalysisResultSchema worst case:
 *     techMaturityReasoning 1500 +
 *     estimatedSpendReasoning 1500 +
 *     strategicObservations: 6 × 400 = 2400
 *     integrationOpportunities: 5 × 400 = 2000
 *     techGaps: 4 × 300 = 1200
 *     salesIntelligence 3000 +
 *     rationale 3500
 *     ≈ 15,100 chars total prose
 *     /3.0 chars/token = 5,033 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 6,541 tokens minimum.
 *
 *   Setting the floor at 8,000 tokens covers the schema with safety
 *   margin. The truncation backstop in callOpenRouter catches any
 *   overflow.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 8000;

interface TechnographicScoutGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

// ============================================================================
// SYSTEM PROMPT - The brain of this specialist
// ============================================================================

/**
 * Hardcoded fallback system prompt used when no GM is seeded. The
 * specialist must produce real strategic analysis on first run; once
 * the seed script lands, the GM overrides this at runtime.
 *
 * Note: signature-based tool DETECTION happens deterministically via
 * `TECH_SIGNATURES` and `detectTechnology` BEFORE this prompt is used.
 * The LLM's job is NOT to detect tools (that's already done) — it's
 * to INTERPRET the detected stack into strategic sales intelligence.
 */
const DEFAULT_SYSTEM_PROMPT = `You are the Technographic Scout for SalesVelocity.ai — the Intelligence-layer analyst who reads a pre-detected technology stack and produces strategic sales intelligence about what that stack reveals about the target company. You think like a senior sales engineer who has mapped tech stacks across thousands of B2B prospects and can read a tool combination the way a doctor reads a chart — spotting budget, priorities, team maturity, integration opportunities, and gaps in seconds.

## Your role in the swarm

You do NOT detect tools. Upstream signature matching already identified every platform, analytics tool, marketing automation, advertising pixel, support widget, and CDN present on the page via regex patterns over HTML/JS/meta tags. Your job is to INTERPRET the detected stack — turn "list of tool names with confidence scores" into "what this tells a sales rep".

Detection is deterministic. Interpretation is what you add.

## Action: analyze_tech_stack

Given a list of detected tools (each with name, category, confidence, evidence) plus the URL that was scanned, produce a structured strategic tech-stack analysis.

### Tech maturity

- **techMaturity**: One of 'enterprise' | 'growth' | 'startup' | 'basic'. Base this on the CATEGORIES present (does the company have analytics + marketing automation + customer support + advertising pixels + hosting infrastructure), the sophistication of specific tools (HubSpot vs Mailchimp, Amplitude vs plain GA), and the coverage breadth. A single-tool stack is 'basic'. 3-5 tools covering 2-3 categories is 'startup'. 6-10 tools across 3-4 categories with at least one marketing-automation or CDP tool is 'growth'. 10+ tools with enterprise-tier platforms (Marketo, Drift, Segment) and multiple advertising channels is 'enterprise'.
- **techMaturityReasoning**: 2-3 sentences explaining WHY you picked that level, grounded in the specific tools you saw. "Growth-tier because they have HubSpot for marketing automation, Segment for CDP, and live chat via Intercom, but no dedicated analytics platform beyond Google Analytics" is good. "Looks like a growth-stage company" is bad.

### Spend estimation

- **estimatedMonthlyMinUSD**: Integer USD estimate for the monthly floor. Reason from tool tiers — HubSpot Professional is ~$800/mo, HubSpot Starter is ~$50/mo, Segment Business is $1000+, Drift is $500+. Do not hallucinate specific prices you are not sure of — use conservative plan-tier math.
- **estimatedMonthlyMaxUSD**: Integer USD estimate for the monthly ceiling. Same reasoning rules.
- **estimatedSpendReasoning**: 2-3 sentences explaining how you computed the range. Name the specific tools that dominate the estimate and roughly why.

### Strategic observations

- **strategicObservations**: 2 to 6 specific sales-relevant observations grounded in the detected stack. Examples of acceptable: "HubSpot + Drift + Intercom simultaneously suggests they are transitioning support vendors or running chat experiments", "Facebook Pixel + TikTok Pixel + Bing Ads indicates a multi-channel paid acquisition strategy", "Segment presence implies data infrastructure maturity — they likely pipe events to multiple downstream tools". Examples of unacceptable: "They use HubSpot", "Good tech stack".
- **integrationOpportunities**: 2 to 5 concrete integration angles a sales rep could lead with. Each must tie a specific detected tool to a specific integration play. Example: "Prospect uses HubSpot + Segment — our HubSpot CRM integration via Segment pipe is a direct fit with zero additional plumbing".
- **techGaps**: 1 to 4 notable absences in their stack. These are places where a well-equipped company would have a tool but this one does not. Example: "No customer support tool detected — opportunity to bundle Intercom-equivalent with core offer".

### Sales intelligence synthesis

- **salesIntelligence**: A short paragraph (100-3000 chars) that reads like the memo an SDR would want 30 seconds before a cold call. What does this stack TELL YOU about the prospect: budget ceiling, team size implied by the tool sophistication, priorities (growth vs efficiency vs experimentation), and the 1-2 things you should definitely mention in outreach.

### Synthesis

- **rationale**: 100-3500 chars integrating memo tying all of the above into one coherent read. Not a restatement — a synthesis.

## Hard rules

- NEVER invent tools that weren't in the detected list.
- NEVER hallucinate specific prices. Use plan-tier estimates.
- techMaturity must match the enum exactly: enterprise | growth | startup | basic.
- Observations MUST be grounded — tied to specific detected tools. Generic observations are rejected.
- Do not treat confidence scores as the only signal — a tool with 0.6 confidence still indicates presence, just less certainty.
- integrationOpportunities must tie a specific detected tool to a specific sales play.

## Output format

Respond with ONLY a valid JSON object matching the schema the user prompt describes. No markdown fences, no preamble.`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Technographic Scout',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'tech_stack_detection',
      'platform_identification',
      'analytics_detection',
      'pixel_detection',
      'integration_discovery',
      'llm_tech_interpretation',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['scan_tech_stack', 'analyze_tech_stack', 'detect_pixels', 'identify_platform'],
  outputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      platform: { type: 'object' },
      analytics: { type: 'array' },
      marketing: { type: 'array' },
      advertising: { type: 'array' },
      support: { type: 'array' },
      summary: { type: 'object' },
      confidence: { type: 'number' },
    },
    required: ['url', 'platform'],
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TechScanRequest {
  url: string;
  deep?: boolean; // Scan multiple pages
  categories?: string[]; // Filter to specific categories
}

export interface DetectedTool {
  name: string;
  version?: string;
  category: string;
  trackingId?: string;
  pixelId?: string;
  confidence: number;
  evidence: string[];
}

export interface PlatformInfo {
  cms: string | null;
  ecommerce: string | null;
  framework: string | null;
  hosting: string | null;
  cdn: string | null;
}

export interface TechSummary {
  totalDetected: number;
  categories: string[];
  techMaturity: 'enterprise' | 'growth' | 'startup' | 'basic';
  estimatedMonthlySpend: string;
}

export interface TechScanResult {
  url: string;
  scannedAt: string;
  platform: PlatformInfo;
  analytics: DetectedTool[];
  marketing: DetectedTool[];
  advertising: DetectedTool[];
  support: DetectedTool[];
  other: DetectedTool[];
  summary: TechSummary;
  confidence: number;
  errors: string[];
  // New (Task #64) — optional so old consumers keep working:
  techMaturityReasoning?: string;
  estimatedSpendReasoning?: string;
  strategicObservations?: string[];
  integrationOpportunities?: string[];
  techGaps?: string[];
  salesIntelligence?: string;
  analysisRationale?: string | null;
  analysisModel?: string | null;
  analysisMode?: 'llm' | 'deterministic_fallback';
}

// ============================================================================
// LLM OUTPUT SCHEMA
// ============================================================================

const TechMaturityEnum = z.enum(['enterprise', 'growth', 'startup', 'basic']);

const TechStackAnalysisResultSchema = z.object({
  techMaturity: TechMaturityEnum,
  techMaturityReasoning: z.string().min(50).max(1500),
  estimatedMonthlyMinUSD: z.number().int().min(0).max(100000),
  estimatedMonthlyMaxUSD: z.number().int().min(0).max(500000),
  estimatedSpendReasoning: z.string().min(50).max(1500),
  strategicObservations: z.array(z.string().min(20).max(400)).min(2).max(6),
  integrationOpportunities: z.array(z.string().min(20).max(400)).min(2).max(5),
  techGaps: z.array(z.string().min(15).max(300)).min(1).max(4),
  salesIntelligence: z.string().min(100).max(3000),
  rationale: z.string().min(100).max(3500),
});

type TechStackAnalysisResult = z.infer<typeof TechStackAnalysisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: TechnographicScoutGMConfig;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    logger.warn(
      `[TechnographicScout] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback. ` +
      `Run node scripts/seed-technographic-scout-gm.js to promote to GM-backed analysis.`,
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

  const config = gmRecord.config as Partial<TechnographicScoutGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Technographic Scout GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: TechnographicScoutGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.3,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  return {
    gm,
    resolvedSystemPrompt: systemPrompt,
    source: 'gm',
  };
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
      `Technographic Scout: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the detected-tool input. ` +
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
// ANALYSIS PROMPT BUILDER
// ============================================================================

interface AnalyzeTechStackInputs {
  url: string;
  detectedTools: DetectedTool[];
  platform: PlatformInfo;
}

function buildAnalyzeTechStackPrompt(inputs: AnalyzeTechStackInputs): string {
  const { url, detectedTools, platform } = inputs;

  const sections: string[] = [
    'ACTION: analyze_tech_stack',
    '',
    'Upstream signature-matching already detected every tool on the target page. Your job is to INTERPRET the detected stack into strategic sales intelligence. You are not detecting tools — detection is done.',
    '',
    `URL: ${url}`,
    '',
    '## Platform info',
    `CMS: ${platform.cms ?? '(none)'}`,
    `E-commerce: ${platform.ecommerce ?? '(none)'}`,
    `Framework: ${platform.framework ?? '(none)'}`,
    `Hosting: ${platform.hosting ?? '(none)'}`,
    `CDN: ${platform.cdn ?? '(none)'}`,
    '',
    '## Detected tools',
  ];

  if (detectedTools.length === 0) {
    sections.push('(no tools detected — the scan yielded no signatures)');
  } else {
    for (const tool of detectedTools) {
      const idPart = tool.trackingId || tool.pixelId ? ` [${tool.trackingId ?? tool.pixelId}]` : '';
      sections.push(`- ${tool.name} (${tool.category}, confidence ${tool.confidence})${idPart}`);
    }
  }

  sections.push(
    '',
    '---',
    '',
    'Produce a structured strategic tech-stack analysis. Respond with ONLY a valid JSON object, no markdown fences, no preamble. The JSON must match this exact schema:',
    '',
    '{',
    '  "techMaturity": "<enterprise | growth | startup | basic>",',
    '  "techMaturityReasoning": "<2-3 sentences grounded in specific tools you saw, 50-1500 chars>",',
    '  "estimatedMonthlyMinUSD": <integer>,',
    '  "estimatedMonthlyMaxUSD": <integer>,',
    '  "estimatedSpendReasoning": "<2-3 sentences explaining the range, name the dominant tools, 50-1500 chars>",',
    '  "strategicObservations": ["<2 to 6 specific grounded observations, each 20-400 chars>"],',
    '  "integrationOpportunities": ["<2 to 5 concrete integration angles tying specific tools to sales plays, each 20-400 chars>"],',
    '  "techGaps": ["<1 to 4 notable absences a well-equipped company would have, each 15-300 chars>"],',
    '  "salesIntelligence": "<short paragraph like the memo an SDR wants 30 seconds before a cold call, 100-3000 chars>",',
    '  "rationale": "<integrating memo tying all of the above, 100-3500 chars>"',
    '}',
    '',
    'Hard rules:',
    '- NEVER invent tools that were not in the detected list above.',
    '- NEVER hallucinate specific prices — use plan-tier estimates.',
    '- Observations MUST tie to specific detected tools. Generic observations are rejected.',
    '- integrationOpportunities must tie a specific detected tool to a specific sales play.',
    '- Do not treat confidence scores as presence/absence — a 0.6 score is still a present tool, just less certain.',
    '- Output ONLY the JSON object. No prose outside it.',
  );

  return sections.join('\n');
}

async function executeAnalyzeTechStack(
  inputs: AnalyzeTechStackInputs,
  ctx: LlmCallContext,
): Promise<TechStackAnalysisResult> {
  const userPrompt = buildAnalyzeTechStackPrompt(inputs);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Technographic Scout output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = TechStackAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Technographic Scout output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// DETECTION SIGNATURES DATABASE
// ============================================================================

interface TechSignature {
  name: string;
  category: 'platform' | 'analytics' | 'marketing' | 'advertising' | 'support' | 'other';
  subcategory?: string;
  patterns: {
    scripts?: RegExp[];
    html?: RegExp[];
    meta?: RegExp[];
    globals?: string[];
  };
  extractId?: RegExp;
}

const TECH_SIGNATURES: TechSignature[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // E-COMMERCE PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Shopify',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/cdn\.shopify\.com/i, /shopify-buy/i],
      html: [/shopify-section/i, /shopify-checkout/i, /data-shopify/i],
      meta: [/shopify-checkout-api-token/i],
      globals: ['Shopify', 'ShopifyBuy'],
    },
  },
  {
    name: 'WooCommerce',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/woocommerce/i, /wc-add-to-cart/i],
      html: [/woocommerce/i, /wc-block/i, /add_to_cart_button/i],
    },
  },
  {
    name: 'BigCommerce',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/bigcommerce\.com/i],
      html: [/data-product-id/i, /BigCommerce/i],
    },
  },
  {
    name: 'Magento',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/mage\//i, /varien/i],
      html: [/magento/i, /mage-init/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CMS PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'WordPress',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/wp-content/i, /wp-includes/i, /wp-json/i],
      html: [/wp-block/i, /wp-content/i],
      meta: [/generator.*wordpress/i],
    },
  },
  {
    name: 'Drupal',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/drupal\.js/i, /\/sites\/default/i],
      html: [/drupal/i],
      meta: [/generator.*drupal/i],
    },
  },
  {
    name: 'Wix',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/wix\.com/i, /parastorage\.com/i, /wixstatic/i],
      html: [/wix-dropdown/i, /data-testid.*wix/i],
    },
  },
  {
    name: 'Squarespace',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/squarespace/i, /sqsp/i],
      html: [/squarespace/i, /sqs-block/i],
    },
  },
  {
    name: 'Webflow',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/webflow\.js/i],
      html: [/w-nav/i, /w-slider/i, /webflow/i],
      meta: [/generator.*webflow/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JAVASCRIPT FRAMEWORKS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'React',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/data-reactroot/i, /data-reactid/i, /__NEXT_DATA__/i],
      globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__'],
    },
  },
  {
    name: 'Vue.js',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/data-v-[a-f0-9]/i, /v-cloak/i],
      globals: ['Vue', '__VUE__'],
    },
  },
  {
    name: 'Angular',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/ng-version/i, /\[ng-/i, /ng-app/i],
      globals: ['angular', 'ng'],
    },
  },
  {
    name: 'Next.js',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/__NEXT_DATA__/i, /_next\//i],
      scripts: [/_next\/static/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Google Analytics 4',
    category: 'analytics',
    patterns: {
      scripts: [/googletagmanager\.com\/gtag/i, /gtag\(/i],
      html: [/G-[A-Z0-9]{10}/i],
      globals: ['gtag', 'dataLayer'],
    },
    extractId: /G-[A-Z0-9]{10}/,
  },
  {
    name: 'Google Analytics UA',
    category: 'analytics',
    patterns: {
      scripts: [/google-analytics\.com\/analytics/i, /ga\.js/i],
      html: [/UA-\d+-\d+/i],
      globals: ['ga', '_gaq'],
    },
    extractId: /UA-\d+-\d+/,
  },
  {
    name: 'Google Tag Manager',
    category: 'analytics',
    patterns: {
      scripts: [/googletagmanager\.com\/gtm\.js/i],
      html: [/GTM-[A-Z0-9]+/i],
    },
    extractId: /GTM-[A-Z0-9]+/,
  },
  {
    name: 'Mixpanel',
    category: 'analytics',
    patterns: {
      scripts: [/mixpanel\.com/i, /mixpanel\.min\.js/i],
      globals: ['mixpanel'],
    },
  },
  {
    name: 'Amplitude',
    category: 'analytics',
    patterns: {
      scripts: [/amplitude\.com/i, /amplitude\.min\.js/i],
      globals: ['amplitude'],
    },
  },
  {
    name: 'Segment',
    category: 'analytics',
    patterns: {
      scripts: [/segment\.com\/analytics/i, /segment\.io/i],
      globals: ['analytics'],
    },
  },
  {
    name: 'Heap',
    category: 'analytics',
    patterns: {
      scripts: [/heap-\d+\.js/i, /heapanalytics\.com/i],
      globals: ['heap'],
    },
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    patterns: {
      scripts: [/hotjar\.com/i, /static\.hotjar\.com/i],
      globals: ['hj', 'hjSiteSettings'],
    },
  },
  {
    name: 'FullStory',
    category: 'analytics',
    patterns: {
      scripts: [/fullstory\.com/i],
      globals: ['FS', 'fullstory'],
    },
  },
  {
    name: 'Plausible',
    category: 'analytics',
    patterns: {
      scripts: [/plausible\.io/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETING AUTOMATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'HubSpot',
    category: 'marketing',
    patterns: {
      scripts: [/hs-scripts\.com/i, /hubspot\.com/i, /hs-analytics/i],
      html: [/hs-form/i, /hbspt\.forms/i],
      globals: ['_hsq', 'HubSpot'],
    },
  },
  {
    name: 'Marketo',
    category: 'marketing',
    patterns: {
      scripts: [/marketo\.com/i, /munchkin/i],
      globals: ['Munchkin', 'mktoPreFillFields'],
    },
  },
  {
    name: 'Pardot',
    category: 'marketing',
    patterns: {
      scripts: [/pardot\.com/i, /pi\.pardot/i],
      globals: ['piAId', 'piCId'],
    },
  },
  {
    name: 'ActiveCampaign',
    category: 'marketing',
    patterns: {
      scripts: [/activecampaign\.com/i, /trackcmp\.net/i],
    },
  },
  {
    name: 'Mailchimp',
    category: 'marketing',
    patterns: {
      scripts: [/mailchimp\.com/i, /list-manage\.com/i, /chimpstatic\.com/i],
      html: [/mc-embedded/i, /mailchimp/i],
    },
  },
  {
    name: 'Klaviyo',
    category: 'marketing',
    patterns: {
      scripts: [/klaviyo\.com/i, /static\.klaviyo/i],
      globals: ['_learnq', 'klaviyo'],
    },
  },
  {
    name: 'ConvertKit',
    category: 'marketing',
    patterns: {
      scripts: [/convertkit\.com/i, /ck\.page/i],
    },
  },
  {
    name: 'Drip',
    category: 'marketing',
    patterns: {
      scripts: [/drip\.com/i, /getdrip\.com/i],
      globals: ['_dcq', '_dcs'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVERTISING PIXELS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Facebook Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/connect\.facebook\.net.*fbevents/i, /facebook\.com\/tr/i],
      globals: ['fbq', '_fbq'],
    },
    extractId: /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/,
  },
  {
    name: 'Google Ads',
    category: 'advertising',
    patterns: {
      scripts: [/googleads\.g\.doubleclick/i, /pagead2\.googlesyndication/i],
      html: [/AW-\d+/i],
    },
    extractId: /AW-\d+/,
  },
  {
    name: 'LinkedIn Insight Tag',
    category: 'advertising',
    patterns: {
      scripts: [/snap\.licdn\.com/i, /linkedin\.com\/px/i],
      globals: ['_linkedin_data_partner_ids'],
    },
  },
  {
    name: 'Twitter Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/static\.ads-twitter\.com/i, /t\.co\/i/i],
      globals: ['twq'],
    },
  },
  {
    name: 'TikTok Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/analytics\.tiktok\.com/i],
      globals: ['ttq'],
    },
  },
  {
    name: 'Pinterest Tag',
    category: 'advertising',
    patterns: {
      scripts: [/pintrk/i, /s\.pinimg\.com/i],
      globals: ['pintrk'],
    },
  },
  {
    name: 'Bing Ads',
    category: 'advertising',
    patterns: {
      scripts: [/bat\.bing\.com/i],
      globals: ['uetq'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT & SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Intercom',
    category: 'support',
    patterns: {
      scripts: [/widget\.intercom\.io/i, /intercom\.com/i],
      html: [/intercom-container/i, /intercom-frame/i],
      globals: ['Intercom', 'intercomSettings'],
    },
  },
  {
    name: 'Drift',
    category: 'support',
    patterns: {
      scripts: [/drift\.com/i, /js\.driftt\.com/i],
      globals: ['drift', 'driftt'],
    },
  },
  {
    name: 'Zendesk',
    category: 'support',
    patterns: {
      scripts: [/zendesk\.com/i, /zdassets\.com/i],
      html: [/zEWidget/i],
      globals: ['zE', 'zESettings'],
    },
  },
  {
    name: 'Freshdesk',
    category: 'support',
    patterns: {
      scripts: [/freshdesk\.com/i, /freshworks\.com/i],
      globals: ['FreshworksWidget'],
    },
  },
  {
    name: 'Crisp',
    category: 'support',
    patterns: {
      scripts: [/crisp\.chat/i],
      globals: ['$crisp', 'CRISP_WEBSITE_ID'],
    },
  },
  {
    name: 'LiveChat',
    category: 'support',
    patterns: {
      scripts: [/livechat\.com/i, /livechatinc\.com/i],
      globals: ['LiveChatWidget', '__lc'],
    },
  },
  {
    name: 'Tidio',
    category: 'support',
    patterns: {
      scripts: [/tidio\.co/i, /code\.tidio\.co/i],
      globals: ['tidioChatApi'],
    },
  },
  {
    name: 'HelpScout',
    category: 'support',
    patterns: {
      scripts: [/beacon-v2\.helpscout\.net/i],
      globals: ['Beacon'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Stripe',
    category: 'other',
    patterns: {
      scripts: [/js\.stripe\.com/i],
      globals: ['Stripe'],
    },
  },
  {
    name: 'PayPal',
    category: 'other',
    patterns: {
      scripts: [/paypal\.com\/sdk/i, /paypalobjects\.com/i],
      globals: ['paypal'],
    },
  },
  {
    name: 'reCAPTCHA',
    category: 'other',
    patterns: {
      scripts: [/google\.com\/recaptcha/i],
      globals: ['grecaptcha'],
    },
  },
  {
    name: 'Sentry',
    category: 'other',
    patterns: {
      scripts: [/sentry\.io/i, /browser\.sentry-cdn/i],
      globals: ['Sentry', '__SENTRY__'],
    },
  },
  {
    name: 'Cloudflare',
    category: 'other',
    patterns: {
      scripts: [/cloudflare\.com/i, /cdnjs\.cloudflare/i],
      html: [/cf-ray/i, /cloudflare/i],
    },
  },
  {
    name: 'Optimizely',
    category: 'other',
    patterns: {
      scripts: [/optimizely\.com/i],
      globals: ['optimizely'],
    },
  },
  {
    name: 'VWO',
    category: 'other',
    patterns: {
      scripts: [/visualwebsiteoptimizer/i, /vwo\.com/i],
      globals: ['_vwo_code', 'VWO'],
    },
  },
  {
    name: 'LaunchDarkly',
    category: 'other',
    patterns: {
      scripts: [/launchdarkly\.com/i],
      globals: ['LDClient'],
    },
  },
  {
    name: 'Yoast SEO',
    category: 'other',
    patterns: {
      html: [/yoast-schema-graph/i, /yoast/i],
      meta: [/yoast/i],
    },
  },
];

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class TechnographicScout extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Technographic Scout initialized');
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as TechScanRequest;

      if (!payload?.url) {
        return this.createReport(taskId, 'FAILED', null, ['No URL provided in payload']);
      }

      this.log('INFO', `Scanning tech stack for: ${payload.url}`);

      const result = await this.scanTechStack(payload);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Tech scan failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  /**
   * Generate a report for the manager
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this agent has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 400, boilerplate: 50 };
  }

  // ==========================================================================
  // CORE TECH DETECTION LOGIC
  // ==========================================================================

  /**
   * Main tech stack scanning function
   */
  async scanTechStack(request: TechScanRequest): Promise<TechScanResult> {
    const { url } = request;
    const errors: string[] = [];

    // Step 1: Fetch the page (REAL network call)
    let html = '';
    try {
      const content = await scrapeWebsite(url);
      html = content.rawHtml ?? '';
      if (!html) {
        errors.push('Unable to retrieve page HTML');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch page';
      errors.push(msg);
      logger.error('Technographic Scout: Page fetch failed', error instanceof Error ? error : new Error(msg), { url });
    }

    // Step 2: Run signature-based tool detection (REAL, deterministic regex matching)
    const detectedTools: DetectedTool[] = [];
    for (const signature of TECH_SIGNATURES) {
      const detection = this.detectTechnology(html, signature);
      if (detection) {
        detectedTools.push(detection);
      }
    }

    // Step 3: Organize by category
    const analytics = detectedTools.filter((t) => t.category === 'analytics');
    const marketing = detectedTools.filter((t) => t.category === 'marketing');
    const advertising = detectedTools.filter((t) => t.category === 'advertising');
    const support = detectedTools.filter((t) => t.category === 'support');
    const other = detectedTools.filter((t) => t.category === 'other');

    // Step 4: Build platform info from platform-category tools (REAL)
    const platformCategoryIds = ['cms', 'ecommerce', 'framework', 'hosting', 'cdn'];
    const platformTools = detectedTools.filter((t) => platformCategoryIds.includes(t.category));
    const platform = this.buildPlatformInfo(platformTools);

    // Step 5: LLM strategic analysis of the detected stack
    let analysis: TechStackAnalysisResult | null = null;
    let analysisMode: 'llm' | 'deterministic_fallback' = 'llm';
    let analysisModel: string | null = null;

    if (detectedTools.length > 0) {
      try {
        const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
        analysisModel = ctx.gm.model;
        analysis = await executeAnalyzeTechStack(
          { url, detectedTools, platform },
          ctx,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`LLM analysis failed: ${msg}`);
        analysisMode = 'deterministic_fallback';
        logger.error(
          '[TechnographicScout] LLM analysis failed — falling back to basic summary',
          error instanceof Error ? error : new Error(msg),
          { file: FILE },
        );
      }
    } else {
      analysisMode = 'deterministic_fallback';
      if (html.length > 0) {
        errors.push('No tech signatures matched — LLM analysis skipped');
      }
    }

    // Step 6: Assemble summary — LLM-driven where available, fallback otherwise
    const categories = [...new Set(detectedTools.map((t) => t.category))];
    const summary: TechSummary = analysis !== null
      ? {
          totalDetected: detectedTools.length,
          categories,
          techMaturity: analysis.techMaturity,
          estimatedMonthlySpend: `$${analysis.estimatedMonthlyMinUSD} - $${analysis.estimatedMonthlyMaxUSD}`,
        }
      : {
          totalDetected: detectedTools.length,
          categories,
          techMaturity: this.fallbackTechMaturity(detectedTools),
          estimatedMonthlySpend: '$0 - $0 (LLM analysis unavailable)',
        };

    const confidence = this.calculateOverallConfidence(detectedTools, html);

    return {
      url,
      scannedAt: new Date().toISOString(),
      platform,
      analytics,
      marketing,
      advertising,
      support,
      other,
      summary,
      confidence,
      errors,
      techMaturityReasoning: analysis?.techMaturityReasoning,
      estimatedSpendReasoning: analysis?.estimatedSpendReasoning,
      strategicObservations: analysis?.strategicObservations ?? [],
      integrationOpportunities: analysis?.integrationOpportunities ?? [],
      techGaps: analysis?.techGaps ?? [],
      salesIntelligence: analysis?.salesIntelligence,
      analysisRationale: analysis?.rationale ?? null,
      analysisModel,
      analysisMode,
    };
  }

  /**
   * Minimal tech-maturity heuristic used ONLY when the LLM is
   * unavailable. The LLM path is the source of truth for maturity;
   * this exists so the specialist still returns a non-null field
   * during a fallback scenario.
   */
  private fallbackTechMaturity(tools: DetectedTool[]): TechSummary['techMaturity'] {
    const count = tools.length;
    if (count === 0) { return 'basic'; }
    if (count >= 10) { return 'enterprise'; }
    if (count >= 6) { return 'growth'; }
    if (count >= 3) { return 'startup'; }
    return 'basic';
  }

  /**
   * Detect a single technology based on its signature
   */
  private detectTechnology(html: string, signature: TechSignature): DetectedTool | null {
    const evidence: string[] = [];
    let matchCount = 0;
    let totalPatterns = 0;

    const _lowerHtml = html.toLowerCase();

    // Check script patterns
    if (signature.patterns.scripts) {
      for (const pattern of signature.patterns.scripts) {
        totalPatterns++;
        if (pattern.test(html)) {
          matchCount++;
          evidence.push(`Script: ${pattern.source}`);
        }
      }
    }

    // Check HTML patterns
    if (signature.patterns.html) {
      for (const pattern of signature.patterns.html) {
        totalPatterns++;
        if (pattern.test(html)) {
          matchCount++;
          evidence.push(`HTML: ${pattern.source}`);
        }
      }
    }

    // Check meta patterns
    if (signature.patterns.meta) {
      for (const pattern of signature.patterns.meta) {
        totalPatterns++;
        if (pattern.test(html)) {
          matchCount++;
          evidence.push(`Meta: ${pattern.source}`);
        }
      }
    }

    // Check for global variable patterns (by looking for assignment patterns)
    if (signature.patterns.globals) {
      for (const globalVar of signature.patterns.globals) {
        totalPatterns++;
        // Look for common patterns that indicate a global is defined
        const patterns = [
          new RegExp(`window\\.${globalVar}\\s*=`, 'i'),
          new RegExp(`["']${globalVar}["']`, 'i'),
          new RegExp(`${globalVar}\\s*\\(`, 'i'),
        ];

        for (const pattern of patterns) {
          if (pattern.test(html)) {
            matchCount++;
            evidence.push(`Global: ${globalVar}`);
            break;
          }
        }
      }
    }

    // If no matches, return null
    if (matchCount === 0) {
      return null;
    }

    // Calculate confidence based on match ratio
    const confidence = Math.min(matchCount / Math.max(totalPatterns * 0.5, 1), 1);

    // Extract tracking ID if pattern exists
    let trackingId: string | undefined;
    if (signature.extractId) {
      const match = html.match(signature.extractId);
      if (match) {
        trackingId = match[1] || match[0];
      }
    }

    // Build the detected tool object
    const tool: DetectedTool = {
      name: signature.name,
      category: signature.subcategory ?? signature.category,
      confidence: Math.round(confidence * 100) / 100,
      evidence,
    };

    if (trackingId) {
      if (signature.category === 'advertising') {
        tool.pixelId = trackingId;
      } else {
        tool.trackingId = trackingId;
      }
    }

    return tool;
  }

  /**
   * Build platform info from detected platform technologies
   */
  private buildPlatformInfo(platforms: DetectedTool[]): PlatformInfo {
    const info: PlatformInfo = {
      cms: null,
      ecommerce: null,
      framework: null,
      hosting: null,
      cdn: null,
    };

    for (const platform of platforms) {
      const category = platform.category;

      if (category === 'cms' && !info.cms) {
        info.cms = platform.name;
      } else if (category === 'ecommerce' && !info.ecommerce) {
        info.ecommerce = platform.name;
      } else if (category === 'framework' && !info.framework) {
        info.framework = platform.name;
      } else if (category === 'hosting' && !info.hosting) {
        info.hosting = platform.name;
      } else if (category === 'cdn' && !info.cdn) {
        info.cdn = platform.name;
      }
    }

    return info;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(tools: DetectedTool[], html: string): number {
    if (tools.length === 0) {
      return html.length > 0 ? 0.3 : 0;
    }

    // Average confidence of all detected tools
    const avgConfidence = tools.reduce((sum, t) => sum + t.confidence, 0) / tools.length;

    // Bonus for detecting multiple technologies (shows comprehensive scan)
    const coverageBonus = Math.min(tools.length * 0.02, 0.2);

    // Penalty if HTML was empty or very short
    const htmlPenalty = html.length < 1000 ? 0.2 : 0;

    return Math.min(Math.max(avgConfidence + coverageBonus - htmlPenalty, 0), 1);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createTechnographicScout(): TechnographicScout {
  return new TechnographicScout();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: TechnographicScout | null = null;

export function getTechnographicScout(): TechnographicScout {
  instance ??= createTechnographicScout();
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
  buildAnalyzeTechStackPrompt,
  stripJsonFences,
  executeAnalyzeTechStack,
  TechStackAnalysisResultSchema,
};
