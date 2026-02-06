/**
 * API Route: Generate Battlecard
 * 
 * POST /api/battlecard/generate
 * 
 * Generate a competitive battlecard comparing our product vs. competitor
 */

import { type NextRequest, NextResponse } from 'next/server';
import { discoverCompetitor, generateBattlecard, type BattlecardOptions } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';

/** Request body interface for battlecard generation */
interface GenerateBattlecardRequestBody {
  competitorDomain: string;
  organizationId: string;
  options: BattlecardOptions;
}

/** Type guard for validating request body */
function isValidRequestBody(body: unknown): body is GenerateBattlecardRequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return (
    typeof b.competitorDomain === 'string' &&
    typeof b.organizationId === 'string' &&
    typeof b.options === 'object' && b.options !== null
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!isValidRequestBody(body)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: competitorDomain, organizationId, options' },
        { status: 400 }
      );
    }

    const { competitorDomain, organizationId, options } = body;

    logger.info('API: Generate battlecard request', {
      competitorDomain,
      organizationId,
      ourProduct: options.ourProduct,
    });

    // Step 1: Discover competitor (uses cache if available)
    const competitorProfile = await discoverCompetitor(competitorDomain);

    // Step 2: Generate battlecard
    const battlecard = await generateBattlecard(competitorProfile, options);

    return NextResponse.json({
      success: true,
      battlecard,
      competitorProfile,
    });
  } catch (error) {
    logger.error('API: Failed to generate battlecard', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
