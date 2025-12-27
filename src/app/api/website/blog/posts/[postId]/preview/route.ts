/**
 * Blog Post Preview API
 * Generate shareable preview links for blog posts
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';
import { getUserIdentifier } from '@/lib/server-auth';

/**
 * POST /api/website/blog/posts/[postId]/preview
 * Generate a preview token for a blog post
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
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

    const postRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('blog-posts')
      .doc(params.postId);

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data();

    // CRITICAL: Verify organizationId matches
    if (postData?.organizationId !== organizationId) {
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
    const performedBy = await getUserIdentifier();
    
    const tokenRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('preview-tokens')
      .collection('tokens')
      .doc(previewToken);

    await tokenRef.set({
      postId: params.postId,
      type: 'blog-post',
      organizationId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdBy: performedBy,
    });

    // Generate preview URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const previewUrl = `${baseUrl}/preview/blog/${previewToken}`;

    return NextResponse.json({
      success: true,
      previewToken,
      previewUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[Blog Post Preview API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/website/blog/posts/[postId]/preview
 * Get blog post preview data
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
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

    // Check if token matches the post
    if (tokenData?.postId !== params.postId) {
      return NextResponse.json(
        { error: 'Preview token does not match post' },
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

    // Get the post data
    const postRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('blog-posts')
      .doc(params.postId);

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data();

    // CRITICAL: Verify organizationId matches
    if (postData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      post: {
        id: doc.id,
        ...postData,
      },
      isPreview: true,
    });
  } catch (error: any) {
    console.error('[Blog Post Preview API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preview', details: error.message },
      { status: 500 }
    );
  }
}

