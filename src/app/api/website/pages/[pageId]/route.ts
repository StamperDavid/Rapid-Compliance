/**
 * Single Page API
 * CRITICAL: Multi-tenant isolation - validates organizationId on every request
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { getUserIdentifier } from '@/lib/server-auth';

/**
 * GET /api/website/pages/[pageId]
 * Get a single page
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
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

    // TODO: Add user authentication
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const pageRef = db
      .collection('organizations')
      .doc(organizationId) // ← SCOPED to this org
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId);

    const doc = await pageRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = doc.data();

    // CRITICAL: Double-check organizationId matches
    if (pageData?.organizationId !== organizationId) {
      console.error('[SECURITY] organizationId mismatch!', {
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
  } catch (error: any) {
    console.error('[Website Pages API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page', details: error.message },
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
    const params = await context.params;
    const body = await request.json();
    const { organizationId, page } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // TODO: Add user authentication
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }
    // if (!hasPermission(user, 'manage_website')) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const pageRef = db
      .collection('organizations')
      .doc(organizationId) // ← SCOPED to this org
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId);

    const existingDoc = await pageRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const existingData = existingDoc.data();

    // CRITICAL: Verify organizationId matches
    if (existingData?.organizationId !== organizationId) {
      console.error('[SECURITY] Attempted cross-org page update!', {
        requested: organizationId,
        actual: existingData?.organizationId,
        pageId: params.pageId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const now = admin.firestore.Timestamp.now();

    // CRITICAL: Cannot change organizationId
    const updatedData = {
      ...page,
      organizationId: existingData.organizationId, // ← Keep original orgId
      id: params.pageId,
      updatedAt: now,
      lastEditedBy: 'system', // TODO: Use actual user ID
      version: (existingData.version || 1) + 1,
    };

    await pageRef.set(updatedData, { merge: true });

    return NextResponse.json({
      success: true,
      page: updatedData,
    });
  } catch (error: any) {
    console.error('[Website Pages API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update page', details: error.message },
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

    // TODO: Add user authentication
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }
    // if (!hasPermission(user, 'manage_website')) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const pageRef = db
      .collection('organizations')
      .doc(organizationId) // ← SCOPED to this org
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId);

    const doc = await pageRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = doc.data();

    // CRITICAL: Verify organizationId matches
    if (pageData?.organizationId !== organizationId) {
      console.error('[SECURITY] Attempted cross-org page deletion!', {
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
  } catch (error: any) {
    console.error('[Website Pages API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete page', details: error.message },
      { status: 500 }
    );
  }
}

