/**
 * Lead Routing API Endpoint
 * 
 * POST /api/routing/route-lead
 * 
 * Intelligent lead routing endpoint that assigns leads to the best-matched sales rep
 * based on performance, workload, territory, and specialization.
 * 
 * FEATURES:
 * - AI-powered rep matching
 * - Workload balancing
 * - Territory-based routing
 * - Skill-based matching
 * - Manual override capability
 * - Signal Bus integration
 * - Rate limiting (10 requests/min)
 * - Response caching (5 min TTL)
 * 
 * @module api/routing/route-lead
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { leadRoutingEngine } from '@/lib/routing';
import { routeLeadRequestSchema } from '@/lib/routing/validation';
import type {
  Lead,
  SalesRep,
  RoutingConfiguration,
  RoutingRule,
  RouteLeadResponse,
} from '@/lib/routing/types';
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
// RESPONSE CACHING
// ============================================================================

interface CacheEntry {
  response: RouteLeadResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached response if available
 */
function getCachedResponse(leadId: string): RouteLeadResponse | null {
  const entry = responseCache.get(leadId);
  if (!entry) {return null;}

  if (entry.expiresAt < Date.now()) {
    responseCache.delete(leadId);
    return null;
  }

  return entry.response;
}

/**
 * Cache response
 */
function cacheResponse(leadId: string, response: RouteLeadResponse): void {
  responseCache.set(leadId, {
    response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/routing/route-lead
 * Route a lead to the best-matched sales rep
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = routeLeadRequestSchema.parse(body);

    const { leadId, strategy, forceRepId, context } = validatedRequest;

    // Rate limiting (use leadId as identifier)
    const rateLimit = checkRateLimit(leadId);
    if (rateLimit.limited) {
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

    // Check cache
    const cached = getCachedResponse(leadId);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          'X-Cache': 'HIT',
          'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      });
    }

    // TODO: Fetch lead from database
    // For now, using mock data
    const lead: Lead = {
      id: leadId,
      orgId: 'org_demo',
      companyName: 'Acme Corp',
      contactName: 'John Doe',
      contactEmail: 'john@acme.com',
      source: 'inbound_website',
      qualityScore: 85,
      intentScore: 90,
      fitScore: 80,
      priority: 'hot',
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // TODO: Fetch available reps from database
    // For now, using mock data
    const availableReps: SalesRep[] = [
      {
        id: 'rep_1',
        orgId: 'org_demo',
        name: 'Alice Johnson',
        email: 'alice@company.com',
        performanceTier: 'top_performer',
        overallScore: 92,
        skillScores: {
          prospecting: 95,
          discovery: 90,
          needsAnalysis: 88,
          presentation: 92,
          objectionHandling: 90,
          negotiation: 87,
          closing: 94,
          relationshipBuilding: 91,
          productKnowledge: 89,
          crmHygiene: 85,
          timeManagement: 88,
          aiToolAdoption: 93,
        },
        capacity: {
          maxActiveLeads: 50,
          maxNewLeadsPerDay: 5,
          maxNewLeadsPerWeek: 20,
        },
        currentWorkload: {
          activeLeads: 35,
          leadsAssignedToday: 2,
          leadsAssignedThisWeek: 8,
          totalPipelineValue: 500000,
          utilizationPercentage: 70,
          isAtCapacity: false,
          remainingCapacity: {
            leads: 15,
            dailyLeads: 3,
            weeklyLeads: 12,
          },
        },
        specializations: {
          industries: ['Technology', 'SaaS'],
          companySizes: ['enterprise', 'mid_market'],
        },
        territories: [],
        isAvailable: true,
        availabilityStatus: 'available',
        routingPreferences: {
          autoAccept: true,
          notifyOnAssignment: true,
          notifyOnHotLead: true,
        },
      },
      {
        id: 'rep_2',
        orgId: 'org_demo',
        name: 'Bob Smith',
        email: 'bob@company.com',
        performanceTier: 'high_performer',
        overallScore: 85,
        skillScores: {
          prospecting: 82,
          discovery: 88,
          needsAnalysis: 85,
          presentation: 87,
          objectionHandling: 84,
          negotiation: 83,
          closing: 86,
          relationshipBuilding: 88,
          productKnowledge: 82,
          crmHygiene: 80,
          timeManagement: 85,
          aiToolAdoption: 84,
        },
        capacity: {
          maxActiveLeads: 40,
          maxNewLeadsPerDay: 4,
          maxNewLeadsPerWeek: 16,
        },
        currentWorkload: {
          activeLeads: 20,
          leadsAssignedToday: 1,
          leadsAssignedThisWeek: 4,
          totalPipelineValue: 300000,
          utilizationPercentage: 50,
          isAtCapacity: false,
          remainingCapacity: {
            leads: 20,
            dailyLeads: 3,
            weeklyLeads: 12,
          },
        },
        specializations: {
          industries: ['Healthcare', 'Finance'],
          companySizes: ['mid_market', 'smb'],
        },
        territories: [],
        isAvailable: true,
        availabilityStatus: 'available',
        routingPreferences: {
          autoAccept: true,
          notifyOnAssignment: true,
          notifyOnHotLead: true,
        },
      },
    ];

    // TODO: Fetch routing configuration from database
    // For now, using default config
    const config: RoutingConfiguration = {
      orgId: 'org_demo',
      defaultStrategy:(strategy !== '' && strategy != null) ? strategy : 'performance_weighted',
      strategyWeights: {
        performance: 0.35,
        capacity: 0.20,
        specialization: 0.25,
        territory: 0.15,
        availability: 0.05,
      },
      hotLeadRouting: {
        enabled: true,
        threshold: 80,
        routeToTopPerformers: true,
        topPerformerPercentile: 20,
      },
      workloadBalancing: {
        enabled: true,
        balanceThreshold: 30,
        rebalanceInterval: 24,
      },
      roundRobin: {
        enabled: false,
        resetInterval: 'daily',
        skipAtCapacity: true,
      },
      reassignment: {
        allowReassignment: true,
        maxReassignments: 3,
        reassignAfterDays: 7,
        reassignIfNoContact: true,
      },
      queue: {
        enabled: true,
        maxQueueTime: 24,
        escalateAfter: 4,
      },
      notifications: {
        notifyRepOnAssignment: true,
        notifyManagerOnHotLead: true,
        notifyOnQueueEscalation: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Handle manual override
    if (forceRepId) {
      const forcedRep = availableReps.find(r => r.id === forceRepId);
      if (!forcedRep) {
        return NextResponse.json(
          {
            success: false,
            error: `Rep ${forceRepId} not found`,
            metadata: {
              processingTimeMs: Date.now() - startTime,
              strategyUsed: 'manual',
              rulesEvaluated: 0,
            },
          },
          { status: 404 }
        );
      }

      // Create manual assignment
      const manualAssignment = {
        id: `assignment_${leadId}_${Date.now()}`,
        leadId,
        repId: forceRepId,
        orgId: lead.orgId,
        assignmentMethod: 'manual' as const,
        strategy: 'hybrid' as const,
        matchedRules: [],
        matchScore: 100,
        confidence: 1.0,
        reason: 'Manual override by admin',
        status: 'active' as const,
        assignedAt: new Date(),
      };

      const response: RouteLeadResponse = {
        success: true,
        assignment: manualAssignment,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          strategyUsed: 'hybrid',
          rulesEvaluated: 0,
        },
      };

      // Emit signal
      try {
        const coordinator = getServerSignalCoordinator();
        const signal = createLeadRoutedSignal(
          lead.orgId,
          lead,
          manualAssignment,
          lead.qualityScore,
          0.5
        );
        await coordinator.emitSignal(signal);
      } catch (signalError) {
        console.error('Failed to emit routing signal:', signalError);
        // Continue - don't fail the routing
      }

      return NextResponse.json(response, {
        status: 200,
        headers: {
          'X-Cache': 'MISS',
          'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      });
    }

    // TODO: Fetch routing rules from database
    const rules: RoutingRule[] = [];

    // Route the lead
    const analysis = await leadRoutingEngine.routeLead(
      lead,
      availableReps,
      config,
      rules
    );

    // Create assignment record
    const assignment = leadRoutingEngine.createAssignment(
      lead,
      analysis,
      'automatic',
      config.defaultStrategy
    );

    const processingTimeMs = Date.now() - startTime;

    const response: RouteLeadResponse = {
      success: true,
      assignment,
      analysis,
      metadata: {
        processingTimeMs,
        strategyUsed: config.defaultStrategy,
        rulesEvaluated: rules.length,
      },
    };

    // Cache the response
    cacheResponse(leadId, response);

    // Emit signal
    try {
      const coordinator = getServerSignalCoordinator();
      const signal = createLeadRoutedSignal(
        lead.orgId,
        lead,
        assignment,
        analysis.leadQuality.overallScore,
        analysis.recommendation.expectedOutcomes.conversionProbability
      );
      await coordinator.emitSignal(signal);
    } catch (signalError) {
      console.error('Failed to emit routing signal:', signalError);
      // Continue - don't fail the routing
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Cache': 'MISS',
        'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      },
    });

  } catch (error) {
    console.error('Lead routing error:', error);

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
      try {
        const body = await request.json();
        const { leadId } = body;
        
        // Mock lead for signal emission
        const lead: Lead = {
          id: leadId,
          orgId: 'org_demo',
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
          'org_demo',
          lead,
          error.message,
          0,
          'hybrid',
          false
        );
        await coordinator.emitSignal(signal);
      } catch (signalError) {
        console.error('Failed to emit failure signal:', signalError);
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
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}
