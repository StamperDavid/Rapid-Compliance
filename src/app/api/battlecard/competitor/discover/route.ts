/**
 * API Route: Discover Competitor
 *
 * POST /api/battlecard/competitor/discover
 *
 * Discover and profile a competitor from their domain
 */

import { NextResponse, type NextRequest } from 'next/server';
import { discoverCompetitor, type CompetitorProfile } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';

/**
 * Request body structure for competitor discovery
 */
interface DiscoverCompetitorRequest {
  domain: string;
  organizationId: string;
}

/**
 * Type guard to validate request body
 */
function isValidDiscoverRequest(body: unknown): body is DiscoverCompetitorRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    'domain' in body &&
    'organizationId' in body &&
    typeof body.domain === 'string' &&
    typeof body.organizationId === 'string'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!isValidDiscoverRequest(body)) {
      return NextResponse.json(
        { error: 'Missing required fields: domain, organizationId' },
        { status: 400 }
      );
    }

    const { domain, organizationId } = body;

    logger.info('API: Discover competitor request', {
      domain,
      organizationId,
    });

    const profile: CompetitorProfile = await discoverCompetitor(domain, organizationId);

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
