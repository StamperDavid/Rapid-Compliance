/**
 * Mastodon Expert — REAL AI AGENT (compose_dm_reply only, lean v1)
 *
 * Composes brand-voiced replies to inbound Mastodon DMs. Works
 * against any Mastodon-family instance (mastodon.social, hachyderm.io,
 * fosstodon.org, etc.) the brand connects via `instanceUrl` config.
 *
 * Mastodon DMs are statuses with `visibility: 'direct'`. The status
 * text must begin with an `@username` mention so the recipient sees
 * the message. The mention is added by the send-side service
 * (mastodon-service.sendDirectMessage), so this specialist only
 * produces the reply BODY — not the prefixed mention.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_mastodon_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - compose_dm_reply  (inbound DM dispatcher's only caller — invoked
 *     when the orchestration service routes to platform 'mastodon')
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { PLATFORM_ID as _PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  ComposeDmReplyRequestSchema,
  executeComposeDmReply,
  type ComposeDmReplyResult,
} from '@/lib/agents/social/compose-dm-reply-shared';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

const FILE = 'marketing/mastodon/specialist.ts';
const SPECIALIST_ID = 'MASTODON_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['compose_dm_reply'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const DM_REPLY_MAX_TOKENS = 1200;

// Mastodon-family status hard ceiling is 500 chars. The send-side
// service prepends the recipient mention (~25 chars typical), so the
// effective body budget is ~475. We cap at 450 to leave headroom for
// long handles on federated instances (`@user@instance.example` form).
const DM_REPLY_OPTIONS = {
  platformLabel: 'Mastodon',
  maxReplyChars: 450,
  playbookCharsTarget: 280,
  brandUrl: 'https://www.salesvelocity.ai',
  forbidEmoji: false,
} as const;

interface MastodonExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Mastodon Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['compose_dm_reply'],
  },
  systemPrompt: '',
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

interface LlmCallContext {
  gm: MastodonExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Mastodon Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-mastodon-expert-gm.js to seed.`,
    );
  }
  const config = gmRecord.config as Partial<MastodonExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Mastodon Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gm: MastodonExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: Math.max(config.maxTokens ?? DM_REPLY_MAX_TOKENS, DM_REPLY_MAX_TOKENS),
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  return { gm, resolvedSystemPrompt: systemPrompt };
}

export class MastodonExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Mastodon Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Mastodon Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Mastodon Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Mastodon Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[MastodonExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'compose_dm_reply') {
        const validation = ComposeDmReplyRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Mastodon Expert compose_dm_reply: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data: ComposeDmReplyResult = await executeComposeDmReply(
          validation.data,
          {
            resolvedSystemPrompt: ctx.resolvedSystemPrompt,
            model: ctx.gm.model,
            temperature: ctx.gm.temperature,
            maxTokens: DM_REPLY_MAX_TOKENS,
          },
          DM_REPLY_OPTIONS,
        );
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Mastodon Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[MastodonExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 150, boilerplate: 50 };
  }
}

let instance: MastodonExpert | null = null;
export function getMastodonExpert(): MastodonExpert {
  instance ??= new MastodonExpert();
  return instance;
}

// Re-export the Zod request schema as-is for symmetry with peer specialists
const MastodonComposeDmReplyRequestSchema = z.object({
  action: z.literal('compose_dm_reply'),
  platform: z.literal('mastodon'),
  inboundEventId: z.string().min(1),
  senderHandle: z.string().optional(),
  senderId: z.string().optional(),
  inboundText: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  DM_REPLY_MAX_TOKENS,
  DM_REPLY_OPTIONS,
  loadGMConfig,
  MastodonComposeDmReplyRequestSchema,
};
