/**
 * Voice Preview API
 * POST /api/video/voice-preview
 *
 * Generates a short TTS audio sample for any voice on demand.
 * - ElevenLabs voices: synthesized via ElevenLabs TTS API
 * - HeyGen voices: not directly previewable (no standalone TTS endpoint),
 *   returns an error suggesting ElevenLabs voices instead
 *
 * Caches generated previews in Firestore to avoid re-synthesizing.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  voiceId: z.string().min(1),
  voiceName: z.string().min(1),
  provider: z.enum(['elevenlabs', 'heygen']),
});

const SAMPLE_TEXT = 'Hello! This is a preview of my voice. I can help you create professional videos with clear, natural-sounding narration for your business.';

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

    const { voiceId, voiceName, provider } = parsed.data;

    // HeyGen voices don't have a standalone TTS API
    if (provider === 'heygen') {
      return NextResponse.json(
        {
          success: false,
          error: 'HeyGen voices cannot be previewed standalone. Select an ElevenLabs voice for preview support and better audio quality.',
        },
        { status: 422 },
      );
    }

    // Check cache first
    if (adminDb) {
      const cacheDoc = await adminDb
        .collection(`organizations/${PLATFORM_ID}/voice_previews`)
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

    // Get ElevenLabs API key
    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
    if (!rawKey || typeof rawKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ElevenLabs API key not configured. Add it in Settings → API Keys.' },
        { status: 400 },
      );
    }

    // Synthesize a short sample
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': rawKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: SAMPLE_TEXT,
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
      logger.warn('ElevenLabs preview synthesis failed', {
        status: response.status,
        voiceId,
        error: errorText.slice(0, 200),
        file: 'voice-preview/route.ts',
      });
      return NextResponse.json(
        { success: false, error: `Voice preview generation failed (${response.status})` },
        { status: 502 },
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const contentType = 'audio/mpeg';

    // Cache in Firestore for future requests
    if (adminDb) {
      await adminDb
        .collection(`organizations/${PLATFORM_ID}/voice_previews`)
        .doc(voiceId)
        .set({
          base64: base64Audio,
          contentType,
          voiceName,
          provider,
          sizeBytes: audioBuffer.byteLength,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        });
    }

    logger.info('Voice preview generated', {
      voiceId,
      voiceName,
      sizeBytes: audioBuffer.byteLength,
      file: 'voice-preview/route.ts',
    });

    return NextResponse.json({
      success: true,
      audioUrl: `data:${contentType};base64,${base64Audio}`,
      cached: false,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voice preview error', error instanceof Error ? error : new Error(String(error)), {
      file: 'voice-preview/route.ts',
    });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
