/**
 * API Route: Add Strategy-Wizard drafts to the evergreen queue
 *
 * POST /api/social/strategy-wizard/queue
 *   Body: { drafts: [{ platform, content, hashtags?, preferredTimeSlot? }] }
 *   Writes each approved draft to the evergreen `social_queue` via the
 *   AutonomousPostingAgent's `addToQueue`. The queue only auto-posts when the
 *   operator has separately opted in (rate-limited cron) — so filling it never
 *   sends anything to a real audience here.
 *
 * Response (success): { success: true, queued: number, failed: number, errors: string[] }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AutonomousPostingAgent } from '@/lib/social/autonomous-posting-agent';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const PlatformEnum = z.enum(
  SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]],
);

const DraftSchema = z.object({
  platform: PlatformEnum,
  content: z.string().trim().min(1).max(8000),
  hashtags: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  preferredTimeSlot: z.string().trim().min(1).max(200).optional(),
});

const BodySchema = z.object({
  drafts: z.array(DraftSchema).min(1).max(60),
});

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/strategy-wizard/queue');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request.', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const agent = AutonomousPostingAgent.getInstance();
    const createdBy = auth.user.email ?? auth.user.uid;

    let queued = 0;
    let failed = 0;
    const errors: string[] = [];

    // Sequential to keep stable queue-position ordering inside addToQueue.
    for (const draft of parsed.data.drafts) {
      const result = await agent.addToQueue(draft.content, [draft.platform], {
        hashtags: draft.hashtags,
        preferredTimeSlot: draft.preferredTimeSlot,
        createdBy: `strategy-wizard:${createdBy}`,
      });
      if (result.success) {
        queued += 1;
      } else {
        failed += 1;
        errors.push(`${draft.platform}: ${result.error ?? 'unknown error'}`);
      }
    }

    if (queued === 0) {
      return NextResponse.json(
        { success: false, error: 'No drafts could be added to the queue.', errors },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, queued, failed, errors });
  } catch (error: unknown) {
    logger.error(
      'Strategy Wizard Queue API: POST failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    const message = error instanceof Error ? error.message : 'Failed to add drafts to the queue.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
