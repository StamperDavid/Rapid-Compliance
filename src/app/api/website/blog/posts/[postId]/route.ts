/**
 * Individual Blog Post API
 * Get, update, delete a specific blog post
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { BlogPost } from '@/types/website';
import { logger } from '@/lib/logger/logger';

/**
 * GET /api/website/blog/posts/:postId
 * Get a specific blog post
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const postId = params.postId;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Get post document
    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId }
    );

    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const postData = postDoc.data() as BlogPost;

    // CRITICAL: Double-check organizationId matches
    if (postData.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      post: {
        id: postDoc.id,
        ...postData,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch blog post', error, {
      route: '/api/website/blog/posts/[postId]',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch post' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/website/blog/posts/:postId
 * Update a blog post
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const body = await request.json();
    const { organizationId, post } = body;
    const postId = params.postId;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Get existing post
    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId }
    );

    const existingPost = await postRef.get();

    if (!existingPost.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const existingData = existingPost.data();

    // CRITICAL: Verify post belongs to this org
    if (existingData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update post
    const updatedPost: BlogPost = {
      ...existingData,
      ...post,
      id: postId,
      organizationId, // CRITICAL: Ensure org doesn't change
      updatedAt: new Date().toISOString(),
    } as BlogPost;

    await postRef.set(updatedPost);

    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    logger.error('Failed to update blog post', error, {
      route: '/api/website/blog/posts/[postId]',
      method: 'PUT'
    });
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/website/blog/posts/:postId
 * Delete a blog post
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const postId = params.postId;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Get post to verify ownership
    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId }
    );

    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const postData = postDoc.data();

    // CRITICAL: Verify post belongs to this org
    if (postData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await postRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete blog post', error, {
      route: '/api/website/blog/posts/[postId]',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}


