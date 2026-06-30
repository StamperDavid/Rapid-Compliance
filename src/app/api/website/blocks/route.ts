/**
 * Website Builder — Saved Blocks API
 *
 * Org-scoped store for reusable section "blocks" the operator saved from the
 * website editor. A block is a `PageSection` (its columns + widgets) plus a
 * name + category, so it can be re-inserted into any page.
 *
 * Doc path: `${getSubCollection('website')}/blocks/items` — a dedicated store
 * separate from `.../website/pages/items` and `.../website/chrome`.
 *
 * Auth: Bearer, same `requireAuth` pattern as the sibling website routes.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdentifier } from '@/lib/server-auth';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const BLOCKS_COLLECTION_PATH = `${getSubCollection('website')}/blocks/items`;

const BLOCK_CATEGORIES = [
  'hero',
  'features',
  'pricing',
  'testimonials',
  'cta',
  'stats',
  'logos',
  'faq',
  'contact',
  'content',
  'footer',
] as const;

/**
 * Validate the ESSENTIAL `PageSection` shape (id / literal type / columns
 * array) while preserving the full structure via `.passthrough()`, so the
 * stored section is exactly what the editor produced.
 */
const SectionSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('section'),
    columns: z.array(z.unknown()),
  })
  .passthrough();

const PostBlockSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(BLOCK_CATEGORIES),
  section: SectionSchema,
});

/**
 * GET /api/website/blocks
 * List the org's saved blocks (newest first).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const blocksRef = adminDal.getNestedCollection(BLOCKS_COLLECTION_PATH);
    const snapshot = await blocksRef.orderBy('createdAt', 'desc').get();

    const blocks = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        name: data.name,
        category: data.category,
        section: data.section,
      };
    });

    return NextResponse.json({ success: true, blocks });
  } catch (error) {
    logger.error(
      '[Website Blocks API] GET error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/website/blocks' },
    );
    return NextResponse.json({ error: 'Failed to load saved blocks' }, { status: 500 });
  }
}

/**
 * POST /api/website/blocks
 * Save a section as a new reusable block.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const rawBody: unknown = await request.json();
    const parsed = PostBlockSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid block', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, category, section } = parsed.data;
    const performedBy = await getUserIdentifier();
    const blockId = `block_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const blocksRef = adminDal.getNestedCollection(BLOCKS_COLLECTION_PATH);
    await blocksRef.doc(blockId).set({
      id: blockId,
      name,
      category,
      section,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: performedBy,
    });

    return NextResponse.json({
      success: true,
      block: { id: blockId, name, category, section },
    });
  } catch (error) {
    logger.error(
      '[Website Blocks API] POST error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/website/blocks' },
    );
    return NextResponse.json({ error: 'Failed to save block' }, { status: 500 });
  }
}
