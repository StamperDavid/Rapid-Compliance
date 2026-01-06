/**
 * API Route: Generate Battlecard
 * 
 * POST /api/battlecard/generate
 * 
 * Generate a competitive battlecard comparing our product vs. competitor
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { discoverCompetitor, generateBattlecard, type BattlecardOptions } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { competitorDomain, organizationId, options } = body;

    if (!competitorDomain || !organizationId || !options) {
      return NextResponse.json(
        { error: 'Missing required fields: competitorDomain, organizationId, options' },
        { status: 400 }
      );
    }

    logger.info('API: Generate battlecard request', {
      competitorDomain,
      organizationId,
      ourProduct: options.ourProduct,
    });

    // Step 1: Discover competitor (uses cache if available)
    const competitorProfile = await discoverCompetitor(competitorDomain, organizationId);

    // Step 2: Generate battlecard
    const battlecard = await generateBattlecard(competitorProfile, options as BattlecardOptions);

    return NextResponse.json({
      success: true,
      battlecard,
      competitorProfile,
    });
  } catch (error) {
    logger.error('API: Failed to generate battlecard', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
