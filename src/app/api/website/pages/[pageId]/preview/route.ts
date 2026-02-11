/**
 * Page Preview API
 * Generate shareable preview links and retrieve preview data
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { randomBytes } from 'crypto';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

type PageData = Record<string, never>;

interface TokenData {
  pageId: string;
  expiresAt: string;
}

interface RequestBody {
  expiresIn?: number;
}

/**
 * POST /api/website/pages/[pageId]/preview
 * Generate a preview token for a page
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const body = await request.json() as RequestBody;
    const { expiresIn } = body; // expiresIn in hours, default 24

    const pageRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/pages/items/{pageId}`,
      { pageId: params.pageId }
    );

    const doc = await pageRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Generate preview token
    const previewToken = randomBytes(32).toString('hex');
    const expiresInHours = expiresIn ?? 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Store preview token
    const createdBy = await getUserIdentifier();

    const previewRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/preview-tokens/tokens/{token}`,
      { token: previewToken }
    );

    await previewRef.set({
      pageId: params.pageId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdBy,
    });

    // Generate preview URL
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL !== '' && process.env.NEXT_PUBLIC_APP_URL != null) ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000';
    const previewUrl = `${baseUrl}/preview/${previewToken}`;

    return NextResponse.json({
      success: true,
      previewToken,
      previewUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to generate page preview', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/pages/[pageId]/preview',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to generate preview', details: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/website/pages/[pageId]/preview
 * Get preview data (used by preview page)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Preview token is required' },
        { status: 400 }
      );
    }

    // Verify preview token
    const tokenRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/preview-tokens/tokens/{token}`,
      { token }
    );

    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid preview token' },
        { status: 403 }
      );
    }

    const tokenData = tokenDoc.data() as TokenData | undefined;

    // Check if token matches the page
    if (tokenData?.pageId !== params.pageId) {
      return NextResponse.json(
        { error: 'Preview token does not match page' },
        { status: 403 }
      );
    }

    // Check if token is expired
    const expiresAtStr = tokenData.expiresAt;
    const expiresAt = new Date(expiresAtStr);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Preview token has expired' },
        { status: 403 }
      );
    }

    // Get the page data
    const pageRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/pages/items/{pageId}`,
      { pageId: params.pageId }
    );

    const doc = await pageRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = doc.data() as PageData | undefined;

    return NextResponse.json({
      success: true,
      page: {
        id: doc.id,
        ...pageData,
      },
      isPreview: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch page preview', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/pages/[pageId]/preview',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch preview', details: message },
      { status: 500 }
    );
  }
}
