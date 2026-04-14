/**
 * Workflow Optimizer — REAL AI AGENT (Task #37 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6) to compose a multi-agent workflow
 * blueprint: ordered nodes (agent + action + purpose + inputs/outputs +
 * duration + retry), execution pattern, parallelization analysis, critical
 * path description, total duration estimate, risk mitigation, success
 * criteria, and a written rationale grounded in the brand and goal.
 *
 * Supported actions (live code paths only):
 *   - compose_workflow
 *
 * The pre-rebuild template engine supported 6 actions (compose_workflow,
 * optimize_chain, execute_workflow, analyze_performance, list_workflows,
 * get_workflow). None of the six had a live caller in the codebase. The
 * rebuild keeps only the creative LLM-appropriate action (compose_workflow).
 * The other five were orchestration/CRUD primitives that require a workflow
 * execution engine and durable storage that do not exist at the specialist
 * layer. Per CLAUDE.md's no-stubs rule, they are not rebuilt — if a future
 * feature needs them, they belong in a workflow service, not in an LLM
 * specialist.
 *
 * Output shape: `{ workflowSummary, nodes[3..12], executionPattern,
 * parallelizationNotes, criticalPathDescription, estimatedTotalDurationSeconds,
 * riskMitigation[2..5], successCriteria, rationale }`. Prose fields for
 * inputsDescription, outputsDescription, dependsOnDescription on each node
 * (regression-stable — no nested arrays to jitter across repeated runs).
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA, type BrandDNA } from '@/lib/brand/brand-dna-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'builder/workflow/specialist.ts';
const SPECIALIST_ID = 'WORKFLOW_OPTIMIZER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['compose_workflow'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Workflow Optimizer response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   ComposeWorkflowResultSchema is dominated by the nodes array (3-12
 *   entries with prose-heavy purpose/inputs/outputs/depends fields
 *   summing to ~4,970 chars per node at theoretical max).
 *
 *   Theoretical worst case (12 nodes, every prose field at .max()):
 *     workflowSummary: 2,500
 *     nodes: 12 × (id 60 + agentId 120 + action 120 + purpose 800 +
 *     inputsDescription 1500 + outputsDescription 1500 +
 *     estimatedDurationSeconds 5 + dependsOnDescription 800 +
 *     retryStrategy enum 15 + JSON 50) = 12 × 4,970 = 59,640
 *     executionPattern enum 15
 *     parallelizationNotes 3000 + criticalPathDescription 3000
 *     estimatedTotalDurationSeconds 10
 *     riskMitigation 5 × 800 = 4,000
 *     successCriteria 2500 + rationale 6000
 *     ≈ 80,665 chars total at theoretical maximum
 *     /3.0 chars/token = 26,888 tokens
 *     + JSON overhead + 25% safety ≈ 33,800 tokens.
 *
 *   Realistic worst case (8 nodes, ~60% prose fill):
 *     nodes: 8 × ~3,000 = 24,000
 *     + summary + execution + parallel + critical + risks +
 *     criteria + rationale ≈ 19,000
 *     ≈ 43,000 chars → ~14,333 tokens + safety ≈ ~18,000.
 *
 *   Setting the floor at 24,000 covers realistic worst with comfortable
 *   headroom. Matches UX/UI Architect for consistency. Cases that
 *   approach the theoretical max trigger the truncation backstop.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 24000;

interface WorkflowOptimizerGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Workflow Optimizer',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'BUILDER_MANAGER',
    capabilities: ['compose_workflow'],
  },
  systemPrompt: '',
  tools: ['compose_workflow'],
  outputSchema: {
    type: 'object',
    properties: {
      workflowSummary: { type: 'object' },
      nodes: { type: 'array' },
      executionPattern: { type: 'string' },
      parallelizationNotes: { type: 'string' },
      criticalPathDescription: { type: 'string' },
      estimatedTotalDurationSeconds: { type: 'number' },
      riskMitigation: { type: 'array' },
      successCriteria: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.6,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

interface ComposeWorkflowConstraintsInput {
  maxDurationSeconds?: number;
  requiredAgents?: string[];
  excludedAgents?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  maxParallelism?: number;
}

export interface ComposeWorkflowRequest {
  action: 'compose_workflow';
  goal: string;
  context?: string;
  constraints?: ComposeWorkflowConstraintsInput;
  availableAgents?: string[];
}

const ComposeWorkflowRequestSchema = z.object({
  action: z.literal('compose_workflow'),
  goal: z.string().min(1),
  context: z.string().optional(),
  constraints: z
    .object({
      maxDurationSeconds: z.number().int().positive().optional(),
      requiredAgents: z.array(z.string()).optional(),
      excludedAgents: z.array(z.string()).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      maxParallelism: z.number().int().min(1).max(20).optional(),
    })
    .optional(),
  availableAgents: z.array(z.string()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const WorkflowSummarySchema = z.object({
  name: z.string().min(2).max(200),
  goal: z.string().min(10).max(800),
  primaryObjective: z.string().min(20).max(1500),
});

const WorkflowNodeSchema = z.object({
  id: z.string().min(1).max(60),
  agentId: z.string().min(2).max(120),
  action: z.string().min(2).max(120),
  purpose: z.string().min(10).max(800),
  inputsDescription: z.string().min(10).max(1500),
  outputsDescription: z.string().min(10).max(1500),
  estimatedDurationSeconds: z.number().int().min(5).max(3600),
  dependsOnDescription: z.string().min(4).max(800),
  retryStrategy: z.enum(['none', 'linear', 'exponential']),
});

const ComposeWorkflowResultSchema = z.object({
  workflowSummary: WorkflowSummarySchema,
  nodes: z.array(WorkflowNodeSchema).min(3).max(12),
  executionPattern: z.enum(['sequential', 'parallel', 'fan_out', 'fan_in', 'conditional', 'hybrid']),
  parallelizationNotes: z.string().min(50).max(3000),
  criticalPathDescription: z.string().min(50).max(3000),
  estimatedTotalDurationSeconds: z.number().int().min(5).max(86400),
  riskMitigation: z.array(z.string().min(15).max(800)).min(2).max(5),
  successCriteria: z.string().min(50).max(2500),
  rationale: z.string().min(150).max(6000),
});

export type ComposeWorkflowResult = z.infer<typeof ComposeWorkflowResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: WorkflowOptimizerGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Workflow Optimizer GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-workflow-optimizer-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<WorkflowOptimizerGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Workflow Optimizer GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: WorkflowOptimizerGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.6,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Workflow Optimizer refuses to compose a workflow without brand identity. ' +
      'Visit /settings/ai-agents/business-setup.',
    );
  }

  const resolvedSystemPrompt = buildResolvedSystemPrompt(gm.systemPrompt, brandDNA);
  return { gm, brandDNA, resolvedSystemPrompt };
}

function buildResolvedSystemPrompt(baseSystemPrompt: string, brandDNA: BrandDNA): string {
  const keyPhrases = brandDNA.keyPhrases?.length > 0 ? brandDNA.keyPhrases.join(', ') : '(none configured)';
  const avoidPhrases = brandDNA.avoidPhrases?.length > 0 ? brandDNA.avoidPhrases.join(', ') : '(none configured)';
  const competitors = brandDNA.competitors?.length > 0 ? brandDNA.competitors.join(', ') : '(none configured)';

  const brandBlock = [
    '',
    '## Brand DNA (runtime injection — do not confuse with system prompt)',
    '',
    `Company: ${brandDNA.companyDescription}`,
    `Unique value: ${brandDNA.uniqueValue}`,
    `Target audience: ${brandDNA.targetAudience}`,
    `Tone of voice: ${brandDNA.toneOfVoice}`,
    `Communication style: ${brandDNA.communicationStyle}`,
    `Industry: ${brandDNA.industry}`,
    `Key phrases to weave in naturally: ${keyPhrases}`,
    `Phrases you are forbidden from using: ${avoidPhrases}`,
    `Competitors (never name them unless specifically asked): ${competitors}`,
  ].join('\n');

  return `${baseSystemPrompt}\n${brandBlock}`;
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

  // Truncation detection (cross-cutting fix). The OpenRouter provider was
  // hardcoding finishReason='stop' for months, silently masking length-
  // truncated responses. Now that the provider is honest, fail loudly on
  // any 'length' finish_reason instead of feeding incomplete JSON to
  // JSON.parse and surfacing a misleading "unexpected end of input".
  if (response.finishReason === 'length') {
    throw new Error(
      `Workflow Optimizer: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: compose_workflow
// ============================================================================

function buildComposeWorkflowUserPrompt(req: ComposeWorkflowRequest): string {
  const sections: string[] = [
    'ACTION: compose_workflow',
    '',
    `Goal: ${req.goal}`,
  ];

  if (req.context) {
    sections.push('');
    sections.push(`Additional context: ${req.context}`);
  }

  const c = req.constraints;
  if (c) {
    sections.push('');
    sections.push('Constraints from caller:');
    if (typeof c.maxDurationSeconds === 'number') {
      sections.push(`  Max total duration: ${c.maxDurationSeconds}s`);
    }
    if (c.requiredAgents && c.requiredAgents.length > 0) {
      sections.push(`  Required agents (must include): ${c.requiredAgents.join(', ')}`);
    }
    if (c.excludedAgents && c.excludedAgents.length > 0) {
      sections.push(`  Excluded agents (must NOT use): ${c.excludedAgents.join(', ')}`);
    }
    if (c.priority) {sections.push(`  Priority: ${c.priority}`);}
    if (typeof c.maxParallelism === 'number') {
      sections.push(`  Max parallel nodes at any moment: ${c.maxParallelism}`);
    }
  }

  if (req.availableAgents && req.availableAgents.length > 0) {
    sections.push('');
    sections.push(`Available agents (must pick from this list): ${req.availableAgents.join(', ')}`);
  }

  sections.push('');
  sections.push(
    'Compose a multi-agent workflow that achieves the goal. Respond with ONLY a valid JSON object, no markdown fences. The JSON must match this exact schema:',
  );
  sections.push('');
  sections.push('{');
  sections.push('  "workflowSummary": {');
  sections.push('    "name": "<short workflow name, 2-200 chars>",');
  sections.push('    "goal": "<echo the goal from input, 10-800 chars>",');
  sections.push('    "primaryObjective": "<one-sentence to one-paragraph statement of the core outcome this workflow produces, 20-1500 chars>"');
  sections.push('  },');
  sections.push('  "nodes": [');
  sections.push('    {');
  sections.push('      "id": "<short identifier, e.g. n1, n2, scrape_leads>",');
  sections.push('      "agentId": "<which agent runs this node — e.g. SEO_EXPERT, COPYWRITER, VIDEO_SPECIALIST, GROWTH_ANALYST>",');
  sections.push('      "action": "<action string on that agent, e.g. keyword_research, generate_content>",');
  sections.push('      "purpose": "<what this node accomplishes, 10-800 chars>",');
  sections.push("      \"inputsDescription\": \"<PROSE string describing what inputs this node consumes — both static inputs from the caller AND outputs mapped from prior nodes. Not a JSON array, a single string. Example: 'Consumes the target_industry string from workflow inputs plus the keyword_list array produced by node n1 (SEO_EXPERT.keyword_research).'>\",");
  sections.push("      \"outputsDescription\": \"<PROSE string describing what this node produces — data shape, file format, downstream consumers. Not a JSON array. Example: 'Produces a structured ContentBrief object with title_variants, meta_description_variants, and cta_variants arrays. Consumed by n3 (COPYWRITER.generate_content).'>\",");
  sections.push('      "estimatedDurationSeconds": <integer 5-3600>,');
  sections.push("      \"dependsOnDescription\": \"<PROSE string describing prerequisite nodes and why. Example: 'Runs after n1 (keyword research) and n2 (competitor scan) both complete — this node fuses their outputs into a unified brief.'>\",");
  sections.push('      "retryStrategy": "<none|linear|exponential>"');
  sections.push('    }');
  sections.push('    // 3-12 nodes total');
  sections.push('  ],');
  sections.push('  "executionPattern": "<sequential|parallel|fan_out|fan_in|conditional|hybrid>",');
  sections.push('  "parallelizationNotes": "<prose 50-3000 chars describing which nodes run in parallel vs serial, the reasoning behind the parallelization choices, and any concurrency limits>",');
  sections.push('  "criticalPathDescription": "<prose 50-3000 chars describing the longest dependency chain — the sequence of nodes that determines the minimum total duration>",');
  sections.push('  "estimatedTotalDurationSeconds": <integer 5-86400>,');
  sections.push("  \"riskMitigation\": [\"<2-5 risk + mitigation statements, each 15-800 chars. Example: 'Risk: SEO_EXPERT.keyword_research returns empty on obscure verticals. Mitigation: if keywords.length < 3 after first call, retry with broader seed term and add Google Trends fallback.'>\"],");
  sections.push('  "successCriteria": "<prose 50-2500 chars describing how we know this workflow succeeded — the observable outcomes, quality signals, and acceptance tests>",');
  sections.push('  "rationale": "<prose 150-6000 chars — why this specific workflow composition for this goal and brand. Tie node choices to agent capabilities, parallelization choices to the time budget, retry strategies to known agent reliability, and success criteria to the brand quality bar>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- nodes MUST have 3-12 entries. Every node needs a unique `id`.');
  sections.push('- inputsDescription, outputsDescription, and dependsOnDescription are PROSE strings — not JSON arrays. Describe dependencies, inputs, and outputs in flowing sentences a human reader would actually read.');
  sections.push('- estimatedDurationSeconds per node must be realistic (5-3600). Sum of critical-path durations should match estimatedTotalDurationSeconds.');
  sections.push('- Use real agent IDs from the SalesVelocity.ai swarm when possible: SEO_EXPERT, LINKEDIN_EXPERT, TIKTOK_EXPERT, TWITTER_X_EXPERT, FACEBOOK_ADS_EXPERT, GROWTH_ANALYST, COPYWRITER, VIDEO_SPECIALIST, CALENDAR_COORDINATOR, ASSET_GENERATOR, UX_UI_ARCHITECT, FUNNEL_ENGINEER. If a required capability does not map to any existing agent, name the capability you would need (e.g. "TRANSLATION_SPECIALIST") and note in rationale that this agent does not yet exist.');
  sections.push('- riskMitigation MUST have 2-5 entries. Each is a specific risk paired with a concrete mitigation — not generic "things might fail, watch carefully." Be specific about WHICH node or edge is at risk and HOW to handle it.');
  sections.push('- parallelizationNotes and criticalPathDescription must reference specific node ids (n1, n2, etc.) not vague phrases like "the content nodes."');
  sections.push('- If the brand avoidPhrases list bans a word, do not use it in any string field.');
  sections.push('- The rationale MUST explicitly reference the brand and the goal — do NOT output a generic workflow that could fit any goal.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeComposeWorkflow(
  req: ComposeWorkflowRequest,
  ctx: LlmCallContext,
): Promise<ComposeWorkflowResult> {
  const userPrompt = buildComposeWorkflowUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Workflow Optimizer output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = ComposeWorkflowResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Workflow Optimizer output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// WORKFLOW OPTIMIZER CLASS
// ============================================================================

export class WorkflowOptimizer extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Workflow Optimizer initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Workflow Optimizer: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Workflow Optimizer: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Workflow Optimizer does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[WorkflowOptimizer] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = ComposeWorkflowRequestSchema.safeParse({ ...payload, action });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Workflow Optimizer compose_workflow: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);
      const data = await executeComposeWorkflow(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[WorkflowOptimizer] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
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
    return { functional: 420, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createWorkflowOptimizer(): WorkflowOptimizer {
  return new WorkflowOptimizer();
}

let instance: WorkflowOptimizer | null = null;

export function getWorkflowOptimizer(): WorkflowOptimizer {
  instance ??= createWorkflowOptimizer();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  loadGMAndBrandDNA,
  buildResolvedSystemPrompt,
  buildComposeWorkflowUserPrompt,
  stripJsonFences,
  ComposeWorkflowRequestSchema,
  ComposeWorkflowResultSchema,
};
