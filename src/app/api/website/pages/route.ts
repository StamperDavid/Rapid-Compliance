/**
 * Website Pages API
 * CRITICAL: Multi-tenant isolation - validates organizationId on every request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require('@/../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    // Already initialized
  }
}

const db = getFirestore();

/**
 * GET /api/website/pages
 * List all pages for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status'); // Filter by status

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

    let query = db
      .collection('organizations')
      .doc(organizationId) // ← SCOPED to this org only
      .collection('website')
      .doc('pages')
      .collection('items');

    // Filter by status if provided
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.orderBy('updatedAt', 'desc').get();

    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      pages,
    });
  } catch (error: any) {
    console.error('[Website Pages API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pages', details: error.message },
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
    const body = await request.json();
    const { organizationId, page } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

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

    // TODO: Add user authentication
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }
    // if (!hasPermission(user, 'manage_website')) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const now = admin.firestore.Timestamp.now();
    const pageId = page.id || `page_${Date.now()}`;

    // CRITICAL: Force organizationId to match the authenticated org
    const pageData = {
      ...page,
      id: pageId,
      organizationId, // ← Force correct organizationId
      status: page.status || 'draft',
      content: page.content || [],
      seo: page.seo || {},
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system', // TODO: Use actual user ID
      lastEditedBy: 'system',
    };

    // Check if slug already exists for this org
    const existingPageQuery = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .where('slug', '==', page.slug)
      .limit(1)
      .get();

    if (!existingPageQuery.empty) {
      return NextResponse.json(
        { error: 'A page with this slug already exists' },
        { status: 409 }
      );
    }

    const pageRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(pageId);

    await pageRef.set(pageData);

    return NextResponse.json({
      success: true,
      page: pageData,
    });
  } catch (error: any) {
    console.error('[Website Pages API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create page', details: error.message },
      { status: 500 }
    );
  }
}

