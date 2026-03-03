/**
 * POST /api/growth/strategy/reject
 *
 * Reject a growth strategy with a reason.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getStrategyGeneratorService } from '@/lib/growth/strategy-generator';
import { RejectStrategySchema } from '@/lib/growth/growth-validation';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const body: unknown = await request.json();
    const parsed = RejectStrategySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const service = getStrategyGeneratorService();
    const strategy = await service.rejectStrategy(
      parsed.data.strategyId,
      parsed.data.reason,
      authResult.user.uid
    );

    return NextResponse.json({ success: true, data: strategy });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return errors.notFound(message);
    }
    logger.error('Growth strategy reject error', err instanceof Error ? err : new Error(message));
    return errors.internal('Failed to reject strategy', err instanceof Error ? err : undefined);
  }
}
