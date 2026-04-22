/**
 * System State Service - Mandatory State Reflection for Jasper
 *
 * This service ensures Jasper ALWAYS queries real system data before
 * generating strategic responses. It implements the "State Reflection"
 * pattern to eliminate hallucination.
 *
 * RULE: If Jasper's internal "thought" contradicts tool data, TOOL DATA WINS.
 *
 * @module system-state-service
 */

import { executeGetSystemState, type SystemState } from './jasper-tools';
import { SPECIALISTS } from './feature-manifest';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// STATE VALIDATION TYPES
// ============================================================================

/**
 * Represents a claimed data value that needs validation.
 * Used when Jasper makes factual claims about system state.
 */
export interface ClaimedData {
  totalOrgs?: number;
  agentCount?: number;
  trialCount?: number;
  activeOrgs?: number;
  suspendedOrgs?: number;
  atRiskOrgs?: number;
}

/**
 * Represents a specific data correction when claimed data differs from actual.
 */
export interface StateCorrection {
  field: string;
  claimed: number | string | boolean;
  actual: number | string | boolean;
  message: string;
}

export interface StateValidation {
  isValid: boolean;
  corrections: StateCorrection[];
  verifiedState: SystemState;
}

export interface QueryClassification {
  requiresStateReflection: boolean;
  queryType: 'factual' | 'strategic' | 'advisory' | 'conversational' | 'action';
  suggestedTools: string[];
  reason: string;
}

// ============================================================================
// QUERY CLASSIFICATION
// ============================================================================

/**
 * Patterns that REQUIRE state reflection before responding.
 * These are queries where hallucination would be harmful.
 */
const FACTUAL_PATTERNS = [
  /how many (org|user|agent|trial|customer)/i,
  /what (is|are) (the|our) (count|total|number)/i,
  /status of/i,
  /how (does|do) (the|our) (system|platform|feature)/i,
  /what can (you|the system|jasper)/i,
  /list (all|the|our)/i,
  /show me (the|all)/i,
  /what (features|capabilities|integrations)/i,
  /is .* (configured|setup|connected|enabled)/i,
  /what happened (with|to)/i,
  /any (errors|issues|problems)/i,
  /provisioner/i,
  /architecture/i,
  // "What leads/customers/... do we have" — possessive-read questions.
  // Without this, the classifier falls through to advisory, then the Intent
  // Expander promotes to action (because "leads" suggests tools), and Jasper
  // runs scan_leads + enrich_lead + score_leads for what should be a read.
  /what (?:[\w\s]+? )?do (?:we|i|you) have/i,
  /who (?:are|is) (?:our|my|the) (?:lead|customer|client|prospect|user)s?/i,
];

/**
 * Advisory patterns — the user is ASKING A QUESTION, not requesting action.
 * Jasper should respond conversationally with recommendations, NOT execute tools.
 * State context is loaded so Jasper can give informed advice.
 */
const ADVISORY_PATTERNS = [
  /what.*(recommend|suggest|think|advise)/i,
  /what (should|would|could) (we|i|you)/i,
  /how (should|would|could) (we|i|you)/i,
  /where (do|should) (we|i) start/i,
  /what.*priority/i,
  /what.*focus/i,
  /what.*best (way|approach|strategy)/i,
  /any (ideas|suggestions|thoughts)/i,
  /help me (understand|figure out|think through|plan)/i,
  /can you (explain|help me understand|walk me through)/i,
  // Trailing question cues — standalone "thoughts?", "ideas?", etc. at end of message
  /[—–\-,]\s*(thoughts|ideas|suggestions|opinions|advice|input)\s*\??\s*$/i,
  /\b(thoughts|ideas|suggestions)\s*\?\s*$/i,
  /\bwhat do you think\s*\??\s*$/i,
  /\bwhat would you (do|say|suggest)\s*\??\s*$/i,
  /\bsound good\s*\??\s*$/i,
  /\bmake sense\s*\??\s*$/i,
  // Contemplative phrasing — user is exploring, not commanding
  /^(i'?m\s+)?(thinking about|considering|wondering about|mulling over|toying with|exploring)\b/i,
  /^(i'?m\s+)?curious about/i,
];

/**
 * Strategic patterns — the user wants to TAKE ACTION.
 * These benefit from state context and DO trigger tool execution.
 */
const STRATEGIC_PATTERNS = [
  /launch/i,
  /get started/i,
  /let'?s (do|go|start|build|create|run)/i,
  /go ahead/i,
  /execute/i,
  /run (the|a|this)/i,
  /do it/i,
  /make it happen/i,
];

/**
 * Conversational patterns that don't need state reflection.
 */
const CONVERSATIONAL_PATTERNS = [
  /^(hi|hello|hey|good morning|good afternoon)/i,
  /^(thanks|thank you|great|awesome|perfect)/i,
  /^(yes|no|okay|ok|sure|got it)/i,
];

/**
 * Classify a user query to determine if state reflection is needed.
 */
export function classifyQuery(query: string): QueryClassification {
  const queryLower = query.toLowerCase().trim();

  // Check conversational first (lowest priority for tools)
  if (CONVERSATIONAL_PATTERNS.some((p) => p.test(queryLower))) {
    return {
      requiresStateReflection: false,
      queryType: 'conversational',
      suggestedTools: [],
      reason: 'Conversational query - no data lookup needed',
    };
  }

  // Check factual patterns (highest priority for tools)
  if (FACTUAL_PATTERNS.some((p) => p.test(queryLower))) {
    const suggestedTools: string[] = [];

    if (/how many|count|total|number/i.test(queryLower)) {
      suggestedTools.push('get_platform_stats');
    }
    if (/how does|architecture|feature|capabilities/i.test(queryLower)) {
      suggestedTools.push('query_docs');
    }
    if (/status|error|issue|log/i.test(queryLower)) {
      suggestedTools.push('inspect_agent_logs');
    }
    if (/configured|setup|connected/i.test(queryLower)) {
      suggestedTools.push('get_system_state');
    }
    if (/\b(lead|customer|client|prospect)s?\b/i.test(queryLower)) {
      suggestedTools.push('scan_leads');
    }

    if (suggestedTools.length === 0) {
      suggestedTools.push('get_system_state');
    }

    return {
      requiresStateReflection: true,
      queryType: 'factual',
      suggestedTools,
      reason: 'Factual query detected - MUST use tools to verify data',
    };
  }

  // Check advisory patterns BEFORE strategic — questions get conversation, not execution
  if (ADVISORY_PATTERNS.some((p) => p.test(queryLower))) {
    return {
      requiresStateReflection: true,
      queryType: 'advisory',
      suggestedTools: ['get_system_state', 'get_platform_stats'],
      reason: 'Advisory query - user is asking for guidance, NOT requesting action. Respond with recommendations, do NOT execute tools.',
    };
  }

  // Check strategic patterns — user wants to take action
  if (STRATEGIC_PATTERNS.some((p) => p.test(queryLower))) {
    return {
      requiresStateReflection: true,
      queryType: 'strategic',
      suggestedTools: ['get_system_state', 'get_platform_stats'],
      reason: 'Strategic query - recommend state awareness for data-driven response',
    };
  }

  // Default: treat as advisory (safe fallback).
  // If the user truly wants action, the Intent Expander will detect it and
  // the expander override will reclassify. Defaulting to 'action' is dangerous
  // because informational statements ("our target is X") would trigger execution.
  return {
    requiresStateReflection: true,
    queryType: 'advisory',
    suggestedTools: ['get_system_state'],
    reason: 'Unclassified query - defaulting to advisory for safety. Intent Expander will override if action is detected.',
  };
}

// ============================================================================
// STATE VALIDATION
// ============================================================================

/**
 * Validate a claimed state against actual system state.
 * Used to catch hallucinations BEFORE they reach the user.
 */
export async function validateClaim(
  claimedData: ClaimedData
): Promise<StateValidation> {
  const actualState = await executeGetSystemState();
  const corrections: StateCorrection[] = [];

  // Validate organization counts
  if (claimedData.totalOrgs !== undefined) {
    if (claimedData.totalOrgs !== actualState.platform.totalOrganizations) {
      corrections.push({
        field: 'totalOrgs',
        claimed: claimedData.totalOrgs,
        actual: actualState.platform.totalOrganizations,
        message: `Claimed ${claimedData.totalOrgs} organizations but actual count is ${actualState.platform.totalOrganizations}`,
      });
    }
  }

  // Validate agent counts
  if (claimedData.agentCount !== undefined) {
    if (claimedData.agentCount !== actualState.agents.total) {
      corrections.push({
        field: 'agentCount',
        claimed: claimedData.agentCount,
        actual: actualState.agents.total,
        message: `Claimed ${claimedData.agentCount} agents but actual count is ${actualState.agents.total}`,
      });
    }
  }

  // Validate trial counts
  if (claimedData.trialCount !== undefined) {
    if (claimedData.trialCount !== actualState.platform.trialOrganizations) {
      corrections.push({
        field: 'trialCount',
        claimed: claimedData.trialCount,
        actual: actualState.platform.trialOrganizations,
        message: `Claimed ${claimedData.trialCount} trials but actual count is ${actualState.platform.trialOrganizations}`,
      });
    }
  }

  return {
    isValid: corrections.length === 0,
    corrections,
    verifiedState: actualState,
  };
}

// ============================================================================
// PRE-FLIGHT STATE INJECTION
// ============================================================================

/**
 * Generate a state context block to inject into Jasper's prompt.
 * This ensures Jasper has accurate data BEFORE generating a response.
 */
export async function generateStateContext(): Promise<string> {
  try {
    const state = await executeGetSystemState();

    return `
═══════════════════════════════════════════════════════════════════════════════
VERIFIED SYSTEM STATE (${state.timestamp})
═══════════════════════════════════════════════════════════════════════════════

PLATFORM METRICS (USE THESE EXACT NUMBERS):
- Total Organizations: ${state.platform.totalOrganizations}
- Active Organizations: ${state.platform.activeOrganizations}
- Trial Organizations: ${state.platform.trialOrganizations}
- At-Risk Organizations: ${state.platform.atRiskOrganizations}

SPECIALIZED AGENTS (${state.agents.total} TOTAL):
- Available without connection: ${state.agents.byStatus.available || 0}
- Requires connection: ${state.agents.byStatus.requires_connection || 0}
- Agent IDs: ${state.agents.specialists.map((s) => s.id).join(', ')}

PROVISIONER STATUS:
- Recent Errors: ${state.provisioner.recentErrors.length}
- Last Success: ${state.provisioner.lastSuccessfulProvision ?? 'N/A'}

${PLATFORM_ID ? `
FEATURE CONFIGURATION (${PLATFORM_ID}):
- Configured: ${state.features.configured.join(', ') || 'None'}
- Unconfigured: ${state.features.unconfigured.join(', ') || 'None'}
` : ''}

CRITICAL INSTRUCTION:
If your response would state a number different from above, STOP and use the
get_platform_stats or get_system_state tool to verify. Tool data ALWAYS wins.
═══════════════════════════════════════════════════════════════════════════════
`;
  } catch (error) {
    logger.error('[SystemStateService] Failed to generate state context', error instanceof Error ? error : new Error(String(error)));

    // Return minimal fallback
    return `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM STATE: VERIFICATION REQUIRED
═══════════════════════════════════════════════════════════════════════════════

Unable to pre-fetch state. You MUST call get_system_state or get_platform_stats
before stating any numbers or making claims about system capabilities.

Known constants:
- Specialized Agents: 11 (creative: 3, social: 5, technical: 3)
- Agent IDs: ${SPECIALISTS.map((s) => s.id).join(', ')}
═══════════════════════════════════════════════════════════════════════════════
`;
  }
}

// ============================================================================
// RESPONSE VERIFICATION
// ============================================================================

/**
 * Patterns that indicate potential hallucination.
 */
const HALLUCINATION_INDICATORS = [
  /\b(I think|I believe|probably|might be|could be|around|approximately)\b.*\b(org|user|agent|trial|customer)/i,
  /\b(many|several|some|few|lots of)\b.*\b(org|user|agent|trial|customer)/i,
  /\b\d+\b.*\b(org|user|agent|trial|customer)/i, // Any number + entity
];

/**
 * Check if a response contains potential hallucinations about factual data.
 */
export function detectPotentialHallucination(response: string): {
  detected: boolean;
  indicators: string[];
} {
  const indicators: string[] = [];

  for (const pattern of HALLUCINATION_INDICATORS) {
    const match = response.match(pattern);
    if (match) {
      indicators.push(match[0]);
    }
  }

  // Special check: if response mentions a number that should come from tools
  const numberMentions = response.match(/\b(\d+)\s+(org|agent|trial|customer|user)/gi);
  if (numberMentions) {
    indicators.push(...numberMentions);
  }

  return {
    detected: indicators.length > 0,
    indicators,
  };
}

/**
 * Generate a correction prompt if hallucination is detected.
 */
export function generateCorrectionPrompt(
  originalResponse: string,
  validation: StateValidation
): string {
  if (validation.isValid) {
    return originalResponse;
  }

  const corrections = validation.corrections
    .map((c) => `- ${c.field}: You said "${c.claimed}" but actual is "${c.actual}"`)
    .join('\n');

  return `
CORRECTION REQUIRED - Your response contained inaccurate data:

${corrections}

Please regenerate your response using the VERIFIED STATE:
- Total Organizations: ${validation.verifiedState.platform.totalOrganizations}
- Active: ${validation.verifiedState.platform.activeOrganizations}
- Trials: ${validation.verifiedState.platform.trialOrganizations}
- Agents: ${validation.verifiedState.agents.total}

Original response to correct:
${originalResponse}
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SystemStateService = {
  classifyQuery,
  validateClaim,
  generateStateContext,
  detectPotentialHallucination,
  generateCorrectionPrompt,
};
