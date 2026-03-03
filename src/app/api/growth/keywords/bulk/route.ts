/**
 * POST /api/growth/keywords/bulk
 *
 * Bulk add keywords for tracking.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getKeywordTrackerService } from '@/lib/growth/keyword-tracker';
import { BulkAddKeywordsSchema } from '@/lib/growth/growth-validation';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const body: unknown = await request.json();
    const parsed = BulkAddKeywordsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const service = getKeywordTrackerService();
    const result = await service.bulkAddKeywords(
      parsed.data.keywords,
      authResult.user.uid
    );

    return NextResponse.json({
      success: true,
      data: {
        added: result.added.length,
        errors: result.errors,
        keywords: result.added,
      },
    }, { status: 201 });
  } catch (err) {
    logger.error('Growth keyword bulk add error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to bulk add keywords', err instanceof Error ? err : undefined);
  }
}
