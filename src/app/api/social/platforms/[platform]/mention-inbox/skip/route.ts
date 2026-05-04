/**
 * Skip / mark a mention resolved (no reply sent)
 *
 * POST /api/social/platforms/{platform}/mention-inbox/skip
 *
 * Stamps `handledMentions/{docId}` with action='skipped' so the inbox does
 * not surface this mention on subsequent polls.
 *
 * Mastodon-specific: we ALSO call the platform's notification dismiss
 * endpoint server-side, which marks the notification as read for THIS
 * account. This is best-effort — failure to call the platform-side dismiss
 * does not fail the request, since our local handledMentions stamp is the
 * authoritative state for the inbox UI.
 *
 * Body schema (Zod-validated):
 *   {
 *     mentionId: string         // platform-side notification id
 *     reason?: string           // optional operator note (max 500 chars)
 *   }
 *
 * Response:
 *   200 { success: true, handledAt }
 *   422 invalid body / unsupported platform
 *   500 unexpected
 *
 * Standing rules:
 *   - Auth required (owner/admin only).
 *   - Admin SDK only.
 *   - No GM edits, no TrainingFeedback writes.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { createMastodonService } from '@/lib/integrations/mastodon-service';
import { mentionDocId } from '@/lib/social/mention-handled-helpers';

export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const BodySchema = z.object({
  mentionId: z.string().min(1).max(500),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/platforms/mention-inbox/skip');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }
    const { user } = auth;

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const rawParams = await params;
    const parsedParams = ParamsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }
    const platform = parsedParams.data.platform;

    let body: z.infer<typeof BodySchema>;
    try {
      const raw: unknown = await request.json();
      const parsed = BodySchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid body', details: parsed.error.flatten() },
          { status: 422 },
        );
      }
      body = parsed.data;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 422 },
      );
    }

    // Best-effort: dismiss the underlying notification on Mastodon so it
    // doesn't reappear in our re-polled `pollMentions` window. If the
    // dismiss call fails the local handledMentions stamp still keeps the
    // row out of the inbox — we just keep paying the API cost on each poll.
    if (platform === 'mastodon') {
      try {
        const service = await createMastodonService();
        if (service) {
          const dismissResult = await service.dismissNotification(body.mentionId);
          if (!dismissResult.success) {
            logger.warn('[mention-inbox/skip] Mastodon dismiss failed (continuing)', {
              mentionId: body.mentionId,
              error: dismissResult.error,
            });
          }
        }
      } catch (err) {
        logger.warn('[mention-inbox/skip] Mastodon dismiss threw (continuing)', {
          mentionId: body.mentionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const handledAt = new Date().toISOString();

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    const docId = mentionDocId(platform, body.mentionId);
    await adminDb
      .collection(getSubCollection('handledMentions'))
      .doc(docId)
      .set(
        {
          platform,
          mentionId: body.mentionId,
          action: 'skipped',
          handledAt,
          handledBy: user.uid,
          ...(body.reason ? { reason: body.reason } : {}),
        },
        { merge: true },
      );

    logger.info('[mention-inbox/skip] Mention skipped', {
      platform,
      mentionId: body.mentionId,
      actorUid: user.uid,
      hasReason: Boolean(body.reason),
    });

    return NextResponse.json({ success: true, handledAt });
  } catch (error: unknown) {
    logger.error(
      '[mention-inbox/skip] POST failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Skip failed' },
      { status: 500 },
    );
  }
}
