/**
 * Intent Expander — single source of truth for intent classification + tool routing
 *
 * Loads its prompt + model from a Golden Master in Firestore (Standing Rule #1).
 * Brand DNA is baked into the GM at seed time, not merged at runtime.
 *
 * Returns BOTH the queryType classification AND the tool plan in one call.
 * The deprecated regex classifier (system-state-service.ts FACTUAL_PATTERNS et al.)
 * has been retired in favor of this LLM-based classifier — pattern matching is
 * not intent reading.
 *
 * Upgrade path: edit `config.model` on the active GM doc in Firestore and run
 * `scripts/verify-intent-expander-behavior.ts` to confirm no regression.
 * No code deploy required for model upgrades.
 */

import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';

// ============================================================================
// Types
// ============================================================================

export type QueryType = 'factual' | 'advisory' | 'action' | 'strategic' | 'conversational';

export interface ExpandedIntent {
  queryType: QueryType;
  tools: string[];
  scrapeUrls: string[];
  isComplex: boolean;
  isAdvisory: boolean;
  reasoning: string;
}

// Kept as an alias for any existing callers that imported ClassifierHint.
// New callers should not use this — the expander IS the classifier now.
export type ClassifierHint = QueryType;

const SPECIALIST_ID = 'INTENT_EXPANDER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const VALID_QUERY_TYPES: ReadonlySet<QueryType> = new Set([
  'factual', 'advisory', 'action', 'strategic', 'conversational',
]);

// ============================================================================
// Main expander function
// ============================================================================

/**
 * Expand a user's natural language request into a structured intent plan.
 * Loads prompt + model from the active Golden Master in Firestore.
 *
 * Returns null on hard failure (no GM, parse error). Caller should treat null
 * as "default to advisory and ask the user a clarifying question" — never as
 * permission to act with regex fallbacks.
 */
export async function expandIntent(message: string): Promise<ExpandedIntent | null> {
  const startMs = Date.now();

  try {
    const gm = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, DEFAULT_INDUSTRY_KEY);
    if (!gm) {
      logger.warn('[IntentExpander] No active GM found — cannot expand intent', {
        specialistId: SPECIALIST_ID,
        industryKey: DEFAULT_INDUSTRY_KEY,
      });
      return null;
    }

    const config = gm.config;
    const systemPrompt = typeof config.systemPrompt === 'string' ? config.systemPrompt : gm.systemPromptSnapshot;
    if (!systemPrompt || systemPrompt.length < 100) {
      logger.warn('[IntentExpander] GM has no usable systemPrompt', { gmId: gm.id });
      return null;
    }
    const model = typeof config.model === 'string' ? config.model : 'claude-haiku-4.5';
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0;
    const maxTokens = typeof config.maxTokens === 'number' ? config.maxTokens : 500;

    const provider = new OpenRouterProvider(PLATFORM_ID);
    type ModelName = Parameters<typeof provider.chat>[0]['model'];

    const response = await provider.chat({
      model: model as ModelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature,
      maxTokens,
    });

    const raw = (response.content || '').trim();
    const jsonStr = raw.replace(/^```json\n?|```$/g, '').trim();
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const rawQueryType = typeof parsed.queryType === 'string' ? parsed.queryType : 'advisory';
    const queryType: QueryType = VALID_QUERY_TYPES.has(rawQueryType as QueryType)
      ? (rawQueryType as QueryType)
      : 'advisory';
    const tools = Array.isArray(parsed.tools) ? (parsed.tools as string[]) : [];
    const scrapeUrls = Array.isArray(parsed.scrapeUrls) ? (parsed.scrapeUrls as string[]) : [];
    const isComplex = typeof parsed.isComplex === 'boolean' ? parsed.isComplex : tools.length >= 3;
    const isAdvisory = typeof parsed.isAdvisory === 'boolean' ? parsed.isAdvisory : queryType === 'advisory';
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    const result: ExpandedIntent = { queryType, tools, scrapeUrls, isComplex, isAdvisory, reasoning };

    logger.info('[IntentExpander] Expanded user intent', {
      durationMs: Date.now() - startMs,
      inputPreview: message.slice(0, 100),
      model,
      gmId: gm.id,
      gmVersion: gm.version,
      queryType,
      toolCount: tools.length,
      tools,
      scrapeUrls,
      isComplex,
      isAdvisory,
      reasoning,
    });

    return result;
  } catch (error) {
    logger.warn('[IntentExpander] Failed — returning null (caller will default to advisory)', {
      durationMs: Date.now() - startMs,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
