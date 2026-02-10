/**
 * Website Pages API
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface PageSEO {
  title?: string;
  description?: string;
  keywords?: string[];
}

interface PageData {
  id: string;
  title: string;
  slug: string;
  status: string;
  content: unknown[];
  seo: PageSEO;
  version: number;
  createdAt: FieldValue;
  updatedAt: FieldValue;
  createdBy: string;
  lastEditedBy: string;
}

interface RequestBody {
  page?: {
    id?: string;
    title?: string;
    slug?: string;
    status?: string;
    content?: unknown[];
    seo?: PageSEO;
  };
}

/**
 * GET /api/website/pages
 * List all pages for an organization
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status'); // Filter by status

    const pagesRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/pages/items`
    );

    // Build query with optional status filter
    let snapshot;
    if (status) {
      snapshot = await pagesRef
        .where('status', '==', status)
        .orderBy('updatedAt', 'desc')
        .get();
    } else {
      snapshot = await pagesRef
        .orderBy('updatedAt', 'desc')
        .get();
    }

    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      pages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Website Pages API] GET error', error instanceof Error ? error : new Error(String(error)), { route: '/api/website/pages' });
    return NextResponse.json(
      { error: 'Failed to fetch pages', details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/pages
 * Create a new page
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json() as RequestBody;
    const { page } = body;

    if (!page) {
      return NextResponse.json(
        { error: 'page object is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!page.title || !page.slug) {
      return NextResponse.json(
        { error: 'title and slug are required' },
        { status: 400 }
      );
    }

    const performedBy = await getUserIdentifier();
    const pageId = (page.id !== '' && page.id != null) ? page.id : `page_${Date.now()}`;

    const pageData: PageData = {
      ...page,
      id: pageId,
      title: page.title,
      slug: page.slug,
      status: (page.status !== '' && page.status != null) ? page.status : 'draft',
      content: page.content ?? [],
      seo: page.seo ?? {},
      version: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: performedBy,
      lastEditedBy: performedBy,
    };

    // Check if slug already exists for this org
    const pagesRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/pages/items`
    );
    const existingPageQuery = await pagesRef
      .where('slug', '==', page.slug)
      .limit(1)
      .get();

    if (!existingPageQuery.empty) {
      return NextResponse.json(
        { error: 'A page with this slug already exists' },
        { status: 409 }
      );
    }

    const pageRef = pagesRef.doc(pageId);
    await pageRef.set(pageData);

    return NextResponse.json({
      success: true,
      page: pageData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Website Pages API] POST error', error instanceof Error ? error : new Error(String(error)), { route: '/api/website/pages' });
    return NextResponse.json(
      { error: 'Failed to create page', details: message },
      { status: 500 }
    );
  }
}
