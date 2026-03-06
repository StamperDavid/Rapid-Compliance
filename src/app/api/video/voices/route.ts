import { type NextRequest, NextResponse } from 'next/server';
import { listHeyGenVoices } from '@/lib/video/video-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { HeyGenVoice } from '@/types/video';

export const dynamic = 'force-dynamic';

/**
 * Fetch ElevenLabs voices if API key is configured.
 * Returns voices with preview URLs that actually work (unlike some HeyGen previews).
 */
async function fetchElevenLabsVoices(): Promise<HeyGenVoice[]> {
  try {
    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
    if (!rawKey || typeof rawKey !== 'string') { return []; }
    const apiKey = rawKey;

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) { return []; }

    const data = await response.json() as {
      voices: Array<{
        voice_id: string;
        name: string;
        labels?: { gender?: string; accent?: string; language?: string };
        preview_url?: string;
        category?: string;
      }>;
    };

    return (data.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      language: v.labels?.language ?? v.labels?.accent ?? 'English',
      accent: v.labels?.accent,
      gender: (v.labels?.gender ?? 'neutral') as 'male' | 'female' | 'neutral',
      previewUrl: v.preview_url,
      isPremium: v.category === 'professional',
      provider: 'elevenlabs' as const,
    }));
  } catch (error) {
    logger.warn('Failed to fetch ElevenLabs voices', {
      error: error instanceof Error ? error.message : String(error),
      file: 'video/voices/route.ts',
    });
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') ?? undefined;

    // Fetch HeyGen and ElevenLabs voices in parallel
    const [heygenResult, elevenlabsVoices] = await Promise.all([
      listHeyGenVoices(language).catch(() => ({ voices: [] as HeyGenVoice[] })),
      fetchElevenLabsVoices(),
    ]);

    const heygenVoices = ('voices' in heygenResult ? heygenResult.voices : [])
      .map((v) => ({ ...v, provider: 'heygen' as const }));

    // ElevenLabs voices first (better quality + working previews), then HeyGen
    const allVoices = [...elevenlabsVoices, ...heygenVoices];

    return NextResponse.json({ success: true, voices: allVoices });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voices API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage, voices: [] },
      { status: 500 }
    );
  }
}
