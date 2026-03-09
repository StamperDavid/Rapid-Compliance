/**
 * GET /api/video/avatar-profiles/hedra-characters
 *
 * Fetches CHARACTER elements from Hedra's library for browsing/selection.
 * Returns all available characters with their image URLs so the user can
 * pick which ones to import as avatar profiles.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// ============================================================================
// Constants
// ============================================================================

const HEDRA_BASE_URL = 'https://api.hedra.com/web-app';
const COLLECTION_PATH = `organizations/${PLATFORM_ID}/avatar_profiles`;
const PAGE_LIMIT = 100;

// ============================================================================
// Hedra Elements API Response Schema
// ============================================================================

const HedraElementAssetSchema = z.object({
  id: z.string().min(1),
  asset_type: z.string(),
  description: z.string().nullable().optional(),
  media_url: z.string().url(),
  thumbnail_url: z.string().url().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
});

const HedraCharacterElementSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.literal('CHARACTER'),
  visibility: z.string(),
  assets: z.array(HedraElementAssetSchema),
  created_at: z.string(),
});

const HedraElementsPageSchema = z.object({
  data: z.array(HedraCharacterElementSchema),
});

// ============================================================================
// GET — Browse Hedra CHARACTER elements
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // -----------------------------------------------------------------------
    // 1. Get Hedra API key
    // -----------------------------------------------------------------------
    const hedraKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');

    if (typeof hedraKey !== 'string' || hedraKey.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Hedra API key not configured. Add it in Settings > API Keys.' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Fetch all CHARACTER elements (paginated)
    // -----------------------------------------------------------------------
    type CharacterElement = z.infer<typeof HedraCharacterElementSchema>;

    const allCharacters: CharacterElement[] = [];
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
          file: 'api/video/avatar-profiles/hedra-characters/route.ts',
          status: hedraResponse.status,
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
          { file: 'api/video/avatar-profiles/hedra-characters/route.ts' }
        );
        return NextResponse.json(
          { success: false, error: 'Unexpected response format from Hedra API' },
          { status: 502 }
        );
      }

      const page = parseResult.data.data;
      if (page.length === 0) {break;}

      allCharacters.push(...page);
      if (page.length < PAGE_LIMIT) {break;}
      offset += PAGE_LIMIT;
    }

    // -----------------------------------------------------------------------
    // 3. Check which ones are already imported
    // -----------------------------------------------------------------------
    const alreadyImportedIds = new Set<string>();

    if (adminDb && allCharacters.length > 0) {
      const FIRESTORE_IN_LIMIT = 30;
      const allIds = allCharacters.map((c) => c.id);

      for (let i = 0; i < allIds.length; i += FIRESTORE_IN_LIMIT) {
        const chunk = allIds.slice(i, i + FIRESTORE_IN_LIMIT);
        const snapshot = await adminDb
          .collection(COLLECTION_PATH)
          .where('hedraAssetId', 'in', chunk)
          .get();

        for (const doc of snapshot.docs) {
          const docData = doc.data() as { hedraAssetId?: unknown };
          if (typeof docData.hedraAssetId === 'string') {
            alreadyImportedIds.add(docData.hedraAssetId);
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Return characters with import status
    // -----------------------------------------------------------------------
    const characters = allCharacters.map((c) => {
      const imageAsset = c.assets.find((a) => a.asset_type === 'image');
      return {
        id: c.id,
        name: c.name
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        rawName: c.name,
        description: c.description ?? null,
        imageUrl: imageAsset?.media_url ?? null,
        thumbnailUrl: imageAsset?.thumbnail_url ?? null,
        alreadyImported: alreadyImportedIds.has(c.id),
      };
    });

    return NextResponse.json({
      success: true,
      characters,
      total: characters.length,
      alreadyImported: alreadyImportedIds.size,
    });
  } catch (error) {
    logger.error(
      'Failed to fetch Hedra characters',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/hedra-characters/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to fetch Hedra characters' },
      { status: 500 }
    );
  }
}
