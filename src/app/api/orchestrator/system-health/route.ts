/**
 * System Health API Endpoint
 *
 * Returns the system health report for an organization.
 * Used by the Implementation Guide to understand what's configured
 * and what needs attention.
 *
 * GET /api/orchestrator/system-health?organizationId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { SystemHealthService } from '@/lib/orchestrator/system-health-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const quickOnly = searchParams.get('quick') === 'true';

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (quickOnly) {
      // Return just the quick status for performance
      const quickStatus = await SystemHealthService.getQuickStatus(organizationId);
      return NextResponse.json(quickStatus);
    }

    // Return full health report
    const report = await SystemHealthService.generateHealthReport(organizationId);

    return NextResponse.json(report);
  } catch (error) {
    console.error('System health fetch error:', error);
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
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const specialistStatus = await SystemHealthService.getSpecialistStatus(organizationId);

    return NextResponse.json({
      specialists: specialistStatus,
      availableCount: specialistStatus.filter(s => s.available).length,
      connectedCount: specialistStatus.filter(s => s.connected).length,
      totalCount: specialistStatus.length,
    });
  } catch (error) {
    console.error('Specialist status fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch specialist status' },
      { status: 500 }
    );
  }
}
