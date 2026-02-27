/**
 * API Route: Social Media Upload
 *
 * POST /api/social/media/upload → Upload a media file (multipart form data)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { SocialMediaService } from '@/lib/social/media-service';
import type { SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

// FormData fields (strings) are validated individually via Zod
const SocialPlatformEnum = z.enum(['twitter', 'linkedin']);

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/media/upload');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const formData = await request.formData();
    const file = formData.get('file');
    const platformRaw = formData.get('platform');
    const postId = formData.get('postId') as string | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate platform using Zod enum when present
    let platform: SocialPlatform | undefined;
    if (platformRaw !== null) {
      const platformParsed = SocialPlatformEnum.safeParse(platformRaw);
      if (!platformParsed.success) {
        return NextResponse.json(
          { success: false, error: `Invalid platform. Must be one of: ${SocialPlatformEnum.options.join(', ')}` },
          { status: 400 }
        );
      }
      platform = platformParsed.data;
    }

    // Convert Blob to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract file name — formData File objects have a name property
    const fileName = 'name' in file ? (file).name : `upload-${Date.now()}`;
    const mimeType = file.type || 'application/octet-stream';

    const asset = await SocialMediaService.upload(buffer, fileName, mimeType, {
      platform,
      postId: postId ?? undefined,
    });

    logger.info('Media Upload API: File uploaded', { assetId: asset.id, fileName });

    return NextResponse.json({ success: true, asset });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    logger.error('Media Upload API: Failed', error instanceof Error ? error : new Error(message));

    // Validation errors return 400, others 500
    const isValidation = message.includes('exceeds') || message.includes('does not support') || message.includes('Unsupported');
    return NextResponse.json(
      { success: false, error: message },
      { status: isValidation ? 400 : 500 }
    );
  }
}
