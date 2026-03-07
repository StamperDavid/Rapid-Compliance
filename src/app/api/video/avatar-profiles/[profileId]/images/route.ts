/**
 * POST /api/video/avatar-profiles/[profileId]/images — Add a reference image to a profile
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { addReferenceImage } from '@/lib/video/avatar-profile-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schema
// ============================================================================

const AddImageSchema = z.object({
  imageUrl: z.string().url(),
  type: z.enum(['frontal', 'additional', 'fullBody', 'upperBody']),
});

// ============================================================================
// POST — Add reference image
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { profileId } = await params;

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();
    const parseResult = AddImageSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid add image request', {
        file: 'api/video/avatar-profiles/[profileId]/images/route.ts',
        profileId,
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

    const { imageUrl, type } = parseResult.data;

    logger.info('Adding reference image to avatar profile', {
      file: 'api/video/avatar-profiles/[profileId]/images/route.ts',
      profileId,
      type,
    });

    const result = await addReferenceImage(profileId, imageUrl, type);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to add image' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to add reference image',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/[profileId]/images/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to add reference image' },
      { status: 500 }
    );
  }
}
