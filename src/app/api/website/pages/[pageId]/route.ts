/**
 * Single Page API
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

interface PageData {
  version?: number;
}

interface RequestBody {
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

    const pageRef = adminDal.getNestedDocRef(
      'organizations/rapid-compliance-root/website/pages/items/{pageId}',
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
      page: { id: doc.id, ...pageData },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch page', error instanceof Error ? error : new Error(String(error)), {
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
    const { page } = body;

    const pageRef = adminDal.getNestedDocRef(
      'organizations/rapid-compliance-root/website/pages/items/{pageId}',
      { pageId: params.pageId }
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

    const performedBy = await getUserIdentifier();

    const updatedData = {
      ...page,
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
    logger.error('Failed to update page', error instanceof Error ? error : new Error(String(error)), {
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

    const pageRef = adminDal.getNestedDocRef(
      'organizations/rapid-compliance-root/website/pages/items/{pageId}',
      { pageId: params.pageId }
    );

    const doc = await pageRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    await pageRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete page', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/pages/[pageId]',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to delete page', details: message },
      { status: 500 }
    );
  }
}
