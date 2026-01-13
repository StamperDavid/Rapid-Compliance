/**
 * Video Storyboard Generation API
 * POST /api/video/storyboard - Generate storyboard from brief using Director Service
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generateStoryboard } from '@/lib/video/engine/director-service';
import { logger } from '@/lib/logger/logger';
import type { DirectorRequest } from '@/lib/video/engine/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { organizationId, brief, constraints, creativeDirection, voiceoverScript } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    if (!brief?.message) {
      return NextResponse.json({ error: 'Video message required' }, { status: 400 });
    }

    // Build Brand DNA snapshot from org settings (simplified for now)
    const brandDNA = {
      companyDescription: 'AI-powered sales platform',
      uniqueValue: 'Autonomous AI workforce that handles sales tasks 24/7',
      targetAudience: 'B2B sales teams and marketing professionals',
      toneOfVoice: creativeDirection?.mood || 'professional',
      communicationStyle: 'direct',
      primaryColor: '#6366f1',
      secondaryColor: '#f59e0b',
      keyPhrases: ['AI-powered', 'autonomous', 'scale', 'transform'],
      avoidPhrases: ['cheap', 'basic', 'simple'],
      industry: 'technology',
    };

    // Build Director Request
    const directorRequest: DirectorRequest = {
      organizationId,
      brief: {
        objective: brief.objective || 'awareness',
        message: brief.message,
        callToAction: brief.callToAction,
        targetPlatform: brief.targetPlatform || 'youtube',
      },
      constraints: {
        maxDuration: constraints?.maxDuration || 60,
        aspectRatio: constraints?.aspectRatio || '16:9',
        resolution: constraints?.resolution || '1080p',
      },
      voiceoverScript: voiceoverScript || brief.message,
      brandDNA,
      creativeDirection: creativeDirection ? {
        mood: creativeDirection.mood,
        pacing: creativeDirection.pacing,
        visualStyle: creativeDirection.visualStyle,
      } : undefined,
    };

    logger.info('Video API: Generating storyboard', {
      organizationId,
      platform: brief.targetPlatform,
      duration: constraints?.maxDuration,
    });

    // Call Director Service
    const response = await generateStoryboard(directorRequest);

    // Transform response for frontend
    const storyboard = {
      id: response.storyboard.id,
      title: response.storyboard.title,
      scenes: response.storyboard.scenes.map((scene, index) => ({
        id: scene.id,
        name: scene.name,
        description: scene.description || '',
        duration: scene.duration,
        shotType: scene.shots[0]?.shotType || 'medium',
        cameraMotion: scene.shots[0]?.cameraMotion || 'static',
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
    logger.error('Video storyboard API failed', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
