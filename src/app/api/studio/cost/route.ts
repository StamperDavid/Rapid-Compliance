/**
 * Creative Studio — Cost Dashboard
 * GET /api/studio/cost — Cost summary with filtering
 *
 * Returns aggregated cost data for the studio: total spend,
 * breakdowns by provider, type, and campaign. Supports date range
 * and provider/type filters via query params.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getCostSummary } from '@/lib/ai/cost-tracker';
import { CostQuerySchema } from '@/types/creative-studio';
import { logger } from '@/lib/logger/logger';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // 2. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const rawQuery: Record<string, string> = {};
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const provider = searchParams.get('provider');
    const type = searchParams.get('type');

    if (start) { rawQuery.start = start; }
    if (end) { rawQuery.end = end; }
    if (provider) { rawQuery.provider = provider; }
    if (type) { rawQuery.type = type; }

    const validated = CostQuerySchema.parse(rawQuery);

    // 3. Fetch cost summary
    const summary = await getCostSummary({
      start: validated.start,
      end: validated.end,
      provider: validated.provider,
      type: validated.type,
    });

    logger.info('Studio cost: fetched summary', {
      totalCost: summary.totalCost,
      generationCount: summary.generationCount,
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Studio cost: unexpected error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
