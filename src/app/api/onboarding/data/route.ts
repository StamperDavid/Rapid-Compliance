/**
 * Onboarding Data API Route
 *
 * Returns the stored onboarding data from Firestore so the dashboard
 * wizard can pre-fill fields from the initial 4-step signup flow.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');

    const onboardingData = await AdminFirestoreService.get(
      getSubCollection('onboarding'),
      'current'
    ).catch(() => null);

    if (!onboardingData) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: onboardingData });
  } catch (error) {
    logger.error(
      'Error fetching onboarding data',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/onboarding/data' }
    );
    return NextResponse.json(
      { error: 'Failed to fetch onboarding data' },
      { status: 500 }
    );
  }
}
