/**
 * Shared compose_dm_reply mixin for social-media specialists.
 *
 * Every social specialist that responds to inbound DMs (X, Bluesky,
 * LinkedIn, Facebook/Messenger, Instagram, Pinterest) needs the same
 * compose-and-validate pipeline:
 *   1. Validate the input shape (sender, inboundText, etc.)
 *   2. Build a structured user prompt with the inbound DM context
 *   3. Call the specialist's GM via OpenRouter
 *   4. Parse + Zod-validate the JSON response against the shared
 *      ComposeDmReplyResult schema
 *   5. Return the structured reply
 *
 * Each specialist still owns its own Golden Master (its own
 * platform-specific brand-voice playbook), so the LLM call uses
 * `ctx.resolvedSystemPrompt` from the specialist. This mixin is just
 * the mechanical shell — schemas, prompt scaffolding, OpenRouter call,
 * truncation backstop, JSON parse, schema validation.
 *
 * Per-platform variation goes through the `options` parameter:
 *   - `platformLabel` — e.g. "X (Twitter)", "Bluesky", "LinkedIn"
 *   - `maxReplyChars` — platform DM hard ceiling (X=500, Bluesky=1000,
 *     LinkedIn=8000, Facebook=20000, Instagram=1000, Pinterest=2200)
 *   - `playbookCharsTarget` — brand playbook target (typically 240-300)
 *   - `forbidEmoji` — most platforms = true; some platforms = false
 *
 * Standing Rule #1 stays intact: each specialist's GM is loaded from
 * Firestore and contains the brand-voice DM REPLY PLAYBOOK. This mixin
 * does not bypass GM loading; it just shares the mechanical execution.
 */

import { z } from 'zod';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { ModelName } from '@/types/ai-models';

// ============================================================================
// SCHEMAS (shared across all platforms)
// ============================================================================

interface BrandContextInput {
  industry?: string;
  toneOfVoice?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
}

export interface ComposeDmReplyRequest {
  action: 'compose_dm_reply';
  platform: string;
  inboundEventId: string;
  senderHandle?: string;
  senderId?: string;
  inboundText: string;
  brandContext?: BrandContextInput;
}

export const ComposeDmReplyRequestSchema = z.object({
  action: z.literal('compose_dm_reply'),
  platform: z.string().min(1),
  inboundEventId: z.string().min(1),
  senderHandle: z.string().optional(),
  senderId: z.string().optional(),
  inboundText: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

export interface ComposeDmReplyResult {
  replyText: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  suggestEscalation: boolean;
}

const MIN_REASONING = 20;
const MAX_REASONING = 1500;

function buildResultSchema(maxReplyChars: number) {
  return z.object({
    replyText: z.string().min(1).max(maxReplyChars),
    reasoning: z.string().min(MIN_REASONING).max(MAX_REASONING),
    confidence: z.enum(['low', 'medium', 'high']),
    suggestEscalation: z.boolean(),
  });
}

// ============================================================================
// LLM CALL CONTEXT (specialist-supplied)
// ============================================================================

export interface ComposeDmReplyLlmContext {
  /** GM-resolved system prompt (Brand DNA already baked in). */
  resolvedSystemPrompt: string;
  /** OpenRouter model id, e.g. 'claude-sonnet-4.6' */
  model: ModelName;
  /** Sampling temperature from the GM (0-1) */
  temperature: number;
  /** Output budget — typically 1200 tokens covers any DM-shaped reply */
  maxTokens: number;
}

// ============================================================================
// PLATFORM-SPECIFIC OPTIONS
// ============================================================================

export interface ComposeDmReplyOptions {
  /** Pretty platform label for the user prompt, e.g. 'X (Twitter)' */
  platformLabel: string;
  /** Platform DM hard ceiling — anything over this fails Zod validation */
  maxReplyChars: number;
  /** Brand playbook target (used in the user-prompt guidance) */
  playbookCharsTarget: number;
  /**
   * Platform fallback URL for "where to find more" links — typically
   * https://www.salesvelocity.ai. Specialists pass this through so the
   * generated reply doesn't link out to wrong destinations.
   */
  brandUrl?: string;
  /** Whether the platform's brand voice forbids emoji (default true) */
  forbidEmoji?: boolean;
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

function buildUserPrompt(req: ComposeDmReplyRequest, opts: ComposeDmReplyOptions): string {
  const sections: string[] = [
    'ACTION: compose_dm_reply',
    '',
    `Inbound platform: ${opts.platformLabel}`,
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
  sections.push(`  "replyText": "<the reply text the brand will send, 1-${opts.maxReplyChars} chars; brand playbook target ≤${opts.playbookCharsTarget}>",`);
  sections.push(`  "reasoning": "<why this reply is appropriate given the inbound message and brand voice, ${MIN_REASONING}-${MAX_REASONING} chars>",`);
  sections.push('  "confidence": "<low | medium | high>",');
  sections.push('  "suggestEscalation": <true | false — set true if a human should review before send because the inbound is hostile, off-topic, contains a complaint, or asks for something the brand cannot promise>');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push(`- replyText MUST be ≤${opts.maxReplyChars} characters (${opts.platformLabel} DM hard limit). Brand playbook prefers ≤${opts.playbookCharsTarget} chars for natural conversational tone.`);
  sections.push('- Acknowledge the sender\'s SPECIFIC message — never reply with a generic template that ignores what they said.');
  sections.push('- Match the brand tone of voice supplied in brand context. Default to professional yet approachable if none supplied.');
  if (opts.brandUrl) {
    sections.push(`- If the sender asks about pricing, do NOT quote prices in the DM — point them to ${opts.brandUrl} for current pricing.`);
  }
  sections.push('- Hostile / complaining / requests for things the brand cannot promise → suggestEscalation=true and a polite holding reply.');
  sections.push('- No marketing-speak ("revolutionary", "industry-leading", "game-changing"), no exclamation overload.');
  if (opts.forbidEmoji ?? true) {
    sections.push('- No emoji.');
  }
  sections.push('- Plain text. No URLs unless the inbound message explicitly asks where to find something.');
  sections.push('- Do NOT include the JSON in markdown fences. Output starts with `{` and ends with `}`.');

  return sections.join('\n');
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

/**
 * Execute compose_dm_reply against a specialist's GM and return the
 * structured reply. Throws on truncation, parse failure, or schema
 * violation — caller (specialist's execute()) is expected to wrap and
 * surface as an AgentReport FAILED with errors.
 */
export async function executeComposeDmReply(
  req: ComposeDmReplyRequest,
  ctx: ComposeDmReplyLlmContext,
  opts: ComposeDmReplyOptions,
): Promise<ComposeDmReplyResult> {
  const userPrompt = buildUserPrompt(req, opts);

  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.temperature,
    maxTokens: ctx.maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `compose_dm_reply (${opts.platformLabel}): LLM truncated at maxTokens=${ctx.maxTokens}. ` +
      'Either raise the budget or shorten the inbound text.',
    );
  }

  const rawContent = (response.content ?? '').trim();
  if (rawContent.length === 0) {
    throw new Error(`compose_dm_reply (${opts.platformLabel}): LLM returned empty response`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`compose_dm_reply (${opts.platformLabel}): output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const ResultSchema = buildResultSchema(opts.maxReplyChars);
  const result = ResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`compose_dm_reply (${opts.platformLabel}): output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// Re-export for testing convenience
export const __internal = {
  buildUserPrompt,
  stripJsonFences,
  buildResultSchema,
};
