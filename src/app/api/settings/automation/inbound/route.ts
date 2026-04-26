/**
 * Inbound Automation Settings
 *
 * GET   /api/settings/automation/inbound — read current config (default: all off)
 * PATCH /api/settings/automation/inbound — flip a single channel's autoApprove flag
 *
 * Gated on requireRole(['owner', 'admin']). Default state is everything OFF;
 * the operator must explicitly opt a channel in.
 *
 * Per `feedback_no_jasper_bypass_even_for_simple_replies`: the toggle only
 * skips operator approval gates; the Jasper → manager → specialist
 * delegation path itself runs whether the toggle is on or off.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getInboundAutomationConfig,
  setChannelAutoApprove,
  type InboundAutomationConfig,
} from '@/lib/automation/inbound-automation-service';

export const dynamic = 'force-dynamic';

const patchBodySchema = z.object({
  channel: z.enum(['xDmReply']),
  autoApprove: z.boolean(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const config: InboundAutomationConfig = await getInboundAutomationConfig();
  return NextResponse.json({ success: true, config });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  let parsed;
  try {
    const raw: unknown = await request.json();
    parsed = patchBodySchema.safeParse(raw);
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

  const ok = await setChannelAutoApprove({
    channel: parsed.data.channel,
    autoApprove: parsed.data.autoApprove,
    actorUid: user.uid,
  });
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to update automation config' }, { status: 500 });
  }

  logger.info('[settings/automation/inbound] toggle updated', {
    channel: parsed.data.channel,
    autoApprove: parsed.data.autoApprove,
    actorUid: user.uid,
  });

  const config = await getInboundAutomationConfig();
  return NextResponse.json({ success: true, config });
}
