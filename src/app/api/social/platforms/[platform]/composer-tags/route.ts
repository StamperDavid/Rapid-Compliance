/**
 * API Route: Per-Platform Composer Tags (Saved Hashtags, Keywords & Platform-Specific Metadata)
 *
 * GET  /api/social/platforms/{platform}/composer-tags
 *   Returns saved tags for this platform. Used on mount by TagsAndSeoSection
 *   to pre-fill the composer.
 *   Response: { success: true, hashtags: string[], keywords: string[], platformSpecific: Record<string,string> }
 *
 * PUT  /api/social/platforms/{platform}/composer-tags
 *   Replaces the full set for this platform. Called by the "Adopt" buttons in
 *   PlatformInsightsPanel when the operator adopts hashtags or keywords from
 *   the Discovery & SEO section.
 *   Body:    { hashtags: string[], keywords: string[], platformSpecific: Record<string,string> }
 *   Response: { success: true, hashtags: string[], keywords: string[], platformSpecific: Record<string,string> }
 *
 * Storage path: organizations/{PLATFORM_ID}/settings/composer_tags_{platform}
 * Mirrors the per-platform pattern used by preferred-times.
 *
 * Auth + rate-limit pattern mirrors insights/route.ts.
 * Server-side only — Admin SDK, never the client SDK (per MEMORY.md standing rule).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const ComposerTagsBodySchema = z.object({
  hashtags: z.array(z.string().min(1).max(200)).min(0).max(50),
  keywords: z.array(z.string().min(1).max(200)).min(0).max(50),
  platformSpecific: z.record(z.string().min(0).max(400)),
});

export type ComposerTagsBody = z.infer<typeof ComposerTagsBodySchema>;

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

const SETTINGS_COLLECTION = 'settings';

function composerTagsDocId(platform: SocialPlatform): string {
  return `composer_tags_${platform}`;
}

interface ComposerTagsDoc {
  hashtags: string[];
  keywords: string[];
  platformSpecific: Record<string, string>;
  updatedAt: string;
  updatedBy: string;
}

const EMPTY_TAGS: Omit<ComposerTagsDoc, 'updatedAt' | 'updatedBy'> = {
  hashtags: [],
  keywords: [],
  platformSpecific: {},
};

async function readTags(platform: SocialPlatform): Promise<Omit<ComposerTagsDoc, 'updatedAt' | 'updatedBy'>> {
  const doc = await AdminFirestoreService.get<ComposerTagsDoc>(
    getSubCollection(SETTINGS_COLLECTION),
    composerTagsDocId(platform),
  );
  if (!doc) { return EMPTY_TAGS; }
  return {
    hashtags: doc.hashtags ?? [],
    keywords: doc.keywords ?? [],
    platformSpecific: doc.platformSpecific ?? {},
  };
}

async function writeTags(
  platform: SocialPlatform,
  tags: Omit<ComposerTagsDoc, 'updatedAt' | 'updatedBy'>,
  updatedBy: string,
): Promise<void> {
  const payload: ComposerTagsDoc = {
    ...tags,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await AdminFirestoreService.set(
    getSubCollection(SETTINGS_COLLECTION),
    composerTagsDocId(platform),
    payload,
  );
}

// ---------------------------------------------------------------------------
// Shared auth + rate-limit guard (same pattern as preferred-times/route.ts)
// ---------------------------------------------------------------------------

async function applyGuards(
  request: NextRequest,
): Promise<NextResponse | { user: { uid: string } }> {
  const rl = await rateLimitMiddleware(request, '/api/social/platforms/composer-tags');
  if (rl) { return rl; }

  const auth = await requireAuth(request);
  return auth;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard instanceof NextResponse) { return guard; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }

    const tags = await readTags(parsed.data.platform);
    return NextResponse.json({ success: true, ...tags });
  } catch (error: unknown) {
    logger.error(
      'Composer Tags API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load composer tags' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard instanceof NextResponse) { return guard; }

    const rawParams = await params;
    const parsedPlatform = PlatformSchema.safeParse(rawParams);
    if (!parsedPlatform.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }

    const body: unknown = await request.json();
    const parsedBody = ComposerTagsBodySchema.safeParse(body);
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
    const { hashtags, keywords, platformSpecific } = parsedBody.data;

    await writeTags(platform, { hashtags, keywords, platformSpecific }, guard.user.uid);

    logger.info('Composer Tags API: tags updated', {
      platform,
      hashtagCount: hashtags.length,
      keywordCount: keywords.length,
      userId: guard.user.uid,
    });

    return NextResponse.json({ success: true, hashtags, keywords, platformSpecific });
  } catch (error: unknown) {
    logger.error(
      'Composer Tags API: PUT failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update composer tags' },
      { status: 500 },
    );
  }
}
