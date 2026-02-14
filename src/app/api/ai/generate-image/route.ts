/**
 * POST /api/ai/generate-image
 * Generate images using DALL-E 3
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { generateImage } from '@/lib/ai/image-generation-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(4000),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
  quality: z.enum(['standard', 'hd']).optional(),
  style: z.enum(['vivid', 'natural']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ai/generate-image');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Validation
    const body: unknown = await request.json();
    const parseResult = generateImageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { prompt, size, quality, style } = parseResult.data;

    const result = await generateImage(prompt, { size, quality, style });

    return NextResponse.json({
      success: true,
      imageUrl: result.url,
      revisedPrompt: result.revisedPrompt,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Image generation API failed', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/ai/generate-image',
    });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
