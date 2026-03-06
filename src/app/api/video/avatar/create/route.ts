/**
 * Custom Avatar Creation API
 * POST /api/video/avatar/create
 *
 * Creates a custom avatar from a previously uploaded photo.
 * Attempts HeyGen Instant Avatar creation, but always saves a local
 * record in Firestore `custom_avatars` so the avatar is visible
 * even if HeyGen's API doesn't support the plan or fails.
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

    // Extract photoId and read base64 from Firestore
    const photoIdMatch = photoUrl.match(/\/api\/video\/avatar\/photo\/([^/]+)$/);
    let photoBase64: string | null = null;
    let photoContentType: string | null = null;

    if (photoIdMatch?.[1] && adminDb) {
      const photoDoc = await adminDb
        .collection(`organizations/${PLATFORM_ID}/avatar_photos`)
        .doc(photoIdMatch[1])
        .get();

      if (photoDoc.exists) {
        const photoData = photoDoc.data();
        photoBase64 = (photoData?.base64 as string) ?? null;
        photoContentType = (photoData?.contentType as string) ?? null;
      }
    }

    // Try HeyGen avatar creation (may fail on free plan — that's OK)
    let heygenAvatarId: string | null = null;
    let heygenStatus: string = 'local_only';

    try {
      const imageInput = photoBase64 && photoContentType
        ? { base64: photoBase64, contentType: photoContentType }
        : { url: photoUrl };

      const result = await createInstantAvatar(imageInput, avatarName);
      heygenAvatarId = result.avatarId;
      heygenStatus = result.status;
    } catch (heygenErr) {
      logger.warn('HeyGen avatar creation failed — saving locally', {
        error: heygenErr instanceof Error ? heygenErr.message : String(heygenErr),
        file: 'avatar/create/route.ts',
      });
    }

    // Always save a local custom_avatars record so it shows in the picker
    const localAvatarId = heygenAvatarId ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (adminDb) {
      // Build a small thumbnail data URL from the base64
      const thumbnailDataUrl = photoBase64 && photoContentType
        ? `data:${photoContentType};base64,${photoBase64}`
        : '';

      await adminDb
        .collection(`organizations/${PLATFORM_ID}/custom_avatars`)
        .doc(localAvatarId)
        .set({
          id: localAvatarId,
          name: avatarName,
          thumbnailUrl: thumbnailDataUrl,
          isCustom: true,
          heygenAvatarId: heygenAvatarId ?? null,
          heygenStatus,
          createdAt: new Date().toISOString(),
          createdBy: typeof authResult === 'object' && 'uid' in authResult ? authResult.uid : 'system',
        });

      logger.info('Custom avatar saved to Firestore', {
        localAvatarId,
        heygenAvatarId,
        file: 'avatar/create/route.ts',
      });
    }

    return NextResponse.json({
      success: true,
      avatarId: localAvatarId,
      status: heygenStatus,
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
