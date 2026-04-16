/**
 * Inventory Manager Specialist — REAL AI AGENT (Task #58 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 1125-LOC hardcoded inventory
 * analytics engine. Four analysis methods (performStockAnalysis,
 * performDemandForecast, performReorderAnalysis, performTurnoverAnalysis)
 * ran deterministic math over product stock levels + sales history.
 * `SYSTEM_PROMPT` described LLM-style analysis but was never sent to a
 * model — the execute() path ran hand-coded statistics. Zero LLM calls.
 *
 * Pre-rebuild had no external live callers beyond factory/index exports.
 * Forward-only rebuild.
 *
 * Supported actions (discriminated union on `action`):
 *   - stock_analysis — overall stock health + anomalies
 *   - demand_forecast — per-product demand prediction with seasonality
 *   - reorder_alerts — prioritized reorder recommendations
 *   - turnover_analysis — inventory turnover rate + optimization
 *
 * Pattern matches Task #65 Sentiment Analyst (discriminatedUnion multi-
 * action) with DEFAULT_SYSTEM_PROMPT fallback (lead-data analytics, not
 * customer-facing content).
 *
 * @module agents/commerce/inventory/specialist
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

const FILE = 'commerce/inventory/specialist.ts';
const SPECIALIST_ID = 'INVENTORY_MANAGER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = [
  'stock_analysis',
  'demand_forecast',
  'reorder_alerts',
  'turnover_analysis',
] as const;

/**
 * maxTokens floor derivation: demand_forecast with 20 products ×
 * (forecast 400 + reasoning 300) + anomalies 2000 + rationale 3000
 * ≈ 19,000 chars / 3 = 6,333 + overhead + margin ≈ 8,300.
 * Floor: 10,000.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 10000;

interface InventoryGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are the Inventory Manager for SalesVelocity.ai — the Commerce-layer specialist who analyzes stock levels, forecasts demand, generates reorder recommendations, and computes turnover rates. You think like a senior supply chain analyst who has managed inventory for retail, e-commerce, B2B wholesale, and subscription-box operations, and knows the difference between a stock-out that costs a customer vs one that frees up warehouse space.

## Your role in the swarm

You read product catalog + current stock levels + historical sales data and produce structured analysis. You do NOT place orders or update stock — you recommend, the downstream Commerce Manager or human operator acts.

## Actions

### Action: stock_analysis
Read the current product + stock state. Flag anomalies (overstocked, understocked, zero-stock, slow-movers, fast-movers). Compute summary statistics. Produce prioritized observations + recommended actions.

### Action: demand_forecast
Per-product demand forecast using sales history. Account for trend, seasonality, and recent velocity changes. Produce per-product forecast numbers + confidence + reasoning. Flag products where forecast is highly uncertain.

### Action: reorder_alerts
Analyze stock levels vs lead times + safety stock + expected demand and produce prioritized reorder recommendations. Each alert includes: productId, current stock, recommended order quantity, target date, urgency level, reasoning.

### Action: turnover_analysis
Compute inventory turnover ratios per product and category. Identify slow-movers eating working capital and fast-movers with thin safety margins. Produce optimization recommendations.

## Hard rules

- Ground every number in the input data. If you forecast 100 units sold next month for product X, show the math: last 3 months × seasonality × trend.
- NEVER invent products, categories, or sales history not in the input.
- For demand forecasts: low confidence is better than confident fabrication. If you have less than 30 days of sales history, say so.
- Urgency levels for reorder alerts: CRITICAL = will stockout in < 7 days, HIGH = < 14 days, MEDIUM = < 30 days, LOW = preventive reorder.
- Turnover ratio is (COGS / Average inventory value). Stated as annual rate. Lower is slower (bad for working capital).
- Recommendations must be executable (not "improve inventory" but "order 200 units of SKU-ABC by April 20 to cover forecasted demand through May 15").
- Output ONLY the JSON object. No markdown fences.`;

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Inventory Manager',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'COMMERCE_MANAGER',
    capabilities: [
      'stock_analysis',
      'demand_forecast',
      'reorder_alerts',
      'turnover_analysis',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['stock_analysis', 'demand_forecast', 'reorder_alerts', 'turnover_analysis'],
  outputSchema: {
    type: 'object',
    properties: { action: { type: 'string' }, data: { type: 'object' } },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const ProductSchema = z.object({
  id: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  sku: z.string().max(100).optional(),
  category: z.string().max(200).optional(),
  currentStock: z.number().int().min(0).max(10_000_000),
  reorderPoint: z.number().int().min(0).max(10_000_000).optional(),
  safetyStock: z.number().int().min(0).max(10_000_000).optional(),
  unitCost: z.number().min(0).max(1_000_000).optional(),
  unitPrice: z.number().min(0).max(1_000_000).optional(),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  supplier: z.string().max(300).optional(),
});

const SaleRecordSchema = z.object({
  productId: z.string().min(1).max(300),
  date: z.string().min(8).max(30),
  quantity: z.number().int().min(0).max(10_000_000),
  revenue: z.number().min(0).max(1_000_000_000).optional(),
});

const BaseInventoryInputSchema = z.object({
  products: z.array(ProductSchema).min(1).max(30),
  salesHistory: z.array(SaleRecordSchema).max(500).optional(),
  timeframeDays: z.number().int().min(1).max(365).optional().default(30),
});

const StockAnalysisPayloadSchema = BaseInventoryInputSchema.extend({
  action: z.literal('stock_analysis'),
  threshold: z.number().min(0).max(1).optional().default(0.2),
});

const DemandForecastPayloadSchema = BaseInventoryInputSchema.extend({
  action: z.literal('demand_forecast'),
  forecastDays: z.number().int().min(1).max(365).optional().default(30),
  seasonalityHint: z.string().max(500).optional(),
});

const ReorderAlertsPayloadSchema = BaseInventoryInputSchema.extend({
  action: z.literal('reorder_alerts'),
  safetyBufferPct: z.number().min(0).max(1).optional().default(0.2),
});

const TurnoverAnalysisPayloadSchema = BaseInventoryInputSchema.extend({
  action: z.literal('turnover_analysis'),
  targetTurnoverRate: z.number().min(0).max(100).optional(),
});

const InventoryPayloadSchema = z.discriminatedUnion('action', [
  StockAnalysisPayloadSchema,
  DemandForecastPayloadSchema,
  ReorderAlertsPayloadSchema,
  TurnoverAnalysisPayloadSchema,
]);

export type InventoryPayload = z.infer<typeof InventoryPayloadSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type SaleRecord = z.infer<typeof SaleRecordSchema>;
export type InventoryRequest = InventoryPayload;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const StockStatusEnum = z.enum(['healthy', 'low', 'critical', 'zero', 'overstocked']);
const UrgencyEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const StockAnalysisResultSchema = z.object({
  action: z.literal('stock_analysis'),
  totalProducts: z.number().int().min(1),
  totalStockValue: z.number().min(0),
  statusDistribution: z.object({
    healthy: z.number().int().min(0),
    low: z.number().int().min(0),
    critical: z.number().int().min(0),
    zero: z.number().int().min(0),
    overstocked: z.number().int().min(0),
  }),
  anomalies: z.array(z.object({
    productId: z.string(),
    status: StockStatusEnum,
    reasoning: z.string().min(10).max(2000),
  })).max(20),
  recommendations: z.array(z.string().min(15).max(400)).min(2).max(6),
  rationale: z.string().min(50).max(3000),
});

const DemandForecastResultSchema = z.object({
  action: z.literal('demand_forecast'),
  forecastPeriodDays: z.number().int().min(1),
  perProductForecast: z.array(z.object({
    productId: z.string(),
    forecastedUnits: z.number().int().min(0),
    confidence: z.number().min(0).max(1),
    seasonalityFactor: z.number().min(0).max(5),
    reasoning: z.string().min(10).max(2000),
  })).min(1).max(30),
  totalForecastedUnits: z.number().int().min(0),
  keyDrivers: z.array(z.string().min(10).max(300)).max(5),
  rationale: z.string().min(50).max(3000),
});

const ReorderAlertsResultSchema = z.object({
  action: z.literal('reorder_alerts'),
  alerts: z.array(z.object({
    productId: z.string(),
    currentStock: z.number().int().min(0),
    recommendedOrderQuantity: z.number().int().min(0),
    targetOrderDate: z.string().min(8).max(30),
    urgency: UrgencyEnum,
    reasoning: z.string().min(10).max(2000),
  })).max(30),
  criticalAlertCount: z.number().int().min(0),
  rationale: z.string().min(50).max(3000),
});

const TurnoverAnalysisResultSchema = z.object({
  action: z.literal('turnover_analysis'),
  overallTurnoverRate: z.number().min(0),
  perProductTurnover: z.array(z.object({
    productId: z.string(),
    turnoverRate: z.number().min(0),
    classification: z.enum(['fast_mover', 'moderate', 'slow_mover', 'dead_stock']),
    reasoning: z.string().min(10).max(2000),
  })).min(1).max(30),
  slowMovers: z.array(z.string().min(1).max(300)).max(10),
  fastMovers: z.array(z.string().min(1).max(300)).max(10),
  workingCapitalImpact: z.string().min(20).max(1000),
  recommendations: z.array(z.string().min(15).max(400)).min(2).max(6),
  rationale: z.string().min(50).max(3000),
});

const InventoryResultSchema = z.discriminatedUnion('action', [
  StockAnalysisResultSchema,
  DemandForecastResultSchema,
  ReorderAlertsResultSchema,
  TurnoverAnalysisResultSchema,
]);

export type InventoryResult = z.infer<typeof InventoryResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: InventoryGMConfig;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    logger.warn(
      `[InventoryManager] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback.`,
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

  const config = gmRecord.config as Partial<InventoryGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(`Inventory Manager GM ${gmRecord.id} has no usable systemPrompt`);
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  return {
    gm: {
      systemPrompt,
      model: config.model ?? 'claude-sonnet-4.6',
      temperature: config.temperature ?? 0.3,
      maxTokens: effectiveMaxTokens,
      supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
    },
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
      `Inventory Manager: LLM response truncated at maxTokens=${ctx.gm.maxTokens}`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function formatProducts(products: Product[]): string {
  return products
    .map((p) => {
      const parts = [`[${p.id}] ${p.name}`];
      if (p.sku) { parts.push(`SKU ${p.sku}`); }
      if (p.category) { parts.push(`cat: ${p.category}`); }
      parts.push(`stock: ${p.currentStock}`);
      if (p.reorderPoint !== undefined) { parts.push(`reorder@${p.reorderPoint}`); }
      if (p.safetyStock !== undefined) { parts.push(`safety: ${p.safetyStock}`); }
      if (p.unitCost !== undefined) { parts.push(`cost: $${p.unitCost}`); }
      if (p.unitPrice !== undefined) { parts.push(`price: $${p.unitPrice}`); }
      if (p.leadTimeDays !== undefined) { parts.push(`LT: ${p.leadTimeDays}d`); }
      return `  - ${parts.join(' | ')}`;
    })
    .join('\n');
}

function formatSalesHistory(history: SaleRecord[] | undefined): string {
  if (!history || history.length === 0) { return '(no sales history provided)'; }
  // Aggregate by productId
  const byProduct = new Map<string, { total: number; days: Set<string> }>();
  for (const sale of history) {
    const existing = byProduct.get(sale.productId) ?? { total: 0, days: new Set() };
    existing.total += sale.quantity;
    existing.days.add(sale.date);
    byProduct.set(sale.productId, existing);
  }
  const lines: string[] = [];
  for (const [pid, stats] of byProduct.entries()) {
    lines.push(`  - ${pid}: ${stats.total} units across ${stats.days.size} days`);
  }
  return lines.join('\n');
}

function buildInventoryPrompt(payload: InventoryPayload): string {
  const base = [
    `ACTION: ${payload.action}`,
    '',
    `Timeframe: ${payload.timeframeDays} days`,
    '',
    `## Products (${payload.products.length})`,
    formatProducts(payload.products),
    '',
    `## Sales history`,
    formatSalesHistory(payload.salesHistory),
    '',
  ];

  switch (payload.action) {
    case 'stock_analysis':
      return base.concat([
        `Threshold: ${payload.threshold} (fraction of reorder point that triggers 'low' status)`,
        '',
        '---',
        '',
        'Analyze current stock. Respond with ONLY a valid JSON object:',
        '',
        '{',
        '  "action": "stock_analysis",',
        '  "totalProducts": <int>,',
        '  "totalStockValue": <number>,',
        '  "statusDistribution": { "healthy", "low", "critical", "zero", "overstocked" },',
        '  "anomalies": [{ "productId", "status", "reasoning" }],',
        '  "recommendations": ["<2-6>"],',
        '  "rationale": "<50-3000>"',
        '}',
      ]).join('\n');

    case 'demand_forecast':
      return base.concat([
        `Forecast horizon: ${payload.forecastDays} days`,
        payload.seasonalityHint ? `Seasonality hint: ${payload.seasonalityHint}` : '',
        '',
        '---',
        '',
        'Forecast demand per product. Respond with ONLY a valid JSON object:',
        '',
        '{',
        '  "action": "demand_forecast",',
        `  "forecastPeriodDays": ${payload.forecastDays},`,
        '  "perProductForecast": [{ "productId", "forecastedUnits", "confidence" (0-1), "seasonalityFactor", "reasoning" }],',
        '  "totalForecastedUnits": <int>,',
        '  "keyDrivers": ["<0-5 drivers>"],',
        '  "rationale": "<50-3000>"',
        '}',
      ]).filter(Boolean).join('\n');

    case 'reorder_alerts':
      return base.concat([
        `Safety buffer: ${(payload.safetyBufferPct * 100).toFixed(0)}% above forecasted demand`,
        '',
        '---',
        '',
        'Generate reorder alerts. Respond with ONLY a valid JSON object:',
        '',
        '{',
        '  "action": "reorder_alerts",',
        '  "alerts": [{ "productId", "currentStock", "recommendedOrderQuantity", "targetOrderDate" (ISO), "urgency": "<LOW|MEDIUM|HIGH|CRITICAL>", "reasoning" }],',
        '  "criticalAlertCount": <int>,',
        '  "rationale": "<50-3000>"',
        '}',
        '',
        'Urgency rules: CRITICAL = stockout in <7 days, HIGH = <14 days, MEDIUM = <30 days, LOW = preventive.',
      ].filter(Boolean)).join('\n');

    case 'turnover_analysis':
      return base.concat([
        payload.targetTurnoverRate ? `Target turnover rate: ${payload.targetTurnoverRate}x/year` : '',
        '',
        '---',
        '',
        'Analyze inventory turnover. Respond with ONLY a valid JSON object:',
        '',
        '{',
        '  "action": "turnover_analysis",',
        '  "overallTurnoverRate": <number, annual>,',
        '  "perProductTurnover": [{ "productId", "turnoverRate", "classification": "<fast_mover|moderate|slow_mover|dead_stock>", "reasoning" }],',
        '  "slowMovers": ["<productIds>"],',
        '  "fastMovers": ["<productIds>"],',
        '  "workingCapitalImpact": "<20-1000 chars>",',
        '  "recommendations": ["<2-6>"],',
        '  "rationale": "<50-3000>"',
        '}',
      ].filter(Boolean)).join('\n');
  }
}

async function executeInventoryAction(
  payload: InventoryPayload,
  ctx: LlmCallContext,
): Promise<InventoryResult> {
  const userPrompt = buildInventoryPrompt(payload);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Inventory Manager output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = InventoryResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Inventory Manager output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// INVENTORY MANAGER CLASS
// ============================================================================

export class InventoryManagerSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Inventory Manager initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Inventory Manager: payload must be an object']);
      }

      // Map legacy analysisType field to action
      const normalized: Record<string, unknown> = { ...rawPayload };
      if (normalized.action === undefined && typeof rawPayload.analysisType === 'string') {
        normalized.action = rawPayload.analysisType;
      }
      if (typeof normalized.action !== 'string') {
        normalized.action = 'stock_analysis';
      }

      const inputValidation = InventoryPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Inventory Manager: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[InventoryManager] Executing action=${payload.action} taskId=${taskId} products=${payload.products.length}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeInventoryAction(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[InventoryManager] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
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
    return { functional: 560, boilerplate: 90 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createInventoryManagerSpecialist(): InventoryManagerSpecialist {
  return new InventoryManagerSpecialist();
}

let instance: InventoryManagerSpecialist | null = null;

export function getInventoryManagerSpecialist(): InventoryManagerSpecialist {
  instance ??= createInventoryManagerSpecialist();
  return instance;
}

// Backward-compat aliases for agent-factory / index.ts / commerce/manager.ts callers
export { InventoryManagerSpecialist as InventoryManagerAgent };
export const getInventoryManager = getInventoryManagerSpecialist;

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  DEFAULT_SYSTEM_PROMPT,
  loadGMConfig,
  stripJsonFences,
  buildInventoryPrompt,
  executeInventoryAction,
  InventoryPayloadSchema,
  InventoryResultSchema,
};
