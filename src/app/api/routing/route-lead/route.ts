/**
 * Lead Routing API Endpoint
 *
 * POST /api/routing/route-lead
 *
 * Production lead routing endpoint that assigns leads to the best-matched sales rep
 * using configurable routing algorithms (Round Robin, Territory, Skill-based, Load Balance).
 *
 * FEATURES:
 * - Round Robin distribution (default)
 * - Territory-based routing (state/country/industry)
 * - Skill-based matching (language preferences)
 * - Load balancing (capacity-aware)
 * - Manual override capability
 * - Firestore-backed routing rules
 * - Activity audit logging
 * - Signal Bus integration
 * - Rate limiting (10 requests/min)
 *
 * ALGORITHM:
 * 1. Fetch lead from Firestore
 * 2. Evaluate routing rules by priority
 * 3. Apply matching strategy (round-robin/territory/skill/load-balance)
 * 4. Update lead.ownerId with assigned rep
 * 5. Create audit trail in activities collection
 *
 * @module api/routing/route-lead
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { hasUnifiedPermission, type AccountRole } from '@/types/unified-rbac';
import { routeLead as executeRouting, type RoutingResult } from '@/lib/crm/lead-routing';
import { getLead, updateLead } from '@/lib/crm/lead-service';
import { logStatusChange } from '@/lib/crm/activity-logger';
import { logger } from '@/lib/logger/logger';
import type { Lead, RouteLeadResponse } from '@/lib/routing/types';
import { createLeadRoutedSignal, createRoutingFailedSignal } from '@/lib/routing/events';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_REQUESTS = 10; // requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Check if request should be rate limited
 */
function checkRateLimit(identifier: string): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(identifier, { count: 1, resetAt });
    return { limited: false, remaining: RATE_LIMIT_REQUESTS - 1, resetAt };
  }

  if (entry.count >= RATE_LIMIT_REQUESTS) {
    // Rate limit exceeded
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  return { limited: false, remaining: RATE_LIMIT_REQUESTS - entry.count, resetAt: entry.resetAt };
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * Production request schema for lead routing
 */
const productionRouteLeadSchema = z.object({
  leadId: z.string().min(1, 'leadId is required'),
  workspaceId: z.string().default('default'),
  forceRepId: z.string().optional(),
});

/**
 * POST /api/routing/route-lead
 *
 * Production lead routing endpoint that assigns leads to sales reps using
 * configurable routing algorithms stored in Firestore.
 *
 * ALGORITHM PRIORITY:
 * 1. Evaluate routing rules by priority (highest first)
 * 2. Apply matching strategy: round-robin → territory → skill-based → load-balance
 * 3. Fallback to default round-robin across active org members
 *
 * @requires Authentication via Bearer token
 * @requires Permission: canAssignRecords
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let organizationId: string | undefined;
  let leadId: string | undefined;
  let workspaceId: string = 'default';

  try {
    // =========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // =========================================================================
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    organizationId = user.organizationId;

    // Verify user has permission to assign records
    if (!hasUnifiedPermission(user.role as AccountRole, 'canAssignRecords')) {
      logger.warn('Lead routing permission denied', {
        userId: user.uid,
        role: user.role,
        organizationId,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions. canAssignRecords permission required.',
        },
        { status: 403 }
      );
    }

    // =========================================================================
    // 2. REQUEST VALIDATION
    // =========================================================================
    const body = (await request.json()) as unknown;
    const validatedRequest = productionRouteLeadSchema.parse(body);

    leadId = validatedRequest.leadId;
    workspaceId = validatedRequest.workspaceId;
    const { forceRepId } = validatedRequest;

    // Rate limiting (use leadId + orgId as identifier)
    const rateLimitKey = `${organizationId}:${leadId}`;
    const rateLimit = checkRateLimit(rateLimitKey);
    if (rateLimit.limited) {
      logger.warn('Lead routing rate limited', { leadId, organizationId });
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          metadata: {
            processingTimeMs: Date.now() - startTime,
            strategyUsed: 'none',
            rulesEvaluated: 0,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          },
        }
      );
    }

    // =========================================================================
    // 3. FETCH LEAD FROM FIRESTORE
    // =========================================================================
    const crmLead = await getLead(leadId, workspaceId);

    if (!crmLead) {
      logger.warn('Lead not found for routing', { leadId, organizationId, workspaceId });
      return NextResponse.json(
        {
          success: false,
          error: `Lead ${leadId} not found`,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            strategyUsed: 'none',
            rulesEvaluated: 0,
          },
        },
        { status: 404 }
      );
    }

    // Check if lead is already assigned (warn but continue)
    if (crmLead.ownerId) {
      logger.info('Re-routing already assigned lead', {
        leadId,
        previousOwnerId: crmLead.ownerId,
        organizationId,
      });
    }

    // =========================================================================
    // 4. EXECUTE ROUTING ALGORITHM
    // =========================================================================
    let routingResult: RoutingResult;

    if (forceRepId) {
      // Manual override - assign to specific rep
      routingResult = {
        assignedTo: forceRepId,
        routingRuleId: 'manual',
        routingRuleName: 'Manual Assignment',
        reason: `Manual override by ${user.email ?? user.uid}`,
      };

      logger.info('Lead manually assigned', {
        leadId,
        assignedTo: forceRepId,
        assignedBy: user.uid,
        organizationId,
      });
    } else {
      // Execute automatic routing using the CRM lead-routing engine
      // This evaluates: round-robin, territory, skill-based, load-balance rules
      routingResult = await executeRouting(organizationId, workspaceId, crmLead);

      logger.info('Lead automatically routed', {
        leadId,
        assignedTo: routingResult.assignedTo,
        routingRule: routingResult.routingRuleName,
        routingType: routingResult.routingRuleId,
        organizationId,
      });
    }

    // =========================================================================
    // 5. UPDATE LEAD WITH ASSIGNED OWNER
    // =========================================================================
    const previousOwnerId = crmLead.ownerId;

    await updateLead(
      leadId,
      { ownerId: routingResult.assignedTo },
      workspaceId
    );

    logger.info('Lead owner updated', {
      leadId,
      previousOwnerId: previousOwnerId ?? 'none',
      newOwnerId: routingResult.assignedTo,
      organizationId,
    });

    // =========================================================================
    // 6. CREATE AUDIT LOG ENTRY
    // =========================================================================
    try {
      await logStatusChange({
        organizationId,
        workspaceId,
        relatedEntityType: 'lead',
        relatedEntityId: leadId,
        relatedEntityName: `${crmLead.firstName} ${crmLead.lastName}`,
        fieldChanged: 'ownerId',
        previousValue: previousOwnerId ?? null,
        newValue: routingResult.assignedTo,
        userId: user.uid,
        userName: user.email ?? 'System',
      });

      logger.debug('Routing audit log created', { leadId, organizationId });
    } catch (auditError) {
      // Don't fail routing if audit logging fails
      logger.warn('Failed to create routing audit log', {
        error: auditError instanceof Error ? auditError.message : String(auditError),
        leadId,
        organizationId,
      });
    }

    // =========================================================================
    // 7. EMIT SIGNAL BUS EVENT (optional, non-blocking)
    // =========================================================================
    try {
      // Convert CRM lead to routing engine Lead type for signal emission
      const routingLead: Lead = {
        id: crmLead.id,
        orgId: organizationId,
        companyName: crmLead.company ?? crmLead.companyName ?? 'Unknown',
        contactName: `${crmLead.firstName} ${crmLead.lastName}`,
        contactEmail: crmLead.email,
        source: (crmLead.source as Lead['source']) ?? 'other',
        qualityScore: crmLead.score ?? 50,
        priority: crmLead.score && crmLead.score >= 80 ? 'hot' : crmLead.score && crmLead.score >= 50 ? 'warm' : 'cold',
        status: crmLead.status === 'new' ? 'new' : 'contacted',
        createdAt: crmLead.createdAt instanceof Date ? crmLead.createdAt : new Date(),
        updatedAt: new Date(),
      };

      const assignment = {
        id: `assignment_${leadId}_${Date.now()}`,
        leadId,
        repId: routingResult.assignedTo,
        orgId: organizationId,
        assignmentMethod: forceRepId ? 'manual' as const : 'automatic' as const,
        strategy: 'hybrid' as const,
        matchedRules: [routingResult.routingRuleId],
        matchScore: 100,
        confidence: 1.0,
        reason: routingResult.reason,
        status: 'active' as const,
        assignedAt: new Date(),
      };

      const coordinator = getServerSignalCoordinator();
      const signal = createLeadRoutedSignal(
        organizationId,
        routingLead,
        assignment,
        crmLead.score ?? 50,
        0.7
      );
      await coordinator.emitSignal(signal);
    } catch (signalError) {
      // Don't fail routing if signal emission fails
      logger.warn('Failed to emit routing signal', {
        error: signalError instanceof Error ? signalError.message : String(signalError),
        leadId,
      });
    }

    // =========================================================================
    // 8. RETURN SUCCESS RESPONSE
    // =========================================================================
    const processingTimeMs = Date.now() - startTime;

    const response: RouteLeadResponse = {
      success: true,
      assignment: {
        id: `assignment_${leadId}_${Date.now()}`,
        leadId,
        repId: routingResult.assignedTo,
        orgId: organizationId,
        assignmentMethod: forceRepId ? 'manual' : 'automatic',
        strategy: 'hybrid',
        matchedRules: [routingResult.routingRuleId],
        matchScore: 100,
        confidence: 1.0,
        reason: routingResult.reason,
        status: 'active',
        assignedAt: new Date(),
      },
      metadata: {
        processingTimeMs,
        strategyUsed: routingResult.routingRuleName.includes('round-robin')
          ? 'round_robin'
          : routingResult.routingRuleName.includes('territory')
            ? 'territory_based'
            : routingResult.routingRuleName.includes('load')
              ? 'workload_balanced'
              : routingResult.routingRuleName.includes('skill')
                ? 'skill_matched'
                : 'hybrid',
        rulesEvaluated: 1,
      },
    };

    logger.info('Lead routing completed successfully', {
      leadId,
      assignedTo: routingResult.assignedTo,
      processingTimeMs,
      organizationId,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      },
    });

  } catch (error) {
    logger.error('Lead routing error', error instanceof Error ? error : new Error(String(error)), {
      leadId,
      organizationId,
    });

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            strategyUsed: 'none',
            rulesEvaluated: 0,
          },
        },
        { status: 400 }
      );
    }

    // Handle routing engine errors
    if (error instanceof Error) {
      // Try to emit failure signal
      if (organizationId && leadId) {
        try {
          const routingLead: Lead = {
            id: leadId,
            orgId: organizationId,
            companyName: 'Unknown',
            contactName: 'Unknown',
            contactEmail: 'unknown@example.com',
            source: 'other',
            qualityScore: 0,
            priority: 'cold',
            status: 'new',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const coordinator = getServerSignalCoordinator();
          const signal = createRoutingFailedSignal(
            organizationId,
            routingLead,
            error.message,
            0,
            'hybrid',
            false
          );
          await coordinator.emitSignal(signal);
        } catch (signalError) {
          logger.warn('Failed to emit failure signal', {
            error: signalError instanceof Error ? signalError.message : String(signalError),
          });
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            strategyUsed: 'none',
            rulesEvaluated: 0,
          },
        },
        { status: 500 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        metadata: {
          processingTimeMs: Date.now() - startTime,
          strategyUsed: 'none',
          rulesEvaluated: 0,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/routing/route-lead
 * Method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}
