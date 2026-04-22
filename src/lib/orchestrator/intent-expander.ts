/**
 * Intent Expander — LLM-based query understanding for non-technical users
 *
 * Loads its prompt + model from a Golden Master in Firestore (Standing Rule #1).
 * Brand DNA is baked into the GM at seed time, not merged at runtime.
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

export interface ExpandedIntent {
  tools: string[];
  scrapeUrls: string[];
  isComplex: boolean;
  isAdvisory: boolean;
  reasoning: string;
}

const SPECIALIST_ID = 'INTENT_EXPANDER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

/**
 * Query types from system-state-service.classifyQuery. Narrowed here so the
 * expander can respect the classifier's verdict.
 */
export type ClassifierHint = 'factual' | 'strategic' | 'advisory' | 'conversational' | 'action';

// ============================================================================
// Main expander function
// ============================================================================

/**
 * Expand a user's natural language request into a structured tool plan.
 * Loads prompt + model from the active Golden Master in Firestore.
 * Returns null on failure (caller falls back to regex matching).
 *
 * @param message - User message
 * @param classifierHint - Optional verdict from system-state-service.classifyQuery.
 *   When present, the expander is told to respect it (a factual hint means
 *   read-only tools, never writes).
 */
export async function expandIntent(
  message: string,
  classifierHint?: ClassifierHint,
): Promise<ExpandedIntent | null> {
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

    // Classifier hint is passed inline so the expander respects the upstream
    // verdict. The GM's systemPrompt teaches the model to read "[classifier=X]"
    // as load-bearing and never widen a factual hint into writes.
    const userContent = classifierHint
      ? `${message}\n\n[classifier=${classifierHint}]`
      : message;

    const response = await provider.chat({
      model: model as ModelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      maxTokens,
    });

    const raw = (response.content || '').trim();
    const jsonStr = raw.replace(/^```json\n?|```$/g, '').trim();
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const tools = Array.isArray(parsed.tools) ? (parsed.tools as string[]) : [];
    const scrapeUrls = Array.isArray(parsed.scrapeUrls) ? (parsed.scrapeUrls as string[]) : [];
    const isComplex = typeof parsed.isComplex === 'boolean' ? parsed.isComplex : tools.length >= 3;
    const isAdvisory = typeof parsed.isAdvisory === 'boolean' ? parsed.isAdvisory : false;
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    const result: ExpandedIntent = { tools, scrapeUrls, isComplex, isAdvisory, reasoning };

    logger.info('[IntentExpander] Expanded user intent', {
      durationMs: Date.now() - startMs,
      inputPreview: message.slice(0, 100),
      classifierHint: classifierHint ?? null,
      model,
      gmId: gm.id,
      gmVersion: gm.version,
      toolCount: tools.length,
      tools,
      scrapeUrls,
      isComplex,
      isAdvisory,
      reasoning,
    });

    return result;
  } catch (error) {
    logger.warn('[IntentExpander] Failed — falling back to regex matching', {
      durationMs: Date.now() - startMs,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
