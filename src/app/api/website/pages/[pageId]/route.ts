/**
 * Single Page API
 * CRITICAL: Multi-tenant isolation - validates organizationId on every request
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

interface PageData {
  organizationId: string;
  version?: number;
}

interface RequestBody {
  organizationId?: string;
  page?: Record<string, unknown>;
}

/**
 * GET /api/website/pages/[pageId]
 * Get a single page
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const pageRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}',
      { orgId: organizationId, pageId: params.pageId }
    );

    const doc = await pageRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = doc.data() as PageData | undefined;

    // CRITICAL: Double-check organizationId matches
    if (pageData?.organizationId !== organizationId) {
      logger.error('[SECURITY] organizationId mismatch', new Error('Cross-org page access attempt'), {
        route: '/api/website/pages/[pageId]',
        method: 'GET',
        requested: organizationId,
        actual: pageData?.organizationId,
        pageId: params.pageId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      page: { id: doc.id, ...pageData },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch page', error, {
      route: '/api/website/pages/[pageId]',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch page', details: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/website/pages/[pageId]
 * Update a page
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const body = await request.json() as RequestBody;
    const { organizationId, page } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const pageRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}',
      { orgId: organizationId, pageId: params.pageId }
    );

    const existingDoc = await pageRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const existingData = existingDoc.data() as PageData | undefined;

    if (!existingData) {
      return NextResponse.json(
        { error: 'Page data not found' },
        { status: 404 }
      );
    }

    // CRITICAL: Verify organizationId matches
    if (existingData.organizationId !== organizationId) {
      logger.error('[SECURITY] Attempted cross-org page update', new Error('Cross-org page update attempt'), {
        route: '/api/website/pages/[pageId]',
        method: 'PUT',
        requested: organizationId,
        actual: existingData.organizationId,
        pageId: params.pageId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const performedBy = await getUserIdentifier();

    // CRITICAL: Cannot change organizationId
    const updatedData = {
      ...page,
      organizationId: existingData.organizationId, // ← Keep original orgId
      id: params.pageId,
      updatedAt: FieldValue.serverTimestamp(),
      lastEditedBy: performedBy,
      version: (existingData.version ?? 1) + 1,
    };

    await pageRef.set(updatedData, { merge: true });

    return NextResponse.json({
      success: true,
      page: updatedData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update page', error, {
      route: '/api/website/pages/[pageId]',
      method: 'PUT'
    });
    return NextResponse.json(
      { error: 'Failed to update page', details: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/website/pages/[pageId]
 * Delete a page
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const pageRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}',
      { orgId: organizationId, pageId: params.pageId }
    );

    const doc = await pageRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = doc.data() as PageData | undefined;

    // CRITICAL: Verify organizationId matches
    if (pageData?.organizationId !== organizationId) {
      logger.error('[SECURITY] Attempted cross-org page deletion', new Error('Cross-org page delete attempt'), {
        route: '/api/website/pages/[pageId]',
        method: 'DELETE',
        requested: organizationId,
        actual: pageData?.organizationId,
        pageId: params.pageId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await pageRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete page', error, {
      route: '/api/website/pages/[pageId]',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to delete page', details: message },
      { status: 500 }
    );
  }
}
