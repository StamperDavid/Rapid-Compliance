/**
 * Tenant Context Wrapper for AI Agents
 *
 * Single-tenant mode: Simplified isolation context for AI agents.
 * Every prompt sent to an LLM includes a system header with organization context.
 *
 * @module tenant-context-wrapper
 */

import type { TenantClaims } from '@/lib/auth/claims-validator';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TenantContext {
  /** Organization ID */
  orgId: string;
  /** Organization name for display */
  orgName: string;
  /** Industry type for persona matching */
  industry?: string;
  /** User's role within the organization */
  role?: string;
  /** Whether user has global admin access */
  isGlobalAdmin: boolean;
}

export interface IsolatedPrompt {
  /** The wrapped prompt with tenant isolation header */
  prompt: string;
  /** Metadata about the isolation */
  metadata: {
    orgId: string;
    isolationLevel: 'strict' | 'admin';
    timestamp: string;
  };
}

export interface CountVerificationRequest {
  /** Collection to verify count for */
  collection: string;
  /** Organization ID scope */
  orgId: string | null;
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
// TENANT ISOLATION HEADER
// ============================================================================

/**
 * Build the Hidden System Header for tenant isolation.
 * PENTHOUSE MODEL: Single-tenant deployment - all users belong to SalesVelocity.
 *
 * @param context - The tenant context
 * @returns The isolation header string
 */
export function buildTenantIsolationHeader(context: TenantContext): string {
  if (context.isGlobalAdmin) {
    // Superadmin (Jasper) has full access within the single organization
    return `[SYSTEM CONTEXT: ADMIN MODE]
You are operating within SalesVelocity's single-tenant platform.
You have full administrative access for monitoring and management.
All data access is logged for compliance and audit purposes.

Current Session:
- Role: Platform Administrator
- Organization: SalesVelocity
- Audit Trail: ENABLED
[END CONTEXT HEADER]

`;
  }

  // Standard users operate within the single organization
  return `[SYSTEM CONTEXT: SINGLE-TENANT MODE]
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
 * Wrap a prompt with tenant isolation context.
 * This ensures all AI interactions are properly scoped to the tenant.
 *
 * @param prompt - The original prompt
 * @param context - The tenant context
 * @returns The isolated prompt with metadata
 */
export function wrapPromptWithTenantContext(
  prompt: string,
  context: TenantContext
): IsolatedPrompt {
  const isolationHeader = buildTenantIsolationHeader(context);

  logger.debug('Wrapping prompt with tenant isolation', {
    orgId: context.orgId,
    isGlobalAdmin: context.isGlobalAdmin,
    promptLength: prompt.length,
    file: 'tenant-context-wrapper.ts',
  });

  return {
    prompt: `${isolationHeader}${prompt}`,
    metadata: {
      orgId: context.orgId,
      isolationLevel: context.isGlobalAdmin ? 'admin' : 'strict',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build tenant context from claims and organization data.
 * Single-tenant mode: Always uses DEFAULT_ORG_ID.
 *
 * @param claims - The user's tenant claims
 * @param orgData - Optional organization data
 * @returns The tenant context
 */
export function buildTenantContext(
  claims: TenantClaims,
  orgData?: { name?: string; industry?: string }
): TenantContext {
  return {
    orgId: DEFAULT_ORG_ID,
    orgName: orgData?.name ?? 'SalesVelocity',
    industry: orgData?.industry,
    role: claims.role ?? undefined,
    isGlobalAdmin: claims.role === 'superadmin',
  };
}

// ============================================================================
// COUNT VERIFICATION (Secure Server Action)
// ============================================================================

/**
 * Verify AI-generated counts against actual database counts.
 * This prevents AI from hallucinating statistics.
 *
 * IMPORTANT: This function must be called from a secure server context
 * with proper authentication.
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
        orgId: request.orgId,
        expected: request.expectedCount,
        actual: actualCount,
        discrepancy,
        file: 'tenant-context-wrapper.ts',
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
      orgId: request.orgId,
      file: 'tenant-context-wrapper.ts',
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
 * Single-tenant mode: Jasper operates within the single organization.
 *
 * @param adminEmail - The admin's email
 * @param platformStats - Platform statistics to include
 * @returns The admin tenant context
 */
export function buildJasperContext(
  _adminEmail: string,
  _platformStats?: {
    totalUsers?: number;
    totalAgents?: number;
  }
): TenantContext {
  return {
    orgId: DEFAULT_ORG_ID,
    orgName: 'SalesVelocity',
    industry: 'system_administration',
    role: 'superadmin',
    isGlobalAdmin: true,
  };
}

/**
 * Build the Jasper system prompt with verified statistics.
 * Single-tenant mode: Focus on organization-level stats.
 *
 * @param stats - Verified statistics
 * @returns The system prompt addition for Jasper
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
 *
 * @param orgId - Organization ID
 * @param orgName - Organization name
 * @param industry - Industry type
 * @param agentName - The agent's name
 * @returns Context string for the agent
 */
export function buildClientAgentContext(
  orgId: string,
  orgName: string,
  industry: string,
  agentName: string
): string {
  const context: TenantContext = {
    orgId,
    orgName,
    industry,
    isGlobalAdmin: false,
  };

  const isolationHeader = buildTenantIsolationHeader(context);

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

const tenantContextWrapper = {
  buildTenantIsolationHeader,
  wrapPromptWithTenantContext,
  buildTenantContext,
  verifyCount,
  buildJasperContext,
  buildJasperStatisticsContext,
  buildClientAgentContext,
};

export default tenantContextWrapper;
