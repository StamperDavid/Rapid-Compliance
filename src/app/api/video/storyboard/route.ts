/**
 * Video Storyboard Generation API
 * POST /api/video/storyboard - Generate storyboard from brief using Director Service
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateStoryboard } from '@/lib/video/engine/director-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import type { DirectorRequest } from '@/lib/video/engine/types';

export const dynamic = 'force-dynamic';

const ObjectiveValues = ['awareness', 'consideration', 'conversion', 'retention'] as const;
const PlatformValues = ['youtube', 'tiktok', 'instagram', 'linkedin', 'website'] as const;
const AspectRatioValues = ['16:9', '9:16', '1:1', '4:3'] as const;
const ResolutionValues = ['1080p', '720p', '4k'] as const;
const PacingValues = ['slow', 'medium', 'fast', 'dynamic'] as const;

const BriefSchema = z.object({
  objective: z.enum(ObjectiveValues).optional(),
  message: z.string().min(1, 'Video message required'),
  callToAction: z.string().optional(),
  targetPlatform: z.enum(PlatformValues).optional(),
});

const ConstraintsSchema = z.object({
  maxDuration: z.number().optional(),
  aspectRatio: z.enum(AspectRatioValues).optional(),
  resolution: z.enum(ResolutionValues).optional(),
}).optional();

const CreativeDirectionSchema = z.object({
  mood: z.string(),
  pacing: z.enum(PacingValues),
  visualStyle: z.string(),
  referenceVideos: z.array(z.string()).optional(),
}).optional();

const StoryboardRequestSchema = z.object({
  brief: BriefSchema,
  constraints: ConstraintsSchema,
  creativeDirection: CreativeDirectionSchema,
  voiceoverScript: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();

    const parseResult = StoryboardRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { brief, constraints, creativeDirection, voiceoverScript } = parseResult.data;

    // Build Brand DNA snapshot from org settings (simplified for now)
    const brandDNA = {
      companyDescription: 'AI-powered sales platform',
      uniqueValue: 'Autonomous AI workforce that handles sales tasks 24/7',
      targetAudience: 'B2B sales teams and marketing professionals',
      toneOfVoice: creativeDirection?.mood ?? 'professional',
      communicationStyle: 'direct',
      primaryColor: '#6366f1',
      secondaryColor: '#f59e0b',
      keyPhrases: ['AI-powered', 'autonomous', 'scale', 'transform'],
      avoidPhrases: ['cheap', 'basic', 'simple'],
      industry: 'technology',
    };

    // Build Director Request
    const directorRequest: DirectorRequest = {
      brief: {
        objective: brief.objective ?? 'awareness',
        message: brief.message,
        callToAction: brief.callToAction,
        targetPlatform: brief.targetPlatform ?? 'youtube',
      },
      constraints: {
        maxDuration: constraints?.maxDuration ?? 60,
        aspectRatio: constraints?.aspectRatio ?? '16:9',
        resolution: constraints?.resolution ?? '1080p',
      },
      voiceoverScript: voiceoverScript ?? brief.message,
      brandDNA,
      creativeDirection: creativeDirection ? {
        mood: creativeDirection.mood,
        pacing: creativeDirection.pacing,
        visualStyle: creativeDirection.visualStyle,
      } : undefined,
    };

    logger.info('Video API: Generating storyboard', {
      platform: brief.targetPlatform,
      duration: constraints?.maxDuration,
    });

    // Call Director Service
    const response = generateStoryboard(directorRequest);

    // Transform response for frontend
    const storyboard = {
      id: response.storyboard.id,
      title: response.storyboard.title,
      scenes: response.storyboard.scenes.map((scene) => ({
        id: scene.id,
        name: scene.name,
        description: scene.description ?? '',
        duration: scene.duration,
        shotType: scene.shots[0]?.shotType ?? 'medium',
        cameraMotion: scene.shots[0]?.cameraMotion ?? 'static',
      })),
      totalDuration: response.storyboard.totalDuration,
      estimatedCost: response.estimatedCost,
      warnings: response.warnings,
      suggestions: response.suggestions,
    };

    return NextResponse.json({
      success: true,
      storyboard,
      estimatedDuration: response.estimatedDuration,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video storyboard API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
