/**
 * Page Preview API
 * Generate shareable preview links and retrieve preview data
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';
import { getUserIdentifier } from '@/lib/server-auth';

/**
 * POST /api/website/pages/[pageId]/preview
 * Generate a preview token for a page
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { organizationId, expiresIn } = body; // expiresIn in hours, default 24

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const pageRef = db
      .collection('organizations')
      .doc(organizationId)
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
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Generate preview token
    const previewToken = randomBytes(32).toString('hex');
    const expiresInHours = expiresIn || 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Store preview token
    const createdBy = await getUserIdentifier();
    
    const previewRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('preview-tokens')
      .collection('tokens')
      .doc(previewToken);

    await previewRef.set({
      pageId: params.pageId,
      organizationId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdBy,
    });

    // Generate preview URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const previewUrl = `${baseUrl}/preview/${previewToken}`;

    return NextResponse.json({
      success: true,
      previewToken,
      previewUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[Page Preview API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error.message },
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
    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');
    const token = searchParams.get('token');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Preview token is required' },
        { status: 400 }
      );
    }

    // Verify preview token
    const tokenRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('preview-tokens')
      .collection('tokens')
      .doc(token);

    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid preview token' },
        { status: 403 }
      );
    }

    const tokenData = tokenDoc.data();

    // Check if token matches the page
    if (tokenData?.pageId !== params.pageId) {
      return NextResponse.json(
        { error: 'Preview token does not match page' },
        { status: 403 }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expiresAt);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Preview token has expired' },
        { status: 403 }
      );
    }

    // Get the page data
    const pageRef = db
      .collection('organizations')
      .doc(organizationId)
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
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      page: {
        id: doc.id,
        ...pageData,
      },
      isPreview: true,
    });
  } catch (error: any) {
    console.error('[Page Preview API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preview', details: error.message },
      { status: 500 }
    );
  }
}

