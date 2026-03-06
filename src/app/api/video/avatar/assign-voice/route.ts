/**
 * POST /api/video/avatar/assign-voice
 * Assign a voice to a custom avatar so it shows on the avatar card.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const AssignVoiceSchema = z.object({
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  voiceName: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const parsed = AssignVoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { avatarId, voiceId, voiceName } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    const docRef = adminDb
      .collection(`organizations/${PLATFORM_ID}/custom_avatars`)
      .doc(avatarId);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: 'Custom avatar not found' }, { status: 404 });
    }

    await docRef.update({
      assignedVoiceId: voiceId,
      assignedVoiceName: voiceName,
      updatedAt: new Date().toISOString(),
    });

    logger.info('Voice assigned to avatar', { avatarId, voiceId, voiceName });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Assign voice failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
