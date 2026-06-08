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
import {
  buildStoryboardFromBrief,
  type AssistantStoryboard,
  type BuildStoryboardInput,
} from '@/lib/video/storyboard-build-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/video/decompose/route.ts';

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

// ────────────────────────────────────────────────────────────────────────────
// Mapping from decompose's brief onto the Video Specialist's input contract.
// ────────────────────────────────────────────────────────────────────────────

type DecomposePlatform = (typeof PlatformValues)[number];
type DecomposeVideoType = (typeof VideoTypeValues)[number];

/** decompose platform enum → Video Specialist platform enum. */
function mapPlatform(platform: DecomposePlatform): BuildStoryboardInput['platform'] {
  switch (platform) {
    case 'instagram':
      return 'instagram_reels';
    case 'website':
      return 'generic';
    default:
      return platform;
  }
}

/** decompose has no style field — derive one from the video type. */
function deriveStyle(videoType: DecomposeVideoType): BuildStoryboardInput['style'] {
  switch (videoType) {
    case 'sales-pitch':
    case 'social-ad':
      return 'energetic';
    case 'testimonial':
      return 'documentary';
    default:
      return 'cinematic';
  }
}

/** Compose decompose's brief fields into one rich brief string for the specialist. */
function composeBrief(input: {
  description: string;
  painPoints?: string;
  talkingPoints?: string;
  vibe?: string;
}): string {
  const parts = [input.description.trim()];
  if (input.painPoints?.trim()) {
    parts.push(`Pain points to address: ${input.painPoints.trim()}`);
  }
  if (input.talkingPoints?.trim()) {
    parts.push(`Key talking points: ${input.talkingPoints.trim()}`);
  }
  if (input.vibe?.trim()) {
    parts.push(`Visual vibe/theme: ${input.vibe.trim()}`);
  }
  return parts.join('\n\n');
}

/** The Video Specialist caps targetDuration at 15–150s; clamp decompose's wider range. */
function clampDuration(duration: number): number {
  return Math.max(15, Math.min(150, Math.round(duration)));
}

/** Adapt the mapped storyboards into the exact response shape the frontend expects. */
function toDecomposePlan(storyboards: AssistantStoryboard[]): {
  scenes: Array<{
    sceneNumber: number;
    title: string;
    scriptText: string;
    visualDescription: string;
    suggestedDuration: number;
    engine: 'hedra';
    backgroundPrompt: string | null;
    location?: string;
    timeOfDay?: string;
    weather?: string;
    wardrobe?: string;
    ambience?: string;
    musicCue?: string;
    cinematicConfig?: AssistantStoryboard['cinematicConfig'];
  }>;
} {
  return {
    scenes: storyboards.map((sb, i) => ({
      sceneNumber: i + 1,
      title: sb.title,
      scriptText: sb.scriptText,
      visualDescription: sb.visualDescription,
      suggestedDuration: sb.duration,
      engine: 'hedra' as const,
      backgroundPrompt: sb.backgroundPrompt ?? null,
      location: sb.location,
      timeOfDay: sb.timeOfDay,
      weather: sb.weather,
      wardrobe: sb.wardrobe,
      ambience: sb.ambience,
      musicCue: sb.musicCue,
      cinematicConfig: sb.cinematicConfig,
    })),
  };
}

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

    // PRIMARY: route the build through the ONE governed agent (Video Specialist),
    // exactly like the Content Assistant chat path. This collapses the old duplicate
    // non-agent code path into the same GM-governed, Brand-DNA-baked specialist.
    try {
      const built = await buildStoryboardFromBrief({
        brief: composeBrief({ description, painPoints, talkingPoints, vibe }),
        platform: mapPlatform(platform),
        style: deriveStyle(videoType),
        targetDuration: clampDuration(duration),
        ...(targetAudience ? { targetAudience } : {}),
        ...(callToAction ? { callToAction } : {}),
        ...(tone ? { tone } : {}),
      });

      if (!('error' in built)) {
        return NextResponse.json({
          success: true,
          plan: toDecomposePlan(built.storyboards),
        });
      }

      logger.warn('Video decompose: Video Specialist returned an error — falling back to script generator', {
        file: FILE,
        error: built.error,
      });
    } catch (specialistError) {
      logger.warn('Video decompose: Video Specialist threw — falling back to script generator', {
        file: FILE,
        error: specialistError instanceof Error ? specialistError.message : String(specialistError),
      });
    }

    // FALLBACK ONLY: the legacy script generator keeps the button from ever hard-failing.
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
