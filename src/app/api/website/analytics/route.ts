/**
 * Website Analytics API
 *
 * Returns real Firestore counts for content-side analytics (pages, blog
 * posts, forms). Traffic-source data (visitors, sessions, top pages by
 * views) is intentionally NOT included — that requires a connected
 * traffic source (GA4 / Plausible / Vercel Analytics), which the
 * platform does not yet integrate. The page renders an honest "connect
 * a traffic source" empty state for those sections.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import {
  getSubCollection,
  getBlogPostsCollection,
  getFormsCollection,
} from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface AnalyticsResponse {
  pageCount: number;
  publishedPageCount: number;
  draftPageCount: number;
  blogPostCount: number;
  formCount: number;
  generatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const pagesRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/pages/items`
    );
    const blogRef = AdminFirestoreService.collection(getBlogPostsCollection());
    const formsRef = AdminFirestoreService.collection(getFormsCollection());

    const [
      pageCountSnap,
      publishedSnap,
      draftSnap,
      blogCountSnap,
      formCountSnap,
    ] = await Promise.all([
      pagesRef.count().get(),
      pagesRef.where('status', '==', 'published').count().get(),
      pagesRef.where('status', '==', 'draft').count().get(),
      blogRef.count().get(),
      formsRef.count().get(),
    ]);

    const body: AnalyticsResponse = {
      pageCount: pageCountSnap.data().count,
      publishedPageCount: publishedSnap.data().count,
      draftPageCount: draftSnap.data().count,
      blogPostCount: blogCountSnap.data().count,
      formCount: formCountSnap.data().count,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(body);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load website analytics';
    logger.error(
      'Failed to load website analytics:',
      error instanceof Error ? error : undefined
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
