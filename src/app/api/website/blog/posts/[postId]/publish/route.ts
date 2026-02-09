/**
 * Blog Post Publishing API
 * Handle publish/unpublish actions for blog posts
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

const paramsSchema = z.object({
  postId: z.string().min(1, 'postId is required'),
});

const postBodySchema = z.object({
  scheduledFor: z.string().optional(),
});

interface BlogPostData {
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

    const { scheduledFor } = bodyResult.data;

    const postRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/config/blog-posts/{postId}`,
      { postId }
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
      `${getSubCollection('website')}/audit-log/entries`
    );

    await auditRef.add({
      type: scheduledFor ? 'blog_post_scheduled' : 'blog_post_published',
      postId,
      postTitle: postData.title ?? '',
      scheduledFor: scheduledFor ?? null,
      performedBy,
      performedAt: now,
      PLATFORM_ID,
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

    const postRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/config/blog-posts/{postId}`,
      { postId }
    );

    const doc = await postRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const postData = doc.data() as BlogPostData | undefined;

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
      `${getSubCollection('website')}/audit-log/entries`
    );

    await auditRef.add({
      type: 'blog_post_unpublished',
      postId,
      postTitle: postData?.title ?? '',
      performedBy,
      performedAt: now,
      PLATFORM_ID,
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
