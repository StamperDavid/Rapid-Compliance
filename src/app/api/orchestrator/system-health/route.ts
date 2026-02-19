/**
 * System Health API Endpoint
 *
 * Returns the system health report for an organization.
 * Used by the Implementation Guide to understand what's configured
 * and what needs attention.
 *
 * GET /api/orchestrator/system-health?PLATFORM_ID=xxx
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { SystemHealthService } from '@/lib/orchestrator/system-health-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const specialistStatusRequestSchema = z.object({
  PLATFORM_ID: z.string().min(1, 'PLATFORM_ID is required'),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { searchParams } = new URL(request.url);
    const quickOnly = searchParams.get('quick') === 'true';

    if (quickOnly) {
      // Return just the quick status for performance
      const quickStatus = await SystemHealthService.getQuickStatus();
      return NextResponse.json(quickStatus);
    }

    // Return full health report
    const report = await SystemHealthService.generateHealthReport();

    return NextResponse.json(report);
  } catch (error) {
    logger.error('System health fetch error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch system health', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orchestrator/system-health/specialists
 *
 * Get specialist connection status
 */
export async function POST(request: NextRequest) {
  try {
    const postAuthResult = await requireAuth(request);
    if (postAuthResult instanceof NextResponse) {return postAuthResult;}

    const rawBody: unknown = await request.json();
    const parsed = specialistStatusRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    // parsed.data.PLATFORM_ID is validated by schema (non-empty string required)
    const specialistStatus = await SystemHealthService.getSpecialistStatus();

    return NextResponse.json({
      specialists: specialistStatus,
      availableCount: specialistStatus.filter(s => s.available).length,
      connectedCount: specialistStatus.filter(s => s.connected).length,
      totalCount: specialistStatus.length,
    });
  } catch (error) {
    logger.error('Specialist status fetch error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch specialist status' },
      { status: 500 }
    );
  }
}
