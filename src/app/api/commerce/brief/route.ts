/**
 * GET /api/commerce/brief
 *
 * Returns a CommerceBrief from the CommerceManager agent.
 * Auth-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { getCommerceManager } from '@/lib/agents/commerce/manager';
import { logger } from '@/lib/logger/logger';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const manager = getCommerceManager();
    await manager.initialize();

    const taskId = `commerce-brief-${Date.now()}`;
    const report = await manager.generateRevenueBrief(taskId, null, Date.now());

    if (report.status !== 'COMPLETED' || !report.data) {
      const errorMsg = report.errors?.[0] ?? 'Commerce brief generation failed';
      logger.warn('Commerce brief returned non-success', { status: report.status });
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
    logger.error('Commerce brief endpoint error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to generate commerce brief',
      err instanceof Error ? err : undefined
    );
  }
}
