/**
 * Prompt Engineer Agent — legacy adapter.
 *
 * HISTORY: this file originally hardcoded the Prompt Engineer's model
 * (anthropic/claude-3-opus) and its entire system prompt as a TS constant.
 * When OpenRouter retired claude-3-opus the function started failing
 * silently, persisting proposals with changeDescription="AI call failed."
 * Owner flagged that all agents are supposed to pull model + prompt from
 * Firestore Golden Masters, not from hardcoded values — per Standing Rule
 * #1 ("every LLM agent spawns from its Golden Master, Brand DNA baked in").
 *
 * This file now delegates to the proper GM-backed Prompt Engineer specialist
 * at `src/lib/agents/prompt-engineer/specialist.ts`. That specialist loads
 * its model, temperature, maxTokens, and system prompt from the
 * `specialistGoldenMasters` collection at runtime. Model changes happen by
 * reseeding the GM (or deploying a new version through the standard
 * grade → Prompt Engineer → approve → deploy pipeline), not by code edit.
 *
 * The legacy PromptRevisionRequest / PromptRevisionResponse shape is kept
 * intact so existing callers work without modification:
 *   - /api/training/propose-prompt-revision (old Training Lab route)
 *   - /api/orchestrator/missions/[missionId]/plan/edit-step (new Bug R hook
 *     that captures operator plan edits as training signal for Jasper)
 */

import type { AgentDomain } from '@/types/training';
import type { AgentMessage } from '@/lib/agents/types';
import { logger } from '@/lib/logger/logger';
import { getPromptEngineer, type ProposePromptEditResult } from '@/lib/agents/prompt-engineer/specialist';

const FILE = 'prompt-engineer-agent.ts';

// ---------------------------------------------------------------------------
// Public types — preserved from the legacy signature for caller compatibility
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
// Main exported function — delegates to the GM-backed specialist
// ---------------------------------------------------------------------------

/**
 * Ask the Prompt Engineer to propose a targeted revision to a system prompt.
 *
 * Delegates to the GM-backed specialist. The specialist loads its model,
 * temperature, maxTokens, and system prompt from Firestore — so updating the
 * Prompt Engineer's own behaviour is a GM change (via seed script or its own
 * Training Lab entry), not a code edit. No hardcoded model here.
 */
export async function proposePromptRevision(
  request: PromptRevisionRequest,
): Promise<PromptRevisionResponse> {
  logger.info('[PromptEngineerAgent] Revision requested (delegating to GM-backed specialist)', {
    file: FILE,
    agentType: request.agentType,
    context: request.context,
  });

  const targetSpecialistId = request.agentType === 'orchestrator'
    ? 'JASPER_ORCHESTRATOR'
    : request.agentType.toUpperCase();
  const targetSpecialistName = request.agentType === 'orchestrator'
    ? 'Jasper (Orchestrator)'
    : request.agentType;

  try {
    const promptEngineer = getPromptEngineer();
    await promptEngineer.initialize();

    const message: AgentMessage = {
      id: `legacy_revision_${Date.now()}`,
      timestamp: new Date(),
      from: 'PROMPT_ENGINEER_LEGACY_ADAPTER',
      to: 'PROMPT_ENGINEER',
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: {
        action: 'propose_prompt_edit',
        targetSpecialistId,
        targetSpecialistName,
        currentSystemPrompt: request.currentSystemPrompt,
        correctedReportExcerpt: request.context,
        humanCorrection: {
          grade: 'request_revision',
          explanation: request.correction,
        },
        priorVersionCount: 0,
      },
      requiresResponse: true,
      traceId: `legacy_revision_${Date.now()}`,
    };

    const report = await promptEngineer.execute(message);
    if (report.status !== 'COMPLETED') {
      const errMsg = (report.errors ?? []).join(' | ') || 'Prompt Engineer returned non-COMPLETED status';
      logger.error('[PromptEngineerAgent] Specialist execution failed', new Error(errMsg), { file: FILE });
      return {
        beforeSection: '',
        afterSection: '',
        clarifyingQuestion: `The Prompt Engineer specialist failed: ${errMsg}. Try again or edit the prompt manually.`,
        changeDescription: 'No change was made — the Prompt Engineer specialist failed.',
        fullRevisedPrompt: request.currentSystemPrompt,
      };
    }

    const result = report.data as ProposePromptEditResult;

    if (result.status === 'CLARIFICATION_NEEDED') {
      return {
        beforeSection: '',
        afterSection: '',
        clarifyingQuestion: result.questions.join(' | '),
        changeDescription: result.rationale,
        fullRevisedPrompt: request.currentSystemPrompt,
      };
    }

    // EDIT_PROPOSED — build the full revised prompt by replacing the target
    // section verbatim. The specialist enforces (via post-parse invariant)
    // that currentText appears verbatim in the input prompt, so this replace
    // is guaranteed to hit exactly once.
    const fullRevisedPrompt = request.currentSystemPrompt.replace(
      result.currentText,
      result.proposedText,
    );

    return {
      beforeSection: result.currentText,
      afterSection: result.proposedText,
      changeDescription: result.rationale,
      fullRevisedPrompt,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[PromptEngineerAgent] Delegation to specialist threw', error, { file: FILE });
    return {
      beforeSection: '',
      afterSection: '',
      clarifyingQuestion:
        `The Prompt Engineer specialist threw: ${error.message}. ` +
        'Check that its Golden Master is seeded in Firestore.',
      changeDescription: 'No change was made — the Prompt Engineer specialist threw.',
      fullRevisedPrompt: request.currentSystemPrompt,
    };
  }
}
