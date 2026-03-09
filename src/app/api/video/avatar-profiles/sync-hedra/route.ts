/**
 * POST /api/video/avatar-profiles/sync-hedra
 *
 * Syncs CHARACTER elements from Hedra's library into the avatar profiles
 * system. Fetches all character elements (the Character tab at
 * hedra.com/app/library?assetType=elements), checks for existing profiles
 * with matching hedraAssetId, and creates new avatar profiles for any
 * unrecognized characters.
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

const HEDRA_BASE_URL = 'https://api.hedra.com/web-app';
const COLLECTION_PATH = `organizations/${PLATFORM_ID}/avatar_profiles`;
const PAGE_LIMIT = 100;

// ============================================================================
// Hedra Elements API Response Schema (Zod validation)
// ============================================================================

const HedraElementAssetSchema = z.object({
  id: z.string().min(1),
  asset_type: z.string(),
  description: z.string().nullable().optional(),
  media_id: z.string().nullable().optional(),
  media_url: z.string().url(),
  thumbnail_url: z.string().url().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  created_at: z.string().optional(),
});

const HedraCharacterElementSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.literal('CHARACTER'),
  visibility: z.string(),
  assets: z.array(HedraElementAssetSchema),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

const HedraElementsPageSchema = z.object({
  data: z.array(HedraCharacterElementSchema),
});

// ============================================================================
// Types derived from Zod schemas
// ============================================================================

type HedraCharacterElement = z.infer<typeof HedraCharacterElementSchema>;

// ============================================================================
// POST — Sync Hedra CHARACTER elements into avatar profiles
// ============================================================================

const SyncRequestSchema = z.object({
  characterIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const userId = String(user.uid);

    // -----------------------------------------------------------------------
    // 1. Parse request body — requires specific character IDs
    // -----------------------------------------------------------------------
    const body: unknown = await request.json();
    const bodyResult = SyncRequestSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { success: false, error: 'Request must include characterIds array' },
        { status: 400 }
      );
    }

    const { characterIds } = bodyResult.data;

    logger.info('Starting Hedra character import', {
      file: 'api/video/avatar-profiles/sync-hedra/route.ts',
      userId,
      requestedCount: characterIds.length,
    });

    // -----------------------------------------------------------------------
    // 2. Get Hedra API key from Firestore-stored settings
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
    // 3. Fetch CHARACTER elements from Hedra and filter to requested IDs
    // -----------------------------------------------------------------------
    const requestedIdSet = new Set(characterIds);
    const matchedCharacters: HedraCharacterElement[] = [];
    let offset = 0;

    while (true) {
      const url = `${HEDRA_BASE_URL}/elements?type=CHARACTER&limit=${PAGE_LIMIT}&offset=${offset}`;
      const hedraResponse = await fetch(url, {
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
          offset,
        });
        return NextResponse.json(
          { success: false, error: `Hedra API returned ${hedraResponse.status}: ${statusText}` },
          { status: 502 }
        );
      }

      const rawBody: unknown = await hedraResponse.json();
      const parseResult = HedraElementsPageSchema.safeParse(rawBody);

      if (!parseResult.success) {
        logger.error(
          'Failed to parse Hedra elements response',
          new Error(parseResult.error.message),
          {
            file: 'api/video/avatar-profiles/sync-hedra/route.ts',
            zodErrors: parseResult.error.errors.map((e) => e.message).join('; '),
            offset,
          }
        );
        return NextResponse.json(
          { success: false, error: 'Unexpected response format from Hedra API' },
          { status: 502 }
        );
      }

      const page = parseResult.data.data;
      if (page.length === 0) {break;}

      // Only keep the characters the user selected
      for (const character of page) {
        if (requestedIdSet.has(character.id)) {
          matchedCharacters.push(character);
        }
      }

      // Stop early if we found all requested characters
      if (matchedCharacters.length >= characterIds.length) {break;}
      if (page.length < PAGE_LIMIT) {break;}
      offset += PAGE_LIMIT;
    }

    if (matchedCharacters.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: 0,
        total: 0,
      });
    }

    logger.info('Matched Hedra character elements', {
      file: 'api/video/avatar-profiles/sync-hedra/route.ts',
      requested: characterIds.length,
      matched: matchedCharacters.length,
    });

    // -----------------------------------------------------------------------
    // 3. Check for existing profiles with matching hedraAssetIds
    // -----------------------------------------------------------------------
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // Use the character element ID as the dedup key
    const hedraElementIds = matchedCharacters.map((c) => c.id);

    // Firestore `in` queries support up to 30 values per query.
    const FIRESTORE_IN_LIMIT = 30;
    const existingAssetIds = new Set<string>();

    for (let i = 0; i < hedraElementIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = hedraElementIds.slice(i, i + FIRESTORE_IN_LIMIT);
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
    // 4. Create avatar profiles for NEW characters only
    // -----------------------------------------------------------------------
    let imported = 0;
    let skipped = 0;

    for (const character of matchedCharacters) {
      if (existingAssetIds.has(character.id)) {
        skipped++;
        continue;
      }

      // Find the image asset from the character's assets array
      const imageAsset = character.assets.find((a) => a.asset_type === 'image');
      if (!imageAsset) {
        logger.warn('Character element has no image asset, skipping', {
          file: 'api/video/avatar-profiles/sync-hedra/route.ts',
          characterId: character.id,
          characterName: character.name,
        });
        skipped++;
        continue;
      }

      // Format the name: convert slug-style to title case (e.g. "man-1" -> "Man 1")
      const profileName = character.name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const result = await createAvatarProfile(userId, {
        name: profileName,
        frontalImageUrl: imageAsset.media_url,
        hedraAssetId: character.id,
        description: character.description ?? null,
      });

      if (result.success) {
        imported++;
        logger.info('Imported Hedra character as avatar profile', {
          file: 'api/video/avatar-profiles/sync-hedra/route.ts',
          hedraAssetId: character.id,
          profileId: result.profile?.id,
          profileName,
        });
      } else {
        logger.error(
          'Failed to import Hedra character',
          new Error(result.error ?? 'Unknown error'),
          {
            file: 'api/video/avatar-profiles/sync-hedra/route.ts',
            hedraAssetId: character.id,
          }
        );
      }
    }

    logger.info('Hedra character import complete', {
      file: 'api/video/avatar-profiles/sync-hedra/route.ts',
      userId,
      imported,
      skipped,
      total: matchedCharacters.length,
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: matchedCharacters.length,
    });
  } catch (error) {
    logger.error(
      'Hedra character sync failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/sync-hedra/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to sync Hedra characters' },
      { status: 500 }
    );
  }
}
