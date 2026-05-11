/**
 * Nurture Campaigns API
 *
 * GET /api/nurture/campaigns — list nurture campaigns (up to 50)
 *
 * Server-side wrapper around `getNurtureCampaigns` so the dashboard page
 * doesn't import the lib service directly. The lib service uses Admin SDK,
 * which is server-only — a direct import from a `'use client'` page would
 * leak firebase-admin into the client bundle and fail the build.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getNurtureCampaigns } from '@/lib/outbound/nurture-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const result = await getNurtureCampaigns(undefined, { pageSize: 50 });
    return NextResponse.json({ campaigns: result.data, hasMore: result.hasMore });
  } catch (error) {
    logger.error(
      'Failed to load nurture campaigns',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'nurture/campaigns/route.ts' },
    );
    return NextResponse.json({ error: 'Failed to load nurture campaigns' }, { status: 500 });
  }
}
