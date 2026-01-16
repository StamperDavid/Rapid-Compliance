/**
 * TTS Voice Engine API
 * POST /api/voice/tts - Synthesize text to speech
 * GET /api/voice/tts - Get available voices and provider info
 */

import { type NextRequest, NextResponse } from 'next/server';
import { VoiceEngineFactory, type TTSEngineType, type TTSSynthesizeRequest } from '@/lib/voice/tts';

interface TTSPostBody {
  text?: string;
  organizationId?: string;
  engine?: TTSEngineType;
  voiceId?: string;
  settings?: Record<string, unknown>;
  action?: 'validate-key' | 'save-config';
  apiKey?: string;
  config?: Record<string, unknown>;
  userId?: string;
}

/**
 * GET /api/voice/tts
 * Get available voices and provider info
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('orgId');
    const engine = searchParams.get('engine') as TTSEngineType | null;
    const action = searchParams.get('action');

    // Get all provider info
    if (action === 'providers') {
      const providers = VoiceEngineFactory.getAllProviderInfo();
      return NextResponse.json({ success: true, providers });
    }

    // Get org config
    if (action === 'config' && orgId) {
      const config = await VoiceEngineFactory.getOrgConfig(orgId);
      return NextResponse.json({ success: true, config });
    }

    // Get cost comparison
    if (action === 'costs') {
      const textLength = parseInt(searchParams.get('textLength') ?? '1000');
      const costs = VoiceEngineFactory.getCostComparison(textLength);
      return NextResponse.json({ success: true, costs });
    }

    // Get voices for an engine
    if (orgId) {
      const voices = await VoiceEngineFactory.listVoices(orgId, engine ?? undefined);
      return NextResponse.json({ success: true, voices, engine: engine ?? 'native' });
    }

    return NextResponse.json({
      success: true,
      providers: VoiceEngineFactory.getAllProviderInfo(),
      defaultEngine: 'native',
    });
  } catch (error) {
    console.error('TTS GET error:', error);
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
    const body = await request.json() as TTSPostBody;
    const { text, organizationId, engine, voiceId, settings, action, apiKey, config, userId } = body;

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
      if (!organizationId || !config || !userId) {
        return NextResponse.json(
          { success: false, error: 'organizationId, config, and userId are required' },
          { status: 400 }
        );
      }
      await VoiceEngineFactory.saveOrgConfig(organizationId, config, userId);
      return NextResponse.json({ success: true });
    }

    // Synthesize text
    if (!text || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'text and organizationId are required' },
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
      organizationId,
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
    console.error('TTS POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to synthesize audio'
      },
      { status: 500 }
    );
  }
}
