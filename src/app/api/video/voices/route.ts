import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { VideoVoice } from '@/types/video';

export const dynamic = 'force-dynamic';

/**
 * Fetch ElevenLabs voices if API key is configured.
 * Returns voices with preview URLs that actually work.
 */
async function fetchElevenLabsVoices(): Promise<VideoVoice[]> {
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

/**
 * Fetch UnrealSpeech voices if API key is configured.
 * UnrealSpeech has a fixed set of high-quality voices.
 */
async function fetchUnrealSpeechVoices(): Promise<VideoVoice[]> {
  try {
    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'unrealSpeech');
    if (!rawKey || typeof rawKey !== 'string') { return []; }

    // UnrealSpeech has a fixed voice roster — no list endpoint needed
    const voices: VideoVoice[] = [
      { id: 'Scarlett', name: 'Scarlett', language: 'English', gender: 'female', provider: 'unrealspeech' },
      { id: 'Dan', name: 'Dan', language: 'English', gender: 'male', provider: 'unrealspeech' },
      { id: 'Liv', name: 'Liv', language: 'English', gender: 'female', provider: 'unrealspeech' },
      { id: 'Will', name: 'Will', language: 'English', gender: 'male', provider: 'unrealspeech' },
      { id: 'Amy', name: 'Amy', language: 'English', gender: 'female', provider: 'unrealspeech' },
      { id: 'Melody', name: 'Melody', language: 'English', gender: 'female', provider: 'unrealspeech' },
      { id: 'Sierra', name: 'Sierra', language: 'English', gender: 'female', provider: 'unrealspeech' },
    ];

    return voices;
  } catch {
    return [];
  }
}

/**
 * Fetch Hedra voice library if API key is configured.
 * Hedra exposes voices from minimax and elevenlabs sources.
 */
async function fetchHedraVoices(): Promise<VideoVoice[]> {
  try {
    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');
    if (!rawKey || typeof rawKey !== 'string') { return []; }

    const response = await fetch('https://api.hedra.com/web-app/public/voices', {
      headers: { 'x-api-key': rawKey, 'Accept': 'application/json' },
    });

    if (!response.ok) { return []; }

    const voices = await response.json() as Array<{
      id: string;
      name: string;
      description?: string;
      asset?: {
        source?: string;
        preview_url?: string | null;
        labels?: Array<{ name: string; value: string }>;
      };
    }>;

    if (!Array.isArray(voices)) { return []; }

    return voices.map((v) => {
      const labels = v.asset?.labels ?? [];
      const getLabel = (key: string): string | undefined =>
        labels.find((l) => l.name === key)?.value;

      const rawGender = getLabel('gender');
      const gender: 'male' | 'female' | 'neutral' | undefined =
        rawGender === 'male' || rawGender === 'female' ? rawGender : undefined;

      return {
        id: v.id,
        name: v.name,
        language: getLabel('language') ?? 'English',
        accent: getLabel('accent'),
        gender,
        previewUrl: v.asset?.preview_url ?? undefined,
        provider: 'hedra' as const,
      };
    });
  } catch (error) {
    logger.warn('Failed to fetch Hedra voices', {
      error: error instanceof Error ? error.message : String(error),
      file: 'video/voices/route.ts',
    });
    return [];
  }
}

/**
 * Fetch custom cloned voices from Firestore.
 */
async function fetchCustomVoices(): Promise<VideoVoice[]> {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    if (!adminDb) { return []; }

    const snapshot = await adminDb
      .collection(`organizations/${PLATFORM_ID}/custom_voices`)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.voiceId as string,
        name: `${data.name as string} (Clone)`,
        language: 'English',
        provider: 'custom' as const,
      };
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // Fetch all voice sources in parallel
    const [elevenlabsVoices, unrealVoices, customVoices, hedraVoices] = await Promise.all([
      fetchElevenLabsVoices(),
      fetchUnrealSpeechVoices(),
      fetchCustomVoices(),
      fetchHedraVoices(),
    ]);

    // Order: Custom clones first, then Hedra, ElevenLabs, UnrealSpeech
    const allVoices = [...customVoices, ...hedraVoices, ...elevenlabsVoices, ...unrealVoices];

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
