/**
 * API Route: Discover Competitor
 * 
 * POST /api/battlecard/competitor/discover
 * 
 * Discover and profile a competitor from their domain
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoverCompetitor } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, organizationId } = body;

    if (!domain || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: domain, organizationId' },
        { status: 400 }
      );
    }

    logger.info('API: Discover competitor request', {
      domain,
      organizationId,
    });

    const profile = await discoverCompetitor(domain, organizationId);

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    logger.error('API: Failed to discover competitor', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
