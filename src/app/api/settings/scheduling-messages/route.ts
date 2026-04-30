/**
 * Scheduling Messages Settings API
 *
 * GET  /api/settings/scheduling-messages — read current messages (DEFAULTS if not set)
 * PUT  /api/settings/scheduling-messages — partial update of any subset of fields
 *
 * Owner/admin gated.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getSchedulingMessages,
  setSchedulingMessages,
} from '@/lib/meetings/scheduling-messages-service';

export const dynamic = 'force-dynamic';

const putBodySchema = z.object({
  earlyAccessSuccessTitle: z.string().max(200).optional(),
  earlyAccessSuccessBody: z.string().max(2000).optional(),
  demoConfirmationEmailSubject: z.string().max(300).optional(),
  demoConfirmationEmailBody: z.string().max(20000).optional(),
  zoomMeetingTopic: z.string().max(200).optional(),
  zoomMeetingAgenda: z.string().max(2000).optional(),
  reminder24hSubject: z.string().max(300).optional(),
  reminder24hBody: z.string().max(5000).optional(),
  reminder1hSubject: z.string().max(300).optional(),
  reminder1hBody: z.string().max(5000).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const messages = await getSchedulingMessages();
  return NextResponse.json({ success: true, messages });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  let parsed;
  try {
    const raw: unknown = await request.json();
    parsed = putBodySchema.safeParse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Invalid JSON: ${msg}` }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }

  const ok = await setSchedulingMessages({ ...parsed.data, actorUid: user.uid });
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to save messages' }, { status: 500 });
  }

  logger.info('[settings/scheduling-messages] messages saved', {
    actorUid: user.uid,
    fields: Object.keys(parsed.data),
  });

  const messages = await getSchedulingMessages();
  return NextResponse.json({ success: true, messages });
}
