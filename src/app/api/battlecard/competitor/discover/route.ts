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
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSeoResearchCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * Request body structure for competitor discovery
 */
interface DiscoverCompetitorRequest {
  domain: string;
}

/**
 * Type guard to validate request body
 */
function isValidDiscoverRequest(body: unknown): body is DiscoverCompetitorRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    'domain' in body &&
    typeof body.domain === 'string'
  );
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    if (!isValidDiscoverRequest(body)) {
      return NextResponse.json(
        { error: 'Missing required field: domain' },
        { status: 400 }
      );
    }

    const { domain } = body;

    logger.info('API: Discover competitor request', {
      domain,
    });

    const profile: CompetitorProfile = await discoverCompetitor(domain);

    // Fire-and-forget: persist competitor discovery to Firestore
    if (adminDb) {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
      adminDb.collection(getSeoResearchCollection()).add({
        type: 'competitor_discovery',
        domain: cleanDomain,
        data: JSON.parse(JSON.stringify(profile)) as Record<string, unknown>,
        tags: [profile.companyName, profile.industry ?? ''].filter(Boolean),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: authResult.user.uid,
      }).catch((persistErr: unknown) => {
        logger.warn('Failed to persist competitor discovery', {
          domain: cleanDomain,
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        });
      });
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    logger.error('API: Failed to discover competitor', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
