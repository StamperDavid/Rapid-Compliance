/**
 * AI Music Generation API
 * POST /api/audio/music/generate — Generate music using Suno AI
 *
 * Supports both preview (short clip) and full-length generation.
 * Stores extended metadata including mood, tempo, vocals, and lyrics.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const MoodValues = [
  'happy', 'energetic', 'calm', 'dramatic',
  'mysterious', 'romantic', 'dark', 'inspiring',
] as const;

const TempoValues = ['slow', 'medium', 'fast', 'very-fast'] as const;
const VoiceStyleValues = ['male', 'female', 'choir', 'robotic'] as const;

const GenerateSchema = z.object({
  prompt: z.string().min(1).max(1000),
  style: z.string().min(1).max(100),
  duration: z.number().min(5).max(240),
  instrumental: z.boolean(),
  mood: z.array(z.enum(MoodValues)).max(3).optional(),
  tempo: z.enum(TempoValues).optional(),
  voiceStyle: z.enum(VoiceStyleValues).optional(),
  lyrics: z.string().max(3000).optional(),
  isPreview: z.boolean().optional(),
  parentPreviewId: z.string().max(200).optional(),
});

type SunoTrackResponse = {
  id: string;
  title: string;
  audio_url: string;
  duration: number;
  tags?: string;
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const sunoKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'suno');
    if (!sunoKey || typeof sunoKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Suno API key not configured. Add it in Settings -> API Keys.' },
        { status: 400 },
      );
    }

    const {
      prompt, style, duration, instrumental,
      mood, tempo, voiceStyle, lyrics, isPreview, parentPreviewId,
    } = parsed.data;

    // Build enriched prompt with all parameters
    const moodStr = mood && mood.length > 0 ? ` Mood: ${mood.join(', ')}.` : '';
    const tempoMap: Record<string, string> = {
      'slow': '60-80 BPM',
      'medium': '80-120 BPM',
      'fast': '120-160 BPM',
      'very-fast': '160+ BPM',
    };
    const tempoStr = tempo ? ` Tempo: ${tempoMap[tempo]}.` : '';
    const vocalStr = voiceStyle && !instrumental ? ` Vocals: ${voiceStyle}.` : '';
    const durationLabel = isPreview ? '~10 seconds preview' : `~${duration} seconds`;

    const fullPrompt = `${prompt}. Style: ${style}.${moodStr}${tempoStr}${vocalStr} Duration: ${durationLabel}.`;

    // Suno API payload
    const sunoPayload: Record<string, string | boolean> = {
      topic: fullPrompt,
      tags: style,
      make_instrumental: instrumental,
    };

    // If lyrics are provided and vocals enabled, include them
    if (!instrumental && lyrics && lyrics.trim().length > 0) {
      sunoPayload.prompt = lyrics.trim();
    }

    const response = await fetch('https://studio-api.suno.ai/api/external/generate/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sunoKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sunoPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Suno API error', new Error(errorText), {
        status: response.status,
        file: 'audio/music/generate/route.ts',
      });

      if (response.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Suno API key is invalid. Update it in Settings -> API Keys.' },
          { status: 401 },
        );
      }

      return NextResponse.json(
        { success: false, error: `Music generation failed (${response.status})` },
        { status: 502 },
      );
    }

    const data = await response.json() as SunoTrackResponse[];

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tracks generated. Try a different prompt.' },
        { status: 502 },
      );
    }

    const track = data[0];

    // Save to Firestore with extended metadata
    if (adminDb) {
      await adminDb
        .collection(`organizations/${PLATFORM_ID}/generated_music`)
        .doc(track.id)
        .set({
          title: track.title,
          audioUrl: track.audio_url,
          duration: track.duration,
          style,
          prompt,
          instrumental,
          mood: mood ?? [],
          tempo: tempo ?? 'medium',
          hasVocals: !instrumental,
          voiceStyle: voiceStyle ?? null,
          lyrics: lyrics ?? null,
          isFavorite: false,
          isPreview: isPreview ?? false,
          parentPreviewId: parentPreviewId ?? null,
          createdBy: authResult.user.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }

    logger.info('AI music generated', {
      trackId: track.id,
      title: track.title,
      duration: track.duration,
      isPreview: isPreview ?? false,
      file: 'audio/music/generate/route.ts',
    });

    return NextResponse.json({
      success: true,
      track: {
        id: track.id,
        title: track.title,
        audioUrl: track.audio_url,
        duration: track.duration,
        style,
        mood: mood ?? [],
        tempo: tempo ?? 'medium',
        hasVocals: !instrumental,
        voiceStyle: voiceStyle ?? null,
        lyrics: lyrics ?? null,
        isFavorite: false,
        isPreview: isPreview ?? false,
        parentPreviewId: parentPreviewId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Music generation failed', error instanceof Error ? error : new Error(msg), {
      file: 'audio/music/generate/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
