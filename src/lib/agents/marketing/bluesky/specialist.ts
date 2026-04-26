/**
 * Bluesky Expert — REAL AI AGENT (compose_dm_reply only, lean v1)
 *
 * Composes brand-voiced replies to inbound Bluesky DMs. Mirrors the
 * Twitter/X Expert's `compose_dm_reply` action but for Bluesky's voice
 * + ergonomics (longer text limit — 1000 chars vs X's 240 — but the
 * brand playbook still asks for short, conversational replies).
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_bluesky_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - compose_dm_reply  (Marketing Manager's inbound-DM fast-path is
 *     the only caller anywhere in the codebase; called when
 *     delegate_to_marketing.inboundContext.platform === 'bluesky')
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

const FILE = 'marketing/bluesky/specialist.ts';
const SPECIALIST_ID = 'BLUESKY_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['compose_dm_reply'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const DM_REPLY_MAX_TOKENS = 1200;

interface BlueskyExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Bluesky Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['compose_dm_reply'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['compose_dm_reply'],
  outputSchema: {
    type: 'object',
    properties: {
      replyText: { type: 'string' },
      reasoning: { type: 'string' },
    },
  },
  maxTokens: DM_REPLY_MAX_TOKENS,
  temperature: 0.7,
};

interface BrandContextInput {
  industry?: string;
  toneOfVoice?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
}

export interface ComposeDmReplyRequest {
  action: 'compose_dm_reply';
  platform: 'bluesky';
  inboundEventId: string;
  senderHandle?: string;
  senderId?: string;
  inboundText: string;
  brandContext?: BrandContextInput;
}

const ComposeDmReplyRequestSchema = z.object({
  action: z.literal('compose_dm_reply'),
  platform: z.literal('bluesky'),
  inboundEventId: z.string().min(1),
  senderHandle: z.string().optional(),
  senderId: z.string().optional(),
  inboundText: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

const ComposeDmReplyResultSchema = z.object({
  replyText: z.string().min(1).max(1000),
  reasoning: z.string().min(20).max(1500),
  confidence: z.enum(['low', 'medium', 'high']),
  suggestEscalation: z.boolean(),
});

export type ComposeDmReplyResult = z.infer<typeof ComposeDmReplyResultSchema>;

interface LlmCallContext {
  gm: BlueskyExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Bluesky Expert GM not found for industryKey=${industryKey}. ` +
      `Run scripts/seed-bluesky-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<BlueskyExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Bluesky Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gm: BlueskyExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: Math.max(config.maxTokens ?? DM_REPLY_MAX_TOKENS, DM_REPLY_MAX_TOKENS),
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  return { gm, resolvedSystemPrompt: systemPrompt };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

function buildComposeDmReplyUserPrompt(req: ComposeDmReplyRequest): string {
  const sections: string[] = [
    'ACTION: compose_dm_reply',
    '',
    'Inbound platform: Bluesky (AT Protocol)',
    `Inbound event id: ${req.inboundEventId}`,
  ];
  if (req.senderHandle) {
    sections.push(`Sender handle: ${req.senderHandle}`);
  }
  sections.push('');
  sections.push('Inbound DM text (verbatim):');
  sections.push('"""');
  sections.push(req.inboundText);
  sections.push('"""');
  sections.push('');

  const brand = req.brandContext;
  if (brand) {
    sections.push('Brand context from caller:');
    if (brand.industry) { sections.push(`  Industry: ${brand.industry}`); }
    if (brand.toneOfVoice) { sections.push(`  Tone of voice: ${brand.toneOfVoice}`); }
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {
      sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);
    }
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {
      sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);
    }
    sections.push('');
  }

  sections.push('Compose ONE direct message reply for the brand to send back to this sender. Respond with ONLY a valid JSON object, no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "replyText": "<the reply text the brand will send, 1-1000 chars; brand playbook target ≤300>",');
  sections.push('  "reasoning": "<why this reply is appropriate given the inbound message and brand voice, 20-1500 chars>",');
  sections.push('  "confidence": "<low | medium | high>",');
  sections.push('  "suggestEscalation": <true | false — set true if a human should review before send because the inbound is hostile, off-topic, contains a complaint, or asks for something the brand cannot promise>');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- replyText MUST be ≤1000 characters (Bluesky DM hard limit). Brand voice playbook prefers ≤300 chars for natural conversational tone.');
  sections.push('- Acknowledge the sender\'s SPECIFIC message — never reply with a generic template that ignores what they said.');
  sections.push('- Match brand tone of voice; default to professional yet approachable if none supplied.');
  sections.push('- If the sender asks about pricing, point to https://www.salesvelocity.ai instead of quoting prices in the DM.');
  sections.push('- Hostile / complaining / requests for things the brand cannot promise → suggestEscalation=true and a polite holding reply.');
  sections.push('- No marketing-speak, no emoji, no exclamation overload.');
  sections.push('- Plain text. No URLs unless the inbound message explicitly asks where to find something — default destination is https://www.salesvelocity.ai.');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeComposeDmReply(
  req: ComposeDmReplyRequest,
  ctx: LlmCallContext,
): Promise<ComposeDmReplyResult> {
  const userPrompt = buildComposeDmReplyUserPrompt(req);
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens: DM_REPLY_MAX_TOKENS,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Bluesky Expert compose_dm_reply: LLM truncated at maxTokens=${DM_REPLY_MAX_TOKENS}. ` +
      'Either raise the budget or shorten the inbound text.',
    );
  }

  const rawContent = (response.content ?? '').trim();
  if (rawContent.length === 0) {
    throw new Error('Bluesky Expert compose_dm_reply: LLM returned empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Bluesky Expert compose_dm_reply output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = ComposeDmReplyResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Bluesky Expert compose_dm_reply output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

export class BlueskyExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Bluesky Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Bluesky Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Bluesky Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Bluesky Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[BlueskyExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'compose_dm_reply') {
        const validation = ComposeDmReplyRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Bluesky Expert compose_dm_reply: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeComposeDmReply(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Bluesky Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[BlueskyExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') { return this.execute(signal.payload); }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean { return true; }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 200, boilerplate: 50 };
  }
}

let instance: BlueskyExpert | null = null;
export function getBlueskyExpert(): BlueskyExpert {
  instance ??= new BlueskyExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  DM_REPLY_MAX_TOKENS,
  loadGMConfig,
  buildComposeDmReplyUserPrompt,
  executeComposeDmReply,
  ComposeDmReplyRequestSchema,
  ComposeDmReplyResultSchema,
};
