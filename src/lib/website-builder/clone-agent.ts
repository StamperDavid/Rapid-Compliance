/**
 * Website Clone Agent (clone mode)
 *
 * The conversational agent the client talks to in the Clone Site workspace's
 * chat panel. It helps a non-technical SMB owner bring an EXISTING website into
 * our builder faithfully — explaining why pages look the way they do, guiding
 * re-clones, pointing to the editor, and being honest that the reproduction is a
 * deterministic capture-and-rebuild (it never claims to have authored content).
 *
 * Standing Rule #1 — Golden Master, Brand DNA baked in:
 *   At runtime we load ONE Firestore GM doc and send its `config.systemPrompt`
 *   to the LLM VERBATIM. Brand DNA is baked into that systemPrompt AT SEED TIME
 *   by scripts/seed-website-clone-agent-gm.js (via scripts/lib/brand-dna-helper.js).
 *   There is NO `getBrandDNA()` here, NO runtime Brand DNA merge, and NO
 *   hardcoded-prompt fallback — a missing/short GM throws loudly.
 *
 * Standing Rule #2 — gradeable, no self-improvement:
 *   This agent never edits its own prompt. Its replies are made gradeable by the
 *   chat endpoint exposing `specialistId` (WEBSITE_CLONE_AGENT), so a human grade
 *   routes to this specialist's GM through the existing training loop
 *   (grade → Prompt Engineer → new GM version → deploy).
 */

import { AIProviderFactory } from '@/lib/ai/provider-factory';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { logger } from '@/lib/logger/logger';
import type { ModelName } from '@/types/ai-models';

// ============================================================================
// Constants (Standing Rule #1)
// ============================================================================

const SPECIALIST_ID = 'WEBSITE_CLONE_AGENT';
// Same industry key the website builder resolves under (see
// DEFAULT_INDUSTRY_KEY in ai-page-generator.ts) so the seeded GM is found.
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

const DEFAULT_MODEL: ModelName = 'claude-sonnet-4.6';
const DEFAULT_TEMPERATURE = 0.5;
const DEFAULT_MAX_TOKENS = 4000;

// ============================================================================
// Types
// ============================================================================

export interface CloneAgentChatInput {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface CloneAgentChatResult {
  reply: string;
  specialistId: string;
  usage?: unknown;
}

interface LoadedGM {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
}

// ============================================================================
// Model-name guard (no `any` — coerce unknown config.model to a safe ModelName)
// ============================================================================

const KNOWN_MODEL_NAMES: readonly string[] = [
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'claude-sonnet-4',
  'claude-sonnet-4.5',
  'claude-sonnet-4.6',
  'claude-opus-4',
  'claude-opus-4.1',
  'claude-opus-4.5',
  'claude-opus-4.6',
  'claude-haiku-4.5',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.0-pro',
];

function isModelName(value: unknown): value is ModelName {
  return typeof value === 'string' && (KNOWN_MODEL_NAMES.includes(value) || value.startsWith('openrouter/'));
}

// ============================================================================
// Golden Master loader (Standing Rule #1 — verbatim, no fallback prompt)
// ============================================================================

async function loadGM(industryKey: string): Promise<LoadedGM> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Website Clone Agent GM not found for industryKey=${industryKey}. ` +
      `Run "node scripts/seed-website-clone-agent-gm.js" to seed it (Brand DNA is baked in at seed time).`,
    );
  }

  const config = gmRecord.config;
  const rawSystemPrompt = config.systemPrompt;
  const systemPrompt = typeof rawSystemPrompt === 'string' ? rawSystemPrompt : gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Website Clone Agent GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}). ` +
      `Reseed via "node scripts/seed-website-clone-agent-gm.js --force".`,
    );
  }

  const model: ModelName = isModelName(config.model) ? config.model : DEFAULT_MODEL;
  const temperature = typeof config.temperature === 'number' ? config.temperature : DEFAULT_TEMPERATURE;
  const maxTokens = typeof config.maxTokens === 'number' ? config.maxTokens : DEFAULT_MAX_TOKENS;

  return { systemPrompt, model, temperature, maxTokens };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run one turn of the Website Clone Agent chat. Loads the GM (Brand DNA baked
 * in), replays `history` + the new `message`, and returns the reply plus the
 * specialistId that makes the reply gradeable via the training loop.
 */
export async function runCloneAgentChat(input: CloneAgentChatInput): Promise<CloneAgentChatResult> {
  const gm = await loadGM(DEFAULT_INDUSTRY_KEY);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(input.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: input.message },
  ];

  logger.info('Website clone agent chat starting', {
    specialistId: SPECIALIST_ID,
    model: gm.model,
    historyLength: input.history?.length ?? 0,
    file: 'clone-agent.ts',
  });

  // systemPrompt is used VERBATIM — no runtime Brand DNA merge (Standing Rule #1).
  const provider = AIProviderFactory.createProvider(gm.model);
  const response = await provider.generateResponse(messages, gm.systemPrompt, {
    temperature: gm.temperature,
    maxTokens: gm.maxTokens,
    topP: 0.9,
  });

  return {
    reply: response.text,
    specialistId: SPECIALIST_ID,
    usage: response.usage,
  };
}
