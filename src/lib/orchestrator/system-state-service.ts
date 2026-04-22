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

// ============================================================================
// QUERY CLASSIFICATION — RETIRED
// ============================================================================
//
// The regex-based classifier (FACTUAL_PATTERNS, ADVISORY_PATTERNS, etc.) was
// removed Apr 22 2026. Pattern matching is not intent reading — it dressed up
// keyword hits as "intelligent classification" while requiring per-prompt
// regex patches every time a user phrased something a new way.
//
// The GM-backed Intent Expander (src/lib/orchestrator/intent-expander.ts) is
// now the single source of truth for queryType + suggested tools. It runs
// Haiku 4.5, returns classification + tool plan in one LLM call, and is gated
// by scripts/verify-intent-expander-behavior.ts before any model upgrade.
//
// validateClaim, generateStateContext, and detectPotentialHallucination are
// real functions used elsewhere — kept intact below.
// ============================================================================

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
  validateClaim,
  generateStateContext,
  detectPotentialHallucination,
  generateCorrectionPrompt,
};
