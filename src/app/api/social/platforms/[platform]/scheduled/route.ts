/**
 * API Route: Per-Platform Scheduled Posts Queue
 *
 * GET    /api/social/platforms/{platform}/scheduled
 *   List all `status: 'scheduled'` posts for the platform, future-dated, oldest first.
 *
 * PATCH  /api/social/platforms/{platform}/scheduled
 *   Body: { postId, content?, scheduledFor? }
 *   Update content and/or reschedule a queued post. New `scheduledFor` must be
 *   in the future. Reschedules write back to the same Firestore doc.
 *
 * DELETE /api/social/platforms/{platform}/scheduled?postId=...
 *   Mark a scheduled post as `cancelled` (soft delete). The cron dispatcher
 *   filters on `status: 'scheduled'` so cancelled docs are skipped.
 *
 * Used by `<ScheduledPostsQueue>` on the per-platform PlatformDashboard. Mirrors
 * the calendar's data source (`socialPosts` subcollection) — same docs the
 * calendar surface renders, just scoped to this platform with edit/cancel
 * affordances.
 *
 * "Post now" is delivered via the existing `/api/social/post` endpoint —
 * the queue UI calls that, then PATCHes the scheduled doc to `status: 'cancelled'`
 * so it isn't double-posted by the cron dispatcher. That detail lives client-side
 * (in <ScheduledPostsQueue>) so this route stays a thin CRUD surface.
 *
 * Server-side reads use the Admin SDK directly — Firestore rules would block
 * the client SDK from a server context (no request.auth) per
 * memory feedback_server_routes_must_use_admin_sdk.md.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { adminDb } from '@/lib/firebase/admin';
import { getSocialPostsCollection } from '@/lib/firebase/collections';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import {
  upsertSalesVelocityCalendarEvent,
  deleteSalesVelocityCalendarEvent,
} from '@/lib/integrations/google-calendar-service';

export const dynamic = 'force-dynamic';

// ─── Schemas ────────────────────────────────────────────────────────────────

const PlatformParamSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const PatchSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1).max(10000).optional(),
  scheduledFor: z.string().datetime().optional(),
}).refine(
  (data) => data.content !== undefined || data.scheduledFor !== undefined,
  { message: 'At least one of content or scheduledFor is required' },
);

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScheduledPostDoc {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledAt?: string | { seconds: number; nanoseconds?: number };
  scheduledFor?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  createdAt?: string | { seconds: number; nanoseconds?: number };
  updatedAt?: string | { seconds: number; nanoseconds?: number };
  createdBy?: string;
}

interface ScheduledPostResponseItem {
  id: string;
  platform: string;
  content: string;
  scheduledFor: string; // ISO
  mediaUrls?: string[];
  hashtags?: string[];
  createdAt?: string;
  createdBy?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureAdminDb() {
  if (!adminDb) {
    throw new Error('Admin Firestore DB not initialized.');
  }
  return adminDb;
}

function toIso(value: ScheduledPostDoc['scheduledAt']): string | null {
  if (!value) { return null; }
  if (typeof value === 'string') { return value; }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

async function applyGuards(request: NextRequest): Promise<NextResponse | null> {
  const rl = await rateLimitMiddleware(request, '/api/social/platforms/scheduled');
  if (rl) { return rl; }
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) { return auth; }
  return null;
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard) { return guard; }

    const rawParams = await params;
    const parsed = PlatformParamSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const platform = parsed.data.platform;

    const snapshot = await ensureAdminDb()
      .collection(getSocialPostsCollection())
      .where('platform', '==', platform)
      .where('status', '==', 'scheduled')
      .get();

    const items: ScheduledPostResponseItem[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() as ScheduledPostDoc;
      const scheduledIso = toIso(data.scheduledAt) ?? data.scheduledFor ?? null;
      if (!scheduledIso) { continue; }
      items.push({
        id: doc.id,
        platform: data.platform,
        content: data.content,
        scheduledFor: scheduledIso,
        mediaUrls: data.mediaUrls,
        hashtags: data.hashtags,
        createdAt: toIso(data.createdAt) ?? undefined,
        createdBy: data.createdBy,
      });
    }

    // Sort soonest-first server-side so callers don't need to.
    items.sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    );

    return NextResponse.json({ success: true, posts: items, total: items.length });
  } catch (error: unknown) {
    logger.error(
      'Scheduled Posts API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    );
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard) { return guard; }

    const rawParams = await params;
    const parsedParams = PlatformParamSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform' },
        { status: 422 },
      );
    }

    const body: unknown = await request.json();
    const parsedBody = PatchSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsedBody.error.flatten() },
        { status: 422 },
      );
    }

    const { postId, content, scheduledFor } = parsedBody.data;
    const platform = parsedParams.data.platform;

    // Reschedule into the future only — silently rejecting past times would be
    // confusing; surface the error.
    if (scheduledFor) {
      const ms = new Date(scheduledFor).getTime();
      if (Number.isNaN(ms) || ms <= Date.now()) {
        return NextResponse.json(
          { success: false, error: 'scheduledFor must be a future ISO datetime' },
          { status: 422 },
        );
      }
    }

    const docRef = ensureAdminDb().collection(getSocialPostsCollection()).doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    const existing = snap.data() as ScheduledPostDoc;
    if (existing.platform !== platform) {
      return NextResponse.json(
        { success: false, error: 'Post does not belong to this platform' },
        { status: 403 },
      );
    }
    if (existing.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: `Cannot edit post in status: ${existing.status}` },
        { status: 409 },
      );
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (content !== undefined) { update.content = content; }
    if (scheduledFor !== undefined) {
      // Write both shapes so legacy readers that look at `scheduledFor` and
      // the autonomous agent (which writes/reads `scheduledAt`) both stay in
      // sync. Calendar API normalizes either field.
      update.scheduledAt = new Date(scheduledFor);
      update.scheduledFor = scheduledFor;
    }

    await docRef.update(update);

    logger.info('Scheduled post updated', { postId, platform, fields: Object.keys(update) });

    // Re-upsert the corresponding Google Calendar event so a content
    // edit OR a reschedule both surface in the operator's calendar.
    // Non-fatal — Firestore is the source of truth.
    try {
      const effectiveContent = content ?? existing.content;
      const effectiveScheduledIso =
        scheduledFor ?? toIso(existing.scheduledAt) ?? existing.scheduledFor ?? null;
      if (effectiveScheduledIso) {
        await upsertSalesVelocityCalendarEvent({
          refId: `social-post-${postId}`,
          summary: `Social post: ${platform}`,
          description: `Scheduled post text:\n${effectiveContent}\n\nPlatform: ${platform}`,
          startIso: effectiveScheduledIso,
          timeZone: 'America/New_York',
          category: 'social',
        });
      }
    } catch (calendarErr) {
      logger.warn('Scheduled Posts API: calendar upsert failed (non-fatal)', {
        postId,
        platform,
        error: calendarErr instanceof Error ? calendarErr.message : String(calendarErr),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(
      'Scheduled Posts API: PATCH failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    );
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard) { return guard; }

    const rawParams = await params;
    const parsedParams = PlatformParamSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform' },
        { status: 422 },
      );
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    if (!postId) {
      return NextResponse.json(
        { success: false, error: 'postId query param is required' },
        { status: 400 },
      );
    }

    const platform = parsedParams.data.platform;
    const docRef = ensureAdminDb().collection(getSocialPostsCollection()).doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }
    const existing = snap.data() as ScheduledPostDoc;
    if (existing.platform !== platform) {
      return NextResponse.json(
        { success: false, error: 'Post does not belong to this platform' },
        { status: 403 },
      );
    }

    // Soft-cancel — the cron dispatcher only picks up `status: 'scheduled'`.
    await docRef.update({ status: 'cancelled', updatedAt: new Date() });

    logger.info('Scheduled post cancelled', { postId, platform });

    // Mirror the cancellation to the operator's SalesVelocity.ai
    // Google Calendar so the event disappears with the schedule.
    // Non-fatal — Firestore is the source of truth.
    try {
      await deleteSalesVelocityCalendarEvent(`social-post-${postId}`);
    } catch (calendarErr) {
      logger.warn('Scheduled Posts API: calendar delete failed (non-fatal)', {
        postId,
        platform,
        error: calendarErr instanceof Error ? calendarErr.message : String(calendarErr),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(
      'Scheduled Posts API: DELETE failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    );
  }
}
