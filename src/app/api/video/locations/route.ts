/**
 * GET  /api/video/locations — List location profiles for the authenticated user
 * POST /api/video/locations — Create a new location profile
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { CreateLocationProfileSchema } from '@/types/location';
import {
  createLocationProfile,
  listLocationProfiles,
} from '@/lib/video/location-profile-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET — List locations
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const userId = String(user.uid);

    // The Location Library tab passes ?scope=own so it shows ONLY the operator's
    // own created sets (no stock locations). Other set-pickers omit it and
    // still get stock locations appended.
    const ownOnly = request.nextUrl.searchParams.get('scope') === 'own';

    logger.info('Listing location profiles', {
      file: 'api/video/locations/route.ts',
      userId,
      ownOnly,
    });

    const profiles = await listLocationProfiles(userId, { ownOnly });

    return NextResponse.json({
      success: true,
      profiles,
    });
  } catch (error) {
    logger.error(
      'Failed to list location profiles',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/locations/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to list location profiles' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — Create location
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const userId = String(user.uid);

    const body: unknown = await request.json();
    const parseResult = CreateLocationProfileSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid create location profile request', {
        file: 'api/video/locations/route.ts',
        userId,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    logger.info('Creating location profile', {
      file: 'api/video/locations/route.ts',
      userId,
      name: data.name,
    });

    const result = await createLocationProfile(userId, {
      name: data.name,
      description: data.description,
      referenceImageUrls: data.referenceImageUrls,
      referenceVideoUrls: data.referenceVideoUrls,
      source: data.source,
    });

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to create location' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: result.profile,
    });
  } catch (error) {
    logger.error(
      'Failed to create location profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/locations/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to create location profile' },
      { status: 500 }
    );
  }
}
