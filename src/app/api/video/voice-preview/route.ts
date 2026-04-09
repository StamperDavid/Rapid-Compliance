/**
 * Voice Preview API
 * POST /api/video/voice-preview
 *
 * Generates a short TTS audio sample for any voice on demand.
 * - ElevenLabs voices: synthesized via ElevenLabs TTS API
 * - UnrealSpeech voices: synthesized via UnrealSpeech API
 * - Custom voices: synthesized via ElevenLabs (custom clones are stored there)
 *
 * Caches generated previews in Firestore to avoid re-synthesizing.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  voiceId: z.string().min(1),
  voiceName: z.string().min(1),
  provider: z.enum(['elevenlabs', 'unrealspeech', 'custom', 'hedra']),
  text: z.string().min(1).max(1000).optional(),
});

const SAMPLE_TEXT = 'Hello! This is a preview of my voice. I can help you create professional videos with clear, natural-sounding narration for your business.';

// ── Provider-specific synthesis ──

async function synthesizeElevenLabs(
  voiceId: string,
  text: string,
): Promise<{ base64: string; contentType: string; sizeBytes: number }> {
  const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
  if (!rawKey || typeof rawKey !== 'string') {
    throw new Error('ElevenLabs API key not configured. Add it in Settings → API Keys.');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': rawKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs synthesis failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return {
    base64: Buffer.from(audioBuffer).toString('base64'),
    contentType: 'audio/mpeg',
    sizeBytes: audioBuffer.byteLength,
  };
}

async function synthesizeUnrealSpeech(
  voiceId: string,
  text: string,
): Promise<{ base64: string; contentType: string; sizeBytes: number }> {
  const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'unrealSpeech');
  if (!rawKey || typeof rawKey !== 'string') {
    throw new Error('UnrealSpeech API key not configured. Add it in Settings → API Keys.');
  }

  const response = await fetch('https://api.v7.unrealspeech.com/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${rawKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Text: text,
      VoiceId: voiceId,
      Bitrate: '192k',
      Speed: 0,
      Pitch: 1.0,
      Codec: 'libmp3lame',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`UnrealSpeech synthesis failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as {
    OutputUri?: string;
    SynthesisTask?: { OutputUri?: string };
  };

  const audioUri = data.OutputUri ?? data.SynthesisTask?.OutputUri;
  if (!audioUri) {
    throw new Error('UnrealSpeech returned no audio URL');
  }

  // Download the audio file from the returned URI
  const audioResponse = await fetch(audioUri);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download UnrealSpeech audio: ${audioResponse.status}`);
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  return {
    base64: Buffer.from(audioBuffer).toString('base64'),
    contentType: 'audio/mpeg',
    sizeBytes: audioBuffer.byteLength,
  };
}

// ── Main handler ──

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request. Provide voiceId, voiceName, and provider.' },
        { status: 400 },
      );
    }

    const { voiceId, voiceName, provider, text: customText } = parsed.data;
    const spokenText = customText ?? SAMPLE_TEXT;

    // Check cache first (only for default sample text, not custom)
    if (!customText && adminDb) {
      const cacheDoc = await adminDb
        .collection(getSubCollection('voice_previews'))
        .doc(voiceId)
        .get();

      if (cacheDoc.exists) {
        const cached = cacheDoc.data();
        if (cached?.base64 && cached?.contentType) {
          return NextResponse.json({
            success: true,
            audioUrl: `data:${cached.contentType as string};base64,${cached.base64 as string}`,
            cached: true,
          });
        }
      }
    }

    // Hedra voices can't be synthesized from our side — they live inside Hedra's system
    if (provider === 'hedra') {
      return NextResponse.json(
        { success: false, error: 'Hedra voice previews are only available from the Hedra platform. Select a voice with a preview URL.' },
        { status: 400 },
      );
    }

    // Synthesize using the correct provider
    let result: { base64: string; contentType: string; sizeBytes: number };

    if (provider === 'unrealspeech') {
      result = await synthesizeUnrealSpeech(voiceId, spokenText);
    } else {
      // ElevenLabs handles both 'elevenlabs' and 'custom' (custom clones are stored in ElevenLabs)
      result = await synthesizeElevenLabs(voiceId, spokenText);
    }

    // Cache in Firestore for future requests (only for default sample text)
    if (!customText && adminDb) {
      await adminDb
        .collection(getSubCollection('voice_previews'))
        .doc(voiceId)
        .set({
          base64: result.base64,
          contentType: result.contentType,
          voiceName,
          provider,
          sizeBytes: result.sizeBytes,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        });
    }

    logger.info('Voice preview generated', {
      voiceId,
      voiceName,
      provider,
      sizeBytes: result.sizeBytes,
      file: 'voice-preview/route.ts',
    });

    return NextResponse.json({
      success: true,
      audioUrl: `data:${result.contentType};base64,${result.base64}`,
      cached: false,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voice preview error', error instanceof Error ? error : new Error(String(error)), {
      file: 'voice-preview/route.ts',
    });

    // Return 400 for missing API keys, 502 for upstream failures
    const status = errorMessage.includes('not configured') ? 400 : 502;
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status },
    );
  }
}
