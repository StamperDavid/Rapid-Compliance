/**
 * Blog Post Publishing API
 * Handle publish/unpublish actions for blog posts
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

/**
 * POST /api/website/blog/posts/[postId]/publish
 * Publish a blog post (make it live)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const body = await request.json();
    const { organizationId, scheduledFor } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId: params.postId }
    );

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data();

    if (!postData) {
      return NextResponse.json(
        { error: 'Blog post data not found' },
        { status: 404 }
      );
    }

    // CRITICAL: Verify organizationId matches
    if (postData.organizationId !== organizationId) {
      logger.error('[SECURITY] organizationId mismatch on blog publish', new Error('Cross-org blog publish attempt'), {
        route: '/api/website/blog/posts/[postId]/publish',
        method: 'POST',
        requested: organizationId,
        actual: postData.organizationId,
        postId: params.postId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const performedBy = await getUserIdentifier();

    // Update data
    const updateData: any = {
      updatedAt: now,
      lastEditedBy: performedBy,
    };

    if (scheduledFor) {
      // Schedule for future publishing
      const scheduledDate = new Date(scheduledFor);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: 'Scheduled date must be in the future' },
          { status: 400 }
        );
      }
      updateData.status = 'scheduled';
      updateData.scheduledFor = scheduledFor;
    } else {
      // Publish immediately
      updateData.status = 'published';
      updateData.publishedAt = now;
      // Remove scheduledFor if it exists
      if (postData.scheduledFor) {
        updateData.scheduledFor = null;
      }
    }

    await postRef.update(updateData);

    // Create audit log entry
    const auditRef = adminDal.getNestedCollection(
      'organizations/{orgId}/website/audit-log/entries',
      { orgId: organizationId }
    );

    await auditRef.add({
      type: scheduledFor ? 'blog_post_scheduled' : 'blog_post_published',
      postId: params.postId,
      postTitle: postData.title,
      scheduledFor: scheduledFor || null,
      performedBy,
      performedAt: now,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      status: updateData.status,
      publishedAt: updateData.publishedAt,
      scheduledFor: updateData.scheduledFor,
      message: scheduledFor
        ? `Post scheduled for ${scheduledFor}`
        : 'Post published successfully',
    });
  } catch (error: any) {
    logger.error('Failed to publish blog post', error, {
      route: '/api/website/blog/posts/[postId]/publish',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to publish post', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/website/blog/posts/[postId]/publish
 * Unpublish a blog post (revert to draft)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
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

    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId: params.postId }
    );

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
      logger.error('[SECURITY] organizationId mismatch on blog unpublish', new Error('Cross-org blog unpublish attempt'), {
        route: '/api/website/blog/posts/[postId]/publish',
        method: 'DELETE',
        requested: organizationId,
        actual: postData?.organizationId,
        postId: params.postId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const performedBy = await getUserIdentifier();

    // Unpublish - revert to draft
    await postRef.update({
      status: 'draft',
      scheduledFor: null,
      updatedAt: now,
      lastEditedBy: performedBy,
    });

    // Create audit log entry
    const auditRef = adminDal.getNestedCollection(
      'organizations/{orgId}/website/audit-log/entries',
      { orgId: organizationId }
    );

    await auditRef.add({
      type: 'blog_post_unpublished',
      postId: params.postId,
      postTitle: postData.title,
      performedBy,
      performedAt: now,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Post unpublished successfully',
    });
  } catch (error: any) {
    logger.error('Failed to unpublish blog post', error, {
      route: '/api/website/blog/posts/[postId]/publish',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to unpublish post', details: error.message },
      { status: 500 }
    );
  }
}

