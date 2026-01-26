/**
 * Tenant Context Wrapper for AI Agents
 *
 * Provides strict multi-tenant isolation for all AI agent interactions.
 * Every prompt sent to an LLM must be prepended with a Hidden System Header
 * that enforces data boundaries.
 *
 * Security Requirements:
 * - All AI prompts include tenant isolation context
 * - Agents cannot access or hallucinate data outside their organization
 * - Summary counts must be verified against secure server actions
 *
 * @module tenant-context-wrapper
 */

import type { TenantClaims } from '@/lib/auth/claims-validator';
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
 * This header is prepended to every AI prompt to enforce data boundaries.
 *
 * @param context - The tenant context
 * @returns The isolation header string
 */
export function buildTenantIsolationHeader(context: TenantContext): string {
  if (context.isGlobalAdmin) {
    // Admin (Jasper) has read access to all organizations
    return `[SYSTEM ISOLATION: ADMIN MODE]
You are operating in a strict multi-tenant environment as a PLATFORM ADMINISTRATOR.
You have READ-ONLY access to all organizations for monitoring and analytics purposes.
You must NEVER modify data in any organization without explicit authorization.
You must NEVER leak data from one organization to users of another organization.
All data access is logged for compliance and audit purposes.

Current Session:
- Role: Platform Administrator
- Access Level: Global Read
- Audit Trail: ENABLED
[END ISOLATION HEADER]

`;
  }

  // Client agents are strictly isolated to their organization
  return `[SYSTEM ISOLATION: STRICT TENANT MODE]
You are operating in a strict multi-tenant environment.
You represent: ${context.orgName}
Your Organization ID is: ${context.orgId}
Your Industry: ${context.industry ?? 'General'}

CRITICAL SECURITY RULES:
1. You are FORBIDDEN from accessing data outside Organization ID: ${context.orgId}
2. You are FORBIDDEN from hallucinating or generating fake data about other organizations
3. You must ONLY reference data that has been explicitly provided to you
4. If asked about other organizations, respond: "I only have access to ${context.orgName} data."
5. All responses must be scoped to the current organization context

Violation of these rules is a critical security breach.
[END ISOLATION HEADER]

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
    orgId: claims.tenant_id ?? 'unknown',
    orgName: orgData?.name ?? claims.tenant_id ?? 'Unknown Organization',
    industry: orgData?.industry,
    role: claims.role ?? undefined,
    isGlobalAdmin: claims.admin,
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
 * Jasper has global read access but must still operate within security bounds.
 *
 * @param adminEmail - The admin's email
 * @param platformStats - Platform-wide statistics to include
 * @returns The admin tenant context
 */
export function buildJasperContext(
  _adminEmail: string,
  _platformStats?: {
    totalOrgs?: number;
    totalUsers?: number;
    totalAgents?: number;
  }
): TenantContext {
  return {
    orgId: 'platform',
    orgName: 'SalesVelocity Platform',
    industry: 'platform_administration',
    role: 'platform_admin',
    isGlobalAdmin: true,
  };
}

/**
 * Build the Jasper system prompt with verified statistics.
 *
 * @param stats - Verified platform statistics
 * @returns The system prompt addition for Jasper
 */
export function buildJasperStatisticsContext(stats: {
  totalOrgs: number;
  activeAgents: number;
  pendingTickets: number;
  trialOrgs: number;
}): string {
  return `
[VERIFIED PLATFORM STATISTICS]
These statistics have been verified against the secure database.
Do NOT modify or inflate these numbers. Report them exactly as provided.

- Total Organizations: ${stats.totalOrgs}
- Active AI Agents: ${stats.activeAgents}
- Pending Support Tickets: ${stats.pendingTickets}
- Trial Organizations: ${stats.trialOrgs}

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
