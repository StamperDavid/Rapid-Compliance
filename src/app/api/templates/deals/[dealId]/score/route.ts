/**
 * Deal Scoring API
 * POST /api/templates/deals/[dealId]/score - Calculate predictive deal score
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateDealScore } from '@/lib/templates';
import { logger } from '@/lib/logger/logger';

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
  { params }: { params: { dealId: string } }
) {
  try {
    const dealId = params.dealId;
    const body = await request.json();
    const { organizationId, workspaceId, templateId } = body;
    
    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'Missing organizationId'
      }, { status: 400 });
    }
    
    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Missing workspaceId'
      }, { status: 400 });
    }
    
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
    logger.error('Failed to calculate deal score', error as Error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to calculate deal score',
      message: (error as Error).message
    }, { status: 500 });
  }
}
