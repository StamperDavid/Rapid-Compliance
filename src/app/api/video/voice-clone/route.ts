/**
 * Voice Clone API
 * POST /api/video/voice-clone
 *
 * Allows users to upload audio samples of their own voice and create
 * a custom ElevenLabs voice clone. Requires at least 1 audio sample
 * (more samples = better quality).
 *
 * ElevenLabs Instant Voice Cloning:
 * - Accepts MP3, WAV, M4A, WEBM audio files
 * - Best results with 1-3 minutes of clean speech
 * - Voice is available immediately after creation
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per sample
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
];

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const userId = authResult.user.uid;

    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
    if (!rawKey || typeof rawKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ElevenLabs API key not configured. Add it in Settings → API Keys.' },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const voiceName = formData.get('name');
    const description = formData.get('description') ?? '';

    if (!voiceName || typeof voiceName !== 'string' || voiceName.trim().length < 1) {
      return NextResponse.json(
        { success: false, error: 'Voice name is required.' },
        { status: 400 },
      );
    }

    // Collect all audio sample files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'samples' && value instanceof File) {
        if (value.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { success: false, error: `File "${value.name}" is too large. Maximum 10MB per sample.` },
            { status: 400 },
          );
        }
        if (!ALLOWED_AUDIO_TYPES.includes(value.type) && !value.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
          return NextResponse.json(
            { success: false, error: `File "${value.name}" is not a supported audio format. Use MP3, WAV, M4A, or WebM.` },
            { status: 400 },
          );
        }
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one audio sample is required. Upload an MP3, WAV, or M4A file of your voice.' },
        { status: 400 },
      );
    }

    // Build form data for ElevenLabs API
    const elevenLabsForm = new FormData();
    elevenLabsForm.append('name', voiceName.trim());
    elevenLabsForm.append('description', typeof description === 'string' ? description : '');

    for (const file of files) {
      elevenLabsForm.append('files', file);
    }

    // Call ElevenLabs Instant Voice Clone API
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': rawKey,
      },
      body: elevenLabsForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('ElevenLabs voice clone failed', new Error(errorText), {
        status: response.status,
        file: 'voice-clone/route.ts',
      });

      let userError = 'Voice cloning failed.';
      if (response.status === 401) {
        userError = 'ElevenLabs API key is invalid. Update it in Settings → API Keys.';
      } else if (response.status === 422) {
        userError = 'Audio quality issue. Record in a quiet environment with clear speech for 30+ seconds.';
      } else if (response.status === 429) {
        userError = 'Rate limited. Wait a moment and try again.';
      }

      return NextResponse.json(
        { success: false, error: userError },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const data = await response.json() as { voice_id: string };

    // Store reference in Firestore for tracking
    if (adminDb) {
      await adminDb
        .collection(`organizations/${PLATFORM_ID}/custom_voices`)
        .doc(data.voice_id)
        .set({
          voiceId: data.voice_id,
          name: voiceName.trim(),
          description: typeof description === 'string' ? description : '',
          provider: 'elevenlabs',
          createdBy: userId,
          sampleCount: files.length,
          createdAt: new Date(),
        });
    }

    logger.info('Voice clone created', {
      voiceId: data.voice_id,
      voiceName: voiceName.trim(),
      sampleCount: files.length,
      userId,
      file: 'voice-clone/route.ts',
    });

    return NextResponse.json({
      success: true,
      voiceId: data.voice_id,
      voiceName: voiceName.trim(),
      provider: 'elevenlabs',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voice clone error', error instanceof Error ? error : new Error(String(error)), {
      file: 'voice-clone/route.ts',
    });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
