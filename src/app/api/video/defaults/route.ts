/**
 * Video Defaults API
 * GET  /api/video/defaults — retrieve default avatar/voice settings
 * POST /api/video/defaults — update default avatar/voice settings
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { getVideoDefaults, setVideoDefaults } from '@/lib/video/video-defaults-service';

export const dynamic = 'force-dynamic';

const UpdateDefaultsSchema = z.object({
  avatarId: z.string().nullable().optional(),
  avatarName: z.string().nullable().optional(),
  voiceId: z.string().nullable().optional(),
  voiceName: z.string().nullable().optional(),
  voiceProvider: z.enum(['heygen', 'elevenlabs', 'unrealspeech', 'custom']).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const defaults = await getVideoDefaults();
    return NextResponse.json({ success: true, defaults });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = UpdateDefaultsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 },
      );
    }

    await setVideoDefaults(parsed.data, authResult.user.uid);
    const updated = await getVideoDefaults();

    return NextResponse.json({ success: true, defaults: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
