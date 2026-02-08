/**
 * Business Context Wrapper for AI Agents
 *
 * Penthouse model: Isolation context for AI agents.
 * Every prompt sent to an LLM includes a system header with organization context.
 *
 * @module business-context-wrapper
 */

import type { AuthClaims } from '@/lib/auth/claims-validator';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface BusinessContext {
  /** Organization name for display */
  orgName: string;
  /** Industry type for persona matching */
  industry?: string;
  /** User's role within the organization */
  role?: string;
  /** Whether user has admin access */
  isAdmin: boolean;
}

export interface IsolatedPrompt {
  /** The wrapped prompt with isolation header */
  prompt: string;
  /** Metadata about the isolation */
  metadata: {
    isolationLevel: 'strict' | 'admin';
    timestamp: string;
  };
}

export interface CountVerificationRequest {
  /** Collection to verify count for */
  collection: string;
  /** Expected count from AI response */
  expectedCount: number;
}

export interface CountVerificationResult {
  verified: boolean;
  actualCount: number;
  expectedCount: number;
  discrepancy: number;
}

// ============================================================================
// ISOLATION HEADER
// ============================================================================

/**
 * Build the Hidden System Header for context isolation.
 * PENTHOUSE MODEL: Penthouse deployment - all users belong to SalesVelocity.
 *
 * @param context - The business context
 * @returns The isolation header string
 */
export function buildIsolationHeader(context: BusinessContext): string {
  if (context.isAdmin) {
    return `[SYSTEM CONTEXT: ADMIN MODE]
You are operating within SalesVelocity's platform.
You have full administrative access for monitoring and management.
All data access is logged for compliance and audit purposes.

Current Session:
- Role: Platform Administrator
- Organization: SalesVelocity
- Audit Trail: ENABLED
[END CONTEXT HEADER]

`;
  }

  return `[SYSTEM CONTEXT: PENTHOUSE MODE]
You are operating within SalesVelocity's platform.
Organization: ${context.orgName}
Industry: ${context.industry ?? 'General'}

CONTEXT RULES:
1. You represent SalesVelocity
2. You must ONLY reference data that has been explicitly provided to you
3. All responses should align with SalesVelocity's business goals
[END CONTEXT HEADER]

`;
}

// ============================================================================
// PROMPT WRAPPING
// ============================================================================

/**
 * Wrap a prompt with business context.
 * This ensures all AI interactions are properly scoped.
 *
 * @param prompt - The original prompt
 * @param context - The business context
 * @returns The isolated prompt with metadata
 */
export function wrapPromptWithContext(
  prompt: string,
  context: BusinessContext
): IsolatedPrompt {
  const isolationHeader = buildIsolationHeader(context);

  logger.debug('Wrapping prompt with business context', {
    isAdmin: context.isAdmin,
    promptLength: prompt.length,
    file: 'business-context-wrapper.ts',
  });

  return {
    prompt: `${isolationHeader}${prompt}`,
    metadata: {
      isolationLevel: context.isAdmin ? 'admin' : 'strict',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build business context from claims and organization data.
 * Penthouse model: Always uses PLATFORM_ID.
 *
 * @param claims - The user's auth claims
 * @param orgData - Optional organization data
 * @returns The business context
 */
export function buildBusinessContext(
  claims: AuthClaims,
  orgData?: { name?: string; industry?: string }
): BusinessContext {
  return {
    orgName: orgData?.name ?? 'SalesVelocity',
    industry: orgData?.industry,
    role: claims.role ?? undefined,
    isAdmin: claims.role === 'admin',
  };
}

// ============================================================================
// COUNT VERIFICATION (Secure Server Action)
// ============================================================================

/**
 * Verify AI-generated counts against actual database counts.
 * This prevents AI from hallucinating statistics.
 *
 * @param request - The count verification request
 * @param actualCountFn - Function to get actual count (injected for testability)
 * @returns The verification result
 */
export async function verifyCount(
  request: CountVerificationRequest,
  actualCountFn: () => Promise<number>
): Promise<CountVerificationResult> {
  try {
    const actualCount = await actualCountFn();
    const discrepancy = Math.abs(actualCount - request.expectedCount);
    const verified = discrepancy === 0;

    if (!verified) {
      logger.warn('AI count verification failed', {
        collection: request.collection,
        expected: request.expectedCount,
        actual: actualCount,
        discrepancy,
        file: 'business-context-wrapper.ts',
      });
    }

    return {
      verified,
      actualCount,
      expectedCount: request.expectedCount,
      discrepancy,
    };
  } catch (error: unknown) {
    logger.error('Count verification error', error instanceof Error ? error : new Error(String(error)), {
      collection: request.collection,
      file: 'business-context-wrapper.ts',
    });

    return {
      verified: false,
      actualCount: -1,
      expectedCount: request.expectedCount,
      discrepancy: -1,
    };
  }
}

// ============================================================================
// JASPER-SPECIFIC CONTEXT
// ============================================================================

/**
 * Build context for Jasper (Admin AI Assistant).
 * Penthouse model: Jasper operates within the organization.
 */
export function buildJasperContext(
  _adminEmail: string,
  _platformStats?: {
    totalUsers?: number;
    totalAgents?: number;
  }
): BusinessContext {
  return {
    orgName: 'SalesVelocity',
    industry: 'system_administration',
    role: 'admin',
    isAdmin: true,
  };
}

/**
 * Build the Jasper system prompt with verified statistics.
 */
export function buildJasperStatisticsContext(stats: {
  totalUsers: number;
  activeAgents: number;
  pendingTickets: number;
}): string {
  return `
[VERIFIED STATISTICS]
These statistics have been verified against the secure database.
Do NOT modify or inflate these numbers. Report them exactly as provided.

- Total Users: ${stats.totalUsers}
- Active AI Agents: ${stats.activeAgents}
- Pending Support Tickets: ${stats.pendingTickets}

When reporting these statistics, use these exact values.
[END STATISTICS]

`;
}

// ============================================================================
// CLIENT AGENT CONTEXT
// ============================================================================

/**
 * Build context for client-facing AI agents.
 * Client agents are strictly isolated to their organization.
 */
export function buildClientAgentContext(
  orgName: string,
  industry: string,
  agentName: string
): string {
  const context: BusinessContext = {
    orgName,
    industry,
    isAdmin: false,
  };

  const isolationHeader = buildIsolationHeader(context);

  return `${isolationHeader}
You are ${agentName}, an AI assistant for ${orgName}.
Your role is to help customers and staff of ${orgName} with their ${industry} needs.

Remember:
- You ONLY have access to ${orgName}'s data
- Never reference other organizations or their data
- If asked about competitors, provide general industry information only
- All your responses should be helpful to ${orgName}'s business goals
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

const businessContextWrapper = {
  buildIsolationHeader,
  wrapPromptWithContext,
  buildBusinessContext,
  verifyCount,
  buildJasperContext,
  buildJasperStatisticsContext,
  buildClientAgentContext,
};

export default businessContextWrapper;
