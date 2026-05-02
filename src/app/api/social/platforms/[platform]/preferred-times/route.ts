/**
 * API Route: Per-Platform Preferred Posting Times
 *
 * GET /api/social/platforms/{platform}/preferred-times
 *   → { slots: TimeSlot[] }  current adopted slots for this platform
 *
 * PUT /api/social/platforms/{platform}/preferred-times
 *   body: { slots: TimeSlot[] }  replaces the full set for this platform
 *   → { slots: TimeSlot[] }
 *
 * Storage: organizations/{PLATFORM_ID}/settings/social_preferred_times_{platform}
 *   Scoped per-platform so a future global-vs-per-platform refactor is trivial —
 *   callers that need the union can collect all docs under the settings sub-collection.
 *
 * Auth + rate-limit mirrors insights/route.ts (same platform-scoped pattern).
 * Server-side only — Admin SDK, never the client SDK.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { SOCIAL_PLATFORMS, type SocialPlatform, type TimeSlot } from '@/types/social';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const TimeSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]])),
});

const PutBodySchema = z.object({
  slots: z.array(TimeSlotSchema),
});

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

const SETTINGS_COLLECTION = 'settings';

/** Returns the doc-id used to store preferred times for a specific platform */
function preferredTimesDocId(platform: SocialPlatform): string {
  return `social_preferred_times_${platform}`;
}

interface PreferredTimesDoc {
  slots: TimeSlot[];
  updatedAt: string;
  updatedBy: string;
}

async function readSlots(platform: SocialPlatform): Promise<TimeSlot[]> {
  const doc = await AdminFirestoreService.get<PreferredTimesDoc>(
    getSubCollection(SETTINGS_COLLECTION),
    preferredTimesDocId(platform),
  );
  return doc?.slots ?? [];
}

async function writeSlots(
  platform: SocialPlatform,
  slots: TimeSlot[],
  updatedBy: string,
): Promise<void> {
  const payload: PreferredTimesDoc = {
    slots,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await AdminFirestoreService.set(
    getSubCollection(SETTINGS_COLLECTION),
    preferredTimesDocId(platform),
    payload,
  );
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      '/api/social/platforms/preferred-times',
    );
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }

    const slots = await readSlots(parsed.data.platform);
    return NextResponse.json({ success: true, slots });
  } catch (error: unknown) {
    logger.error(
      'Preferred Times API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load preferred posting times' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      '/api/social/platforms/preferred-times',
    );
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const rawParams = await params;
    const parsedPlatform = PlatformSchema.safeParse(rawParams);
    if (!parsedPlatform.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }

    const body: unknown = await request.json();
    const parsedBody = PutBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsedBody.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { platform } = parsedPlatform.data;
    const { slots } = parsedBody.data;

    await writeSlots(platform, slots, authResult.user.uid);

    logger.info('Preferred Times API: slots updated', {
      platform,
      count: slots.length,
      userId: authResult.user.uid,
    });

    return NextResponse.json({ success: true, slots });
  } catch (error: unknown) {
    logger.error(
      'Preferred Times API: PUT failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update preferred posting times' },
      { status: 500 },
    );
  }
}
