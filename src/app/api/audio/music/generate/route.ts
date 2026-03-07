/**
 * AI Music Generation API
 * POST /api/audio/music/generate — Generate music using MiniMax Music AI
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
import { randomUUID } from 'crypto';

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

// MiniMax API response types
interface MiniMaxResponse {
  data: {
    status: number;
    audio: string;
  };
  base_resp: {
    status_code: number;
    status_msg: string;
  };
  trace_id: string;
  extra_info: {
    music_duration: number;
    music_sample_rate: number;
    music_channel: number;
    bitrate: number;
    music_size: number;
  };
}

function generateTitle(prompt: string, style: string): string {
  // Take first meaningful phrase from prompt, max 60 chars
  const clean = prompt.replace(/\.\s*Style:.*$/, '').trim();
  const firstPhrase = clean.split(/[.,!?;]/)[0]?.trim() ?? style;
  if (firstPhrase.length > 60) {
    return `${firstPhrase.substring(0, 57)}...`;
  }
  return firstPhrase || style;
}

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

    const minimaxKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'minimax');
    if (!minimaxKey || typeof minimaxKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'MiniMax API key not configured. Add it in Settings -> API Keys.' },
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
      'slow': '60-80 BPM, slow tempo',
      'medium': '80-120 BPM, moderate tempo',
      'fast': '120-160 BPM, fast tempo',
      'very-fast': '160+ BPM, very fast tempo',
    };
    const tempoStr = tempo ? ` ${tempoMap[tempo]}.` : '';
    const vocalStr = voiceStyle && !instrumental ? ` Vocals: ${voiceStyle}.` : '';
    const durationLabel = isPreview ? 'short clip' : `approximately ${duration} seconds`;

    const fullPrompt = `${prompt}. Style: ${style}.${moodStr}${tempoStr}${vocalStr} Duration: ${durationLabel}.`;

    // Format lyrics with structural tags if provided
    let formattedLyrics: string | undefined;
    if (!instrumental && lyrics && lyrics.trim().length > 0) {
      // If lyrics don't already have structural tags, wrap in [Verse]
      const hasStructuralTags = /\[(Verse|Chorus|Bridge|Intro|Outro|Hook|Pre-Chorus)\]/i.test(lyrics);
      formattedLyrics = hasStructuralTags ? lyrics.trim() : `[Verse]\n${lyrics.trim()}`;
    }

    // MiniMax API payload
    const minimaxPayload: Record<string, unknown> = {
      model: 'music-2.5+',
      prompt: fullPrompt,
      is_instrumental: instrumental,
      output_format: 'url',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    // Include lyrics if provided
    if (formattedLyrics) {
      minimaxPayload.lyrics = formattedLyrics;
    } else if (!instrumental) {
      // Auto-generate lyrics from prompt when vocals are enabled but no lyrics provided
      minimaxPayload.lyrics_optimizer = true;
    }

    const response = await fetch('https://api.minimax.io/v1/music_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${minimaxKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimaxPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('MiniMax API error', new Error(errorText), {
        status: response.status,
        file: 'audio/music/generate/route.ts',
      });

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { success: false, error: 'MiniMax API key is invalid. Update it in Settings -> API Keys.' },
          { status: 401 },
        );
      }

      return NextResponse.json(
        { success: false, error: `Music generation failed (${response.status})` },
        { status: 502 },
      );
    }

    const data = await response.json() as MiniMaxResponse;

    // Check MiniMax response status
    if (data.base_resp.status_code !== 0) {
      const errorMsg = data.base_resp.status_msg || 'Unknown MiniMax error';
      logger.error('MiniMax generation error', new Error(errorMsg), {
        statusCode: data.base_resp.status_code,
        file: 'audio/music/generate/route.ts',
      });

      if (data.base_resp.status_code === 1004) {
        return NextResponse.json(
          { success: false, error: 'MiniMax API key is invalid. Update it in Settings -> API Keys.' },
          { status: 401 },
        );
      }

      if (data.base_resp.status_code === 1008) {
        return NextResponse.json(
          { success: false, error: 'MiniMax account has insufficient balance. Top up your account.' },
          { status: 402 },
        );
      }

      return NextResponse.json(
        { success: false, error: `Music generation failed: ${errorMsg}` },
        { status: 502 },
      );
    }

    if (!data.data?.audio) {
      return NextResponse.json(
        { success: false, error: 'No audio generated. Try a different prompt.' },
        { status: 502 },
      );
    }

    const trackId = data.trace_id || randomUUID();
    const audioUrl = data.data.audio;
    const trackDuration = data.extra_info?.music_duration ?? duration;
    const title = generateTitle(prompt, style);

    // Save to Firestore with extended metadata
    if (adminDb) {
      await adminDb
        .collection(`organizations/${PLATFORM_ID}/generated_music`)
        .doc(trackId)
        .set({
          title,
          audioUrl,
          duration: trackDuration,
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
          provider: 'minimax',
          createdBy: authResult.user.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }

    logger.info('AI music generated', {
      trackId,
      title,
      duration: trackDuration,
      isPreview: isPreview ?? false,
      provider: 'minimax',
      file: 'audio/music/generate/route.ts',
    });

    return NextResponse.json({
      success: true,
      track: {
        id: trackId,
        title,
        audioUrl,
        duration: trackDuration,
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
