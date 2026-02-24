/**
 * GET /api/reputation/brief
 *
 * Returns a ReputationBrief from the ReputationManager agent.
 * Auth-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { getReputationManager } from '@/lib/agents/trust/reputation/manager';
import { logger } from '@/lib/logger/logger';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const manager = getReputationManager();
    await manager.initialize();

    const taskId = `reputation-brief-${Date.now()}`;
    const report = await manager.execute({
      id: taskId,
      timestamp: new Date(),
      from: 'api',
      to: 'REPUTATION_MANAGER',
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: {
        action: 'GENERATE_BRIEF',
      },
      requiresResponse: true,
      traceId: taskId,
    });

    if (report.status !== 'COMPLETED' || !report.data) {
      const errorMsg = report.errors?.[0] ?? 'Reputation brief generation failed';
      logger.warn('Reputation brief returned non-success', { status: report.status });
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report.data,
    });
  } catch (err) {
    logger.error('Reputation brief endpoint error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to generate reputation brief',
      err instanceof Error ? err : undefined
    );
  }
}
