/**
 * TTS Voice Engine API
 * POST /api/voice/tts - Synthesize text to speech
 * GET /api/voice/tts - Get available voices and provider info
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { VoiceEngineFactory, type TTSEngineType, type TTSSynthesizeRequest } from '@/lib/voice/tts';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const ttsEngineSchema = z.enum(['elevenlabs', 'unreal'] as const);

const ttsPostBodySchema = z.object({
  text: z.string().max(5000).optional(),
  PLATFORM_ID: z.string().optional(),
  engine: ttsEngineSchema.optional(),
  voiceId: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  action: z.enum(['validate-key', 'save-config']).optional(),
  apiKey: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  userId: z.string().optional(),
});

/**
 * GET /api/voice/tts
 * Get available voices and provider info
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const searchParams = request.nextUrl.searchParams;
    const engine = searchParams.get('engine') as TTSEngineType | null;
    const action = searchParams.get('action');

    // Get all provider info
    if (action === 'providers') {
      const providers = VoiceEngineFactory.getAllProviderInfo();
      return NextResponse.json({ success: true, providers });
    }

    // Get org config
    if (action === 'config') {
      const config = await VoiceEngineFactory.getOrgConfig();
      return NextResponse.json({ success: true, config });
    }

    // Get cost comparison
    if (action === 'costs') {
      const textLength = parseInt(searchParams.get('textLength') ?? '1000');
      const costs = VoiceEngineFactory.getCostComparison(textLength);
      return NextResponse.json({ success: true, costs });
    }

    // Get voices for an engine
    const voices = await VoiceEngineFactory.listVoices(engine ?? undefined);
    return NextResponse.json({ success: true, voices, engine: engine ?? 'elevenlabs' });
  } catch (error) {
    logger.error('TTS GET error', error instanceof Error ? error : new Error(String(error)), { file: 'voice/tts/route.ts' });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch TTS data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/voice/tts
 * Synthesize text to speech
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const rawBody: unknown = await request.json();
    const parsedBody = ttsPostBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: parsedBody.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }
    const { text, engine, voiceId, settings, action, apiKey, config, userId } = parsedBody.data;

    // Validate API key
    if (action === 'validate-key') {
      if (!apiKey || !engine) {
        return NextResponse.json(
          { success: false, error: 'apiKey and engine are required' },
          { status: 400 }
        );
      }
      const isValid = await VoiceEngineFactory.validateApiKey(engine, apiKey);
      return NextResponse.json({ success: true, valid: isValid });
    }

    // Save org config
    if (action === 'save-config') {
      if (!config || !userId) {
        return NextResponse.json(
          { success: false, error: 'config and userId are required' },
          { status: 400 }
        );
      }
      await VoiceEngineFactory.saveOrgConfig(config, userId);
      return NextResponse.json({ success: true });
    }

    // Synthesize text
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'text is required' },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    if (text.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Text too long. Maximum 5000 characters.' },
        { status: 400 }
      );
    }

    const synthesizeRequest: TTSSynthesizeRequest = {
      text,
      engine,
      voiceId,
      settings,
    };

    const result = await VoiceEngineFactory.getAudio(synthesizeRequest);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('TTS POST error', error instanceof Error ? error : new Error(String(error)), { file: 'voice/tts/route.ts' });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to synthesize audio'
      },
      { status: 500 }
    );
  }
}
