/**
 * Prompt Engineer Agent
 *
 * Specialist AI agent that proposes targeted, section-level edits to an agent's
 * system prompt based on owner feedback or corrections.  The agent is intentionally
 * conservative: it only touches the section that is directly relevant to the
 * correction and preserves all other formatting and instructions verbatim.
 */

import type { AgentDomain } from '@/types/training';
import type { ModelName } from '@/types/ai-models';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

const FILE = 'prompt-engineer-agent.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PromptRevisionRequest {
  agentType: AgentDomain;
  currentSystemPrompt: string;
  correction: string;
  /** Human-readable context, e.g. "Mission grading — user gave 2 stars" */
  context: string;
}

export interface PromptRevisionResponse {
  /** The exact section from the current prompt that needs changing */
  beforeSection: string;
  /** The proposed revised section */
  afterSection: string;
  /** Optional question if the correction conflicts with an existing rule */
  clarifyingQuestion?: string;
  /** 1-2 sentence summary of what changed and why */
  changeDescription: string;
  /** The complete prompt with the change applied */
  fullRevisedPrompt: string;
}

// ---------------------------------------------------------------------------
// Internal types used for parsing
// ---------------------------------------------------------------------------

interface ParsedRevision {
  before: string;
  after: string;
  description: string;
  question: string | null;
}

// ---------------------------------------------------------------------------
// Prompt Engineer system prompt
// ---------------------------------------------------------------------------

const PROMPT_ENGINEER_SYSTEM_PROMPT = `You are a specialist in editing AI agent system prompts.

Your role is to apply targeted, surgical edits to an existing system prompt based on owner feedback.

## Core Rules

1. **Only touch what is relevant.**  Identify the single section of the prompt that is
   responsible for the behaviour described in the correction.  Edit only that section.
   Do not rewrite, reorganise, or summarise the rest of the prompt.

2. **Preserve formatting exactly.**  The original prompt may use decorative dividers such
   as \`═══\`, section headers, bullet styles, numbered lists, and indentation.
   Your revised section must match the original formatting style character-for-character.

3. **Never delete working instructions.**  If existing instructions are not directly
   contradicted by the correction, keep them.  Only remove text that the correction
   explicitly renders wrong or obsolete.

4. **Handle conflicts honestly.**  If the correction directly conflicts with an existing
   instruction in the prompt, do NOT silently override the existing instruction.
   Instead, surface the conflict via a clarifying question in the <question> tag.

5. **Minimal diff.**  Prefer adding a new bullet or modifying a sentence over rewriting
   a whole block.

## Output Format

You MUST respond using exactly this XML-like structure.  No other text outside the tags.

<before>
[Copy the exact section — and only that section — from the current prompt that you are
changing.  This must be a verbatim substring of the current prompt so it can be located
and replaced programmatically.]
</before>
<after>
[The revised version of that section, with the correction applied.]
</after>
<description>
[1-2 sentences summarising what changed and why.]
</description>
<question>
[If the correction conflicts with an existing rule, write a specific clarifying question
here asking the owner which instruction should take precedence.  Otherwise write exactly:
NONE]
</question>`;

// ---------------------------------------------------------------------------
// Helper: parse the structured response
// ---------------------------------------------------------------------------

function parseRevisionResponse(raw: string): ParsedRevision | null {
  const extract = (tag: string): string | null => {
    const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = pattern.exec(raw);
    return match !== null ? match[1].trim() : null;
  };

  const before = extract('before');
  const after = extract('after');
  const description = extract('description');
  const questionRaw = extract('question');

  if (before === null || after === null || description === null) {
    return null;
  }

  const question =
    questionRaw === null || questionRaw.toUpperCase() === 'NONE' ? null : questionRaw;

  return { before, after, description, question };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Ask the Prompt Engineer AI to propose a targeted revision to a system prompt.
 *
 * The AI locates the section responsible for the undesired behaviour, rewrites
 * only that section, and returns both the section diff and the full revised prompt.
 */
export async function proposePromptRevision(
  request: PromptRevisionRequest,
): Promise<PromptRevisionResponse> {
  logger.info('[PromptEngineerAgent] Revision requested', {
    file: FILE,
    agentType: request.agentType,
    context: request.context,
  });

  const userMessage = `## Agent Type
${request.agentType}

## Context
${request.context}

## Owner Correction
${request.correction}

## Current System Prompt
\`\`\`
${request.currentSystemPrompt}
\`\`\`

Apply the correction to the system prompt following the rules in your instructions.
Output only the four XML tags — no additional commentary.`;

  // claude-3-opus was retired by OpenRouter (404 "No endpoints found for
  // anthropic/claude-3-opus"). Switching to the current-generation Sonnet
  // which has driven the rest of the pipeline reliably through today's
  // testing and produces valid structured output for this agent's prompt.
  const model: ModelName = 'claude-sonnet-4.6';
  const provider = new OpenRouterProvider(PLATFORM_ID);

  let rawResponse: string;

  try {
    const chatResponse = await provider.chat({
      model,
      messages: [
        { role: 'system', content: PROMPT_ENGINEER_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      maxTokens: 8192,
    });

    rawResponse = chatResponse.content;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[PromptEngineerAgent] OpenRouter call failed', error, { file: FILE });

    return {
      beforeSection: '',
      afterSection: '',
      clarifyingQuestion:
        `The AI call failed and could not produce a revision. Error: ${error.message}. ` +
        'Please try again or manually edit the prompt.',
      changeDescription: 'No change was made — the AI call failed.',
      fullRevisedPrompt: request.currentSystemPrompt,
    };
  }

  logger.info('[PromptEngineerAgent] Raw response received', {
    file: FILE,
    responseLength: rawResponse.length,
  });

  // --- Parse structured response ------------------------------------------

  const parsed = parseRevisionResponse(rawResponse);

  if (parsed === null) {
    logger.warn('[PromptEngineerAgent] Failed to parse structured response', {
      file: FILE,
      rawResponse,
    });

    return {
      beforeSection: '',
      afterSection: '',
      clarifyingQuestion:
        'The AI returned an unexpected format and the revision could not be parsed. ' +
        'Could you clarify which section of the prompt you would like to modify?',
      changeDescription: 'No change was made — the response format was invalid.',
      fullRevisedPrompt: request.currentSystemPrompt,
    };
  }

  // --- Verify the before-section exists verbatim in the current prompt -----

  if (!request.currentSystemPrompt.includes(parsed.before)) {
    logger.warn('[PromptEngineerAgent] Before-section not found verbatim in current prompt', {
      file: FILE,
      beforeSection: parsed.before.slice(0, 120),
    });

    return {
      beforeSection: parsed.before,
      afterSection: parsed.after,
      clarifyingQuestion:
        'The AI proposed a change to a section that could not be located verbatim in the ' +
        'current prompt.  Could you point to the specific paragraph or rule you want changed ' +
        'so the revision can be applied precisely?',
      changeDescription: parsed.description,
      fullRevisedPrompt: request.currentSystemPrompt,
    };
  }

  // --- Build the full revised prompt ---------------------------------------

  // Replace only the first occurrence to avoid unintended double-replacement
  const fullRevisedPrompt = request.currentSystemPrompt.replace(parsed.before, parsed.after);

  logger.info('[PromptEngineerAgent] Revision produced successfully', {
    file: FILE,
    agentType: request.agentType,
    hasConflict: parsed.question !== null,
  });

  return {
    beforeSection: parsed.before,
    afterSection: parsed.after,
    clarifyingQuestion: parsed.question ?? undefined,
    changeDescription: parsed.description,
    fullRevisedPrompt,
  };
}
