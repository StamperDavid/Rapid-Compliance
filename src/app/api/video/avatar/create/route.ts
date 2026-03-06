/**
 * Custom Avatar Creation API
 * POST /api/video/avatar/create
 *
 * Creates a HeyGen Photo Avatar from a previously uploaded photo.
 * Reads the photo base64 from Firestore and uploads directly to HeyGen,
 * avoiding localhost URL issues.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { createInstantAvatar } from '@/lib/video/video-service';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const CreateAvatarSchema = z.object({
  photoUrl: z.string().min(1, 'Photo URL required'),
  avatarName: z.string().min(1, 'Avatar name required').max(100),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = CreateAvatarSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const { photoUrl, avatarName } = parseResult.data;

    logger.info('Creating custom avatar', {
      avatarName,
      photoUrl: photoUrl.slice(0, 60),
      file: 'avatar/create/route.ts',
    });

    // Check if the URL points to our internal photo endpoint — extract photoId and read base64
    const photoIdMatch = photoUrl.match(/\/api\/video\/avatar\/photo\/([^/]+)$/);

    if (photoIdMatch?.[1] && adminDb) {
      // Read the base64 directly from Firestore — avoids HeyGen needing to download from our URL
      const photoDoc = await adminDb
        .collection(`organizations/${PLATFORM_ID}/avatar_photos`)
        .doc(photoIdMatch[1])
        .get();

      if (photoDoc.exists) {
        const photoData = photoDoc.data();
        if (photoData?.base64 && photoData?.contentType) {
          logger.info('Sending avatar photo data directly to HeyGen (base64)', {
            file: 'avatar/create/route.ts',
          });

          const result = await createInstantAvatar(
            { base64: photoData.base64 as string, contentType: photoData.contentType as string },
            avatarName,
          );

          return NextResponse.json({
            success: true,
            avatarId: result.avatarId,
            status: result.status,
          });
        }
      }
    }

    // Fallback: if it's an external URL, download and forward to HeyGen
    const result = await createInstantAvatar({ url: photoUrl }, avatarName);

    return NextResponse.json({
      success: true,
      avatarId: result.avatarId,
      status: result.status,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Avatar creation failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'avatar/create/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
