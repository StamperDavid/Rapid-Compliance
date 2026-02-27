/**
 * Business Profile API
 *
 * GET — Returns current business profile (or null)
 * PUT — Saves business profile (admin auth required, Zod validated)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { handleAPIError } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { getBusinessProfile, saveBusinessProfile } from '@/lib/services/feature-service';
import { businessProfileSchema } from '@/lib/validation/feature-schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const profile = await getBusinessProfile();

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: unknown) {
    logger.error(
      'Business profile load error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/features/business-profile' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parsed = businessProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid business profile', issues: parsed.error.issues } },
        { status: 400 },
      );
    }

    const profile = {
      ...parsed.data,
      completedAt: new Date().toISOString(),
    };

    await saveBusinessProfile(profile);

    logger.info('Business profile saved', { route: '/api/features/business-profile' });

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: unknown) {
    logger.error(
      'Business profile save error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/features/business-profile' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
