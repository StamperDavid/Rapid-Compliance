/**
 * Blog Post Publishing API
 * Handle publish/unpublish actions for blog posts
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

const paramsSchema = z.object({
  postId: z.string().min(1, 'postId is required'),
});

const postBodySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  scheduledFor: z.string().optional(),
});

const deleteQuerySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
});

interface BlogPostData {
  organizationId: string;
  title?: string;
  status?: string;
  scheduledFor?: string | null;
  updatedAt?: string;
  lastEditedBy?: string;
  publishedAt?: string;
}

interface UpdateData {
  updatedAt: string;
  lastEditedBy: string;
  status?: 'draft' | 'published' | 'scheduled';
  scheduledFor?: string | null;
  publishedAt?: string;
  [key: string]: string | null | undefined;
}

/**
 * POST /api/website/blog/posts/[postId]/publish
 * Publish a blog post (make it live)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid postId parameter' }, { status: 400 });
    }
    const { postId } = paramsResult.data;

    const rawBody: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { organizationId, scheduledFor } = bodyResult.data;

    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId }
    );

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data() as BlogPostData | undefined;

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
        postId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const performedBy = await getUserIdentifier();

    // Update data
    const updateData: UpdateData = {
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
      postId,
      postTitle: postData.title ?? '',
      scheduledFor: scheduledFor ?? null,
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to publish blog post', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/posts/[postId]/publish',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to publish post', details: errorMessage },
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
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid postId parameter' }, { status: 400 });
    }
    const { postId } = paramsResult.data;

    const { searchParams } = request.nextUrl;
    const queryResult = deleteQuerySchema.safeParse({
      organizationId: searchParams.get('organizationId') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: queryResult.error.errors[0]?.message ?? 'organizationId is required' },
        { status: 400 }
      );
    }

    const { organizationId } = queryResult.data;

    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: organizationId, postId }
    );

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data() as BlogPostData | undefined;

    // CRITICAL: Verify organizationId matches
    if (postData?.organizationId !== organizationId) {
      logger.error('[SECURITY] organizationId mismatch on blog unpublish', new Error('Cross-org blog unpublish attempt'), {
        route: '/api/website/blog/posts/[postId]/publish',
        method: 'DELETE',
        requested: organizationId,
        actual: postData?.organizationId,
        postId,
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
      postId,
      postTitle: postData?.title ?? '',
      performedBy,
      performedAt: now,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Post unpublished successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to unpublish blog post', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/posts/[postId]/publish',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to unpublish post', details: errorMessage },
      { status: 500 }
    );
  }
}
