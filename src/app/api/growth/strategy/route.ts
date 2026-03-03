/**
 * GET/POST /api/growth/strategy
 *
 * Get the latest strategy or generate a new one.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getStrategyGeneratorService } from '@/lib/growth/strategy-generator';
import { GenerateStrategySchema } from '@/lib/growth/growth-validation';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const service = getStrategyGeneratorService();
    const strategy = await service.getLatestStrategy();

    return NextResponse.json({ success: true, data: strategy });
  } catch (err) {
    logger.error('Growth strategy get error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to get strategy', err instanceof Error ? err : undefined);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const body: unknown = await request.json();
    const parsed = GenerateStrategySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const service = getStrategyGeneratorService();
    const strategy = await service.generateStrategy(
      {
        maxMonthlyBudget: parsed.data.maxMonthlyBudget,
        minMonthlyBudget: parsed.data.minMonthlyBudget,
        preferredChannels: parsed.data.preferredChannels,
        primaryGoal: parsed.data.primaryGoal,
        industry: parsed.data.industry,
      },
      authResult.user.uid
    );

    return NextResponse.json({ success: true, data: strategy }, { status: 201 });
  } catch (err) {
    logger.error('Growth strategy generate error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to generate strategy', err instanceof Error ? err : undefined);
  }
}
