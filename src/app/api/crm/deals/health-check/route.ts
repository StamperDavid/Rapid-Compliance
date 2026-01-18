/**
 * Deal Health Check API
 *
 * POST /api/crm/deals/health-check
 *
 * Runs batch health check on all active deals.
 * Calculates health scores and generates recommendations for at-risk deals.
 * Part of the CRM "Living Ledger" automated monitoring.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { runDealHealthCheck } from '@/lib/crm/deal-monitor';
import { logger } from '@/lib/logger/logger';

/** Request body interface for health check */
interface HealthCheckRequestBody {
  organizationId?: string;
  workspaceId?: string;
}

/** Parse and validate body with fallback to empty object */
function parseBody(rawBody: unknown): HealthCheckRequestBody {
  if (typeof rawBody !== 'object' || rawBody === null) {
    return {};
  }
  const b = rawBody as Record<string, unknown>;
  return {
    organizationId: typeof b.organizationId === 'string' ? b.organizationId : undefined,
    workspaceId: typeof b.workspaceId === 'string' ? b.workspaceId : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get orgId and workspaceId from headers or body
    const rawBody = await request.json().catch(() => ({})) as unknown;
    const body = parseBody(rawBody);
    const orgIdFromHeader = request.headers.get('x-organization-id');
    const organizationId = (body.organizationId !== '' && body.organizationId != null) ? body.organizationId
      : (orgIdFromHeader !== '' && orgIdFromHeader != null) ? orgIdFromHeader
      : 'default-org';

    const wsIdFromHeader = request.headers.get('x-workspace-id');
    const workspaceId = (body.workspaceId !== '' && body.workspaceId != null) ? body.workspaceId
      : (wsIdFromHeader !== '' && wsIdFromHeader != null) ? wsIdFromHeader
      : 'default';

    logger.info('Running deal health check', {
      organizationId,
      workspaceId,
    });

    // Run health check
    const summary = await runDealHealthCheck(organizationId, workspaceId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Failed to run health check', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Failed to run health check';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
