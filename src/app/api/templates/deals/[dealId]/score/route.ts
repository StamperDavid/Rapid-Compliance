/**
 * Deal Scoring API
 * POST /api/templates/deals/[dealId]/score - Calculate predictive deal score
 */

import { type NextRequest, NextResponse } from 'next/server';
import { calculateDealScore } from '@/lib/templates';
import { ScoreDealSchema, validateRequestBody } from '@/lib/templates/validation';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/deals/[dealId]/score
 * Calculate predictive deal score
 *
 * Body:
 * {
 *   organizationId: string;
 *   workspaceId: string;
 *   templateId?: string;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  // Rate limiting: 20 requests per minute (AI operation)
  const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.AI_OPERATIONS);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { dealId } = await params;
    const body: unknown = await request.json();

    // Validate request body with Zod schema (merge dealId from route params)
    const bodyWithDealId = typeof body === 'object' && body !== null
      ? { ...body, dealId }
      : { dealId };
    const validation = validateRequestBody(ScoreDealSchema, bodyWithDealId);
    
    if (validation.success === false) {
      const { error, details } = validation;
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        message: error,
        details: details?.errors
      }, { status: 400 });
    }
    
    const { organizationId, workspaceId, templateId } = validation.data;
    
    logger.info('Calculating deal score', {
      orgId: organizationId,
      dealId,
      templateId
    });
    
    const score = await calculateDealScore({
      organizationId,
      workspaceId,
      dealId,
      templateId
    });
    
    return NextResponse.json({
      success: true,
      score
    });
    
  } catch (error) {
    logger.error('Failed to calculate deal score', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json({
      success: false,
      error: 'Failed to calculate deal score',
      message: (error as Error).message
    }, { status: 500 });
  }
}
