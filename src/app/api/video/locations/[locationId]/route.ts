/**
 * GET    /api/video/locations/[locationId] — Get a single location profile
 * PATCH  /api/video/locations/[locationId] — Update a location profile
 * DELETE /api/video/locations/[locationId] — Delete a location profile
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { UpdateLocationProfileSchema } from '@/types/location';
import {
  getLocationProfile,
  updateLocationProfile,
  deleteLocationProfile,
} from '@/lib/video/location-profile-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET — Get single location
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { locationId } = await params;

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      );
    }

    logger.info('Getting location profile', {
      file: 'api/video/locations/[locationId]/route.ts',
      locationId,
    });

    const profile = await getLocationProfile(locationId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    logger.error(
      'Failed to get location profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/locations/[locationId]/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to get location profile' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH — Update location
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { locationId } = await params;

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();
    const parseResult = UpdateLocationProfileSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid update location profile request', {
        file: 'api/video/locations/[locationId]/route.ts',
        locationId,
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

    logger.info('Updating location profile', {
      file: 'api/video/locations/[locationId]/route.ts',
      locationId,
    });

    const result = await updateLocationProfile(locationId, data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to update location' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to update location profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/locations/[locationId]/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to update location profile' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — Delete location
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { locationId } = await params;

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'Location ID is required' },
        { status: 400 }
      );
    }

    logger.info('Deleting location profile', {
      file: 'api/video/locations/[locationId]/route.ts',
      locationId,
    });

    const deleted = await deleteLocationProfile(locationId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete location' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to delete location profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/locations/[locationId]/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to delete location profile' },
      { status: 500 }
    );
  }
}
