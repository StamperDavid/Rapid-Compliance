/**
 * Public, read-only "get a PUBLISHED page by slug" endpoint.
 *
 * This is how the live (public) marketing pages read a page the operator built +
 * PUBLISHED in the visual editor, so the editor edits the real pages. It is
 * deliberately:
 *   - UNAUTHENTICATED (public visitors hit it) — but read-only.
 *   - PUBLISHED-ONLY — it never returns a draft, so unpublished/test pages can
 *     never appear on the live site.
 *   - SLUG-SCOPED — returns exactly the page for that URL, or 404.
 *
 * Reads the same canonical store the editor saves to (`website/pages/items`).
 * If there is no published page for the slug, callers fall back to the page's
 * existing built-in content — so a live page is unchanged until the operator
 * publishes an edit for it.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    if (slug === null || slug.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
    }
    if (!adminDal) {
      // Fail safe: report "no published page" so callers render their fallback.
      return NextResponse.json({ success: true, page: null }, { status: 200 });
    }

    const pagesRef = adminDal.getNestedCollection(`${getSubCollection('website')}/pages/items`);

    const queryPublishedBySlug = async (
      slugValue: string,
    ): Promise<({ id: string } & Record<string, unknown>) | null> => {
      const snap = await pagesRef
        .where('slug', '==', slugValue)
        .where('status', '==', 'published')
        .get();
      const doc = snap.docs[0];
      return doc ? { id: doc.id, ...doc.data() } : null;
    };

    let page = await queryPublishedBySlug(slug);
    // Home/default: the root may store its slug as '' or 'home'.
    if (!page && (slug === 'home' || slug === '')) {
      page = await queryPublishedBySlug(slug === 'home' ? '' : 'home');
    }

    return NextResponse.json({ success: true, page }, { status: 200 });
  } catch (error) {
    logger.error(
      'Public website-page read failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/public/website-page' },
    );
    // Never break the live page: report "no published page" so it falls back.
    return NextResponse.json({ success: true, page: null }, { status: 200 });
  }
}
