/**
 * GET/POST /api/growth/ai-visibility
 *
 * Get AI visibility check history or run a new check.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getAISearchMonitorService } from '@/lib/growth/ai-search-monitor';
import { RunVisibilityCheckSchema } from '@/lib/growth/growth-validation';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    const service = getAISearchMonitorService();
    const history = await service.getHistory(Math.min(limit, 50));

    return NextResponse.json({ success: true, data: history });
  } catch (err) {
    logger.error('Growth AI visibility list error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to list AI visibility checks', err instanceof Error ? err : undefined);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const body: unknown = await request.json();
    const parsed = RunVisibilityCheckSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const service = getAISearchMonitorService();
    const check = await service.runVisibilityCheck(
      parsed.data.queries,
      parsed.data.targetDomain,
      authResult.user.uid
    );

    return NextResponse.json({ success: true, data: check }, { status: 201 });
  } catch (err) {
    logger.error('Growth AI visibility check error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to run AI visibility check', err instanceof Error ? err : undefined);
  }
}
