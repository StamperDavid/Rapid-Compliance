/**
 * Video Decomposition API
 * POST /api/video/decompose - Generate AI-driven scene breakdown from video description
 *
 * Delegates to the shared script-generation-service for AI-powered writing.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateVideoScripts, type ScriptVideoType } from '@/lib/video/script-generation-service';

export const dynamic = 'force-dynamic';

const VideoTypeValues = ['tutorial', 'explainer', 'product-demo', 'sales-pitch', 'testimonial', 'social-ad'] as const;
const PlatformValues = ['youtube', 'tiktok', 'instagram', 'linkedin', 'website'] as const;
const ToneValues = ['conversational', 'professional', 'energetic', 'empathetic'] as const;

const DecomposeSchema = z.object({
  description: z.string().min(1, 'Video description required'),
  videoType: z.enum(VideoTypeValues),
  platform: z.enum(PlatformValues),
  duration: z.number().min(10).max(600).default(60),
  targetAudience: z.string().optional(),
  painPoints: z.string().optional(),
  talkingPoints: z.string().optional(),
  tone: z.enum(ToneValues).optional(),
  callToAction: z.string().optional(),
  vibe: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parseResult = DecomposeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { description, videoType, platform, duration,
            targetAudience, painPoints, talkingPoints, tone, callToAction, vibe } = parseResult.data;

    logger.info('Video Decompose API: Generating scene breakdown', {
      videoType,
      platform,
      duration,
      vibe,
    });

    // Load default avatar profile for AI script context
    let avatarContext: Parameters<typeof generateVideoScripts>[0]['avatar'];
    try {
      const { getDefaultProfile } = await import('@/lib/video/avatar-profile-service');
      const profile = await getDefaultProfile(authResult.user.uid);
      if (profile) {
        avatarContext = {
          name: profile.name,
          description: profile.description,
          hasReferenceImages: profile.additionalImageUrls.length > 0,
          hasFullBodyImage: Boolean(profile.fullBodyImageUrl),
          voiceProvider: profile.voiceProvider,
          voiceName: null,
        };
      }
    } catch {
      // No profile — AI will generate without avatar context
    }

    const plan = await generateVideoScripts({
      description,
      videoType: videoType as ScriptVideoType,
      platform,
      duration,
      targetAudience,
      painPoints,
      talkingPoints,
      tone,
      callToAction,
      vibe,
      avatar: avatarContext,
    });

    return NextResponse.json({
      success: true,
      plan,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video decompose API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
