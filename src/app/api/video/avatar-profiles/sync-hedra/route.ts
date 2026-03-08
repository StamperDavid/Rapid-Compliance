/**
 * POST /api/video/avatar-profiles/sync-hedra
 *
 * Syncs image assets from the user's Hedra account into the avatar profiles
 * system. Fetches all image assets from Hedra, checks for existing profiles
 * with matching hedraAssetId, and creates new avatar profiles for any
 * unrecognized assets.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { adminDb } from '@/lib/firebase/admin';
import { createAvatarProfile } from '@/lib/video/avatar-profile-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// Constants
// ============================================================================

const HEDRA_BASE_URL = 'https://api.hedra.com/web-app/public';
const COLLECTION_PATH = `organizations/${PLATFORM_ID}/avatar_profiles`;

// ============================================================================
// Hedra API Response Schema (Zod validation)
// ============================================================================

const HedraAssetInnerSchema = z.object({
  type: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  url: z.string().url(),
});

const HedraImageAssetSchema = z.object({
  id: z.string().min(1),
  type: z.literal('image'),
  name: z.string().nullable().default(null),
  thumbnail_url: z.string().url().nullable().default(null),
  asset: HedraAssetInnerSchema,
  created_at: z.string(),
});

const HedraAssetsResponseSchema = z.array(HedraImageAssetSchema);

// ============================================================================
// Types derived from Zod schemas
// ============================================================================

type HedraImageAsset = z.infer<typeof HedraImageAssetSchema>;

// ============================================================================
// POST — Sync Hedra image assets into avatar profiles
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const userId = String(user.uid);

    logger.info('Starting Hedra avatar sync', {
      file: 'api/video/avatar-profiles/sync-hedra/route.ts',
      userId,
    });

    // -----------------------------------------------------------------------
    // 1. Get Hedra API key from Firestore-stored settings
    // -----------------------------------------------------------------------
    const hedraKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');

    if (typeof hedraKey !== 'string' || hedraKey.length === 0) {
      logger.warn('Hedra API key not configured', {
        file: 'api/video/avatar-profiles/sync-hedra/route.ts',
      });
      return NextResponse.json(
        { success: false, error: 'Hedra API key not configured. Add it in Settings > API Keys.' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Fetch all image assets from Hedra
    // -----------------------------------------------------------------------
    const hedraResponse = await fetch(`${HEDRA_BASE_URL}/assets?type=image`, {
      method: 'GET',
      headers: {
        'x-api-key': hedraKey,
        'Accept': 'application/json',
      },
    });

    if (!hedraResponse.ok) {
      const statusText = hedraResponse.statusText || 'Unknown error';
      logger.error('Hedra API request failed', new Error(`${hedraResponse.status} ${statusText}`), {
        file: 'api/video/avatar-profiles/sync-hedra/route.ts',
        status: hedraResponse.status,
      });
      return NextResponse.json(
        { success: false, error: `Hedra API returned ${hedraResponse.status}: ${statusText}` },
        { status: 502 }
      );
    }

    const rawBody: unknown = await hedraResponse.json();
    const parseResult = HedraAssetsResponseSchema.safeParse(rawBody);

    if (!parseResult.success) {
      logger.error(
        'Failed to parse Hedra assets response',
        new Error(parseResult.error.message),
        {
          file: 'api/video/avatar-profiles/sync-hedra/route.ts',
          zodErrors: parseResult.error.errors.map((e) => e.message).join('; '),
        }
      );
      return NextResponse.json(
        { success: false, error: 'Unexpected response format from Hedra API' },
        { status: 502 }
      );
    }

    const hedraAssets: HedraImageAsset[] = parseResult.data;

    if (hedraAssets.length === 0) {
      logger.info('No Hedra image assets found', {
        file: 'api/video/avatar-profiles/sync-hedra/route.ts',
        userId,
      });
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: 0,
        total: 0,
      });
    }

    // -----------------------------------------------------------------------
    // 3. Check for existing profiles with matching hedraAssetIds
    // -----------------------------------------------------------------------
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // Collect all Hedra asset IDs for a batch existence check
    const hedraAssetIds = hedraAssets.map((a) => a.id);

    // Firestore `in` queries support up to 30 values per query.
    // Batch the IDs into chunks of 30 for the dedup check.
    const FIRESTORE_IN_LIMIT = 30;
    const existingAssetIds = new Set<string>();

    for (let i = 0; i < hedraAssetIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = hedraAssetIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const snapshot = await adminDb
        .collection(COLLECTION_PATH)
        .where('hedraAssetId', 'in', chunk)
        .get();

      for (const doc of snapshot.docs) {
        const docData = doc.data() as { hedraAssetId?: unknown };
        const existingId = docData.hedraAssetId;
        if (typeof existingId === 'string') {
          existingAssetIds.add(existingId);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Create avatar profiles for NEW assets only
    // -----------------------------------------------------------------------
    let imported = 0;
    let skipped = 0;

    for (const asset of hedraAssets) {
      if (existingAssetIds.has(asset.id)) {
        skipped++;
        continue;
      }

      const profileName = asset.name && asset.name.trim().length > 0
        ? asset.name.trim()
        : 'Hedra Avatar';

      const result = await createAvatarProfile(userId, {
        name: profileName,
        frontalImageUrl: asset.asset.url,
        preferredEngine: 'hedra',
        hedraAssetId: asset.id,
      });

      if (result.success) {
        imported++;
        logger.info('Imported Hedra asset as avatar profile', {
          file: 'api/video/avatar-profiles/sync-hedra/route.ts',
          hedraAssetId: asset.id,
          profileId: result.profile?.id,
          profileName,
        });
      } else {
        logger.error(
          'Failed to import Hedra asset',
          new Error(result.error ?? 'Unknown error'),
          {
            file: 'api/video/avatar-profiles/sync-hedra/route.ts',
            hedraAssetId: asset.id,
          }
        );
      }
    }

    logger.info('Hedra avatar sync complete', {
      file: 'api/video/avatar-profiles/sync-hedra/route.ts',
      userId,
      imported,
      skipped,
      total: hedraAssets.length,
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: hedraAssets.length,
    });
  } catch (error) {
    logger.error(
      'Hedra avatar sync failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/sync-hedra/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to sync Hedra avatars' },
      { status: 500 }
    );
  }
}
