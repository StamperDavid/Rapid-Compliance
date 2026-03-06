/**
 * AI Music Generation API
 * POST /api/audio/music/generate — Generate music using Suno AI
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const GenerateSchema = z.object({
  prompt: z.string().min(1).max(1000),
  style: z.string().min(1).max(50),
  duration: z.number().min(10).max(240),
  instrumental: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

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
        { success: false, error: 'Suno API key not configured. Add it in Settings → API Keys.' },
        { status: 400 },
      );
    }

    const { prompt, style, duration, instrumental } = parsed.data;

    // Build the Suno prompt with style context
    const fullPrompt = `${prompt}. Style: ${style}. Duration: ~${duration} seconds.`;

    // Call Suno API
    const response = await fetch('https://studio-api.suno.ai/api/external/generate/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sunoKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: fullPrompt,
        tags: style,
        make_instrumental: instrumental,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Suno API error', new Error(errorText), {
        status: response.status,
        file: 'audio/music/generate/route.ts',
      });

      if (response.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Suno API key is invalid. Update it in Settings → API Keys.' },
          { status: 401 },
        );
      }

      return NextResponse.json(
        { success: false, error: `Music generation failed (${response.status})` },
        { status: 502 },
      );
    }

    const data = await response.json() as Array<{
      id: string;
      title: string;
      audio_url: string;
      duration: number;
      tags?: string;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tracks generated. Try a different prompt.' },
        { status: 502 },
      );
    }

    const track = data[0];

    // Save to Firestore
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
          createdBy: authResult.user.uid,
          createdAt: new Date(),
        });
    }

    logger.info('AI music generated', {
      trackId: track.id,
      title: track.title,
      duration: track.duration,
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
        createdAt: new Date(),
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
