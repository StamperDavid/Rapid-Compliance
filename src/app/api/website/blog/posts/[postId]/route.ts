/**
 * Individual Blog Post API
 * Get, update, delete a specific blog post
 * Single-tenant: Uses DEFAULT_ORG_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import type { BlogPost } from '@/types/website';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

const paramsSchema = z.object({
  postId: z.string().min(1, 'postId is required'),
});

const pageSEOSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  ogImage: z.string().optional(),
  canonical: z.string().optional(),
  noIndex: z.boolean().optional(),
  structuredData: z.record(z.unknown()).optional(),
});

const putBodySchema = z.object({
  post: z.object({
    title: z.string().optional(),
    slug: z.string().optional(),
    excerpt: z.string().optional(),
    content: z.array(z.unknown()).optional(), // PageSection[] - validated at storage layer
    featuredImage: z.string().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    authorName: z.string().optional(),
    authorAvatar: z.string().optional(),
    seo: pageSEOSchema.optional(),
    status: z.enum(['draft', 'published', 'scheduled']).optional(),
    featured: z.boolean().optional(),
    readTime: z.number().optional(),
  }),
});

/**
 * GET /api/website/blog/posts/:postId
 * Get a specific blog post
 */
export async function GET(
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

    // Get post document
    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: DEFAULT_ORG_ID, postId }
    );

    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const postData = postDoc.data() as BlogPost;

    return NextResponse.json({
      post: {
        ...postData,
        id: postDoc.id,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch blog post', error instanceof Error ? error : new Error(String(error)), {
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
    const bodyResult = putBodySchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { post } = bodyResult.data;

    // Get existing post
    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: DEFAULT_ORG_ID, postId }
    );

    const existingPost = await postRef.get();

    if (!existingPost.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const existingData = existingPost.data() as BlogPost | undefined;

    if (!existingData) {
      return NextResponse.json(
        { error: 'Post data not found' },
        { status: 404 }
      );
    }

    // Update post - merge existing with updates
    const updatedPost: BlogPost = {
      ...existingData,
      ...(post.title !== undefined && { title: post.title }),
      ...(post.slug !== undefined && { slug: post.slug }),
      ...(post.excerpt !== undefined && { excerpt: post.excerpt }),
      ...(post.content !== undefined && { content: post.content as BlogPost['content'] }),
      ...(post.featuredImage !== undefined && { featuredImage: post.featuredImage }),
      ...(post.categories !== undefined && { categories: post.categories }),
      ...(post.tags !== undefined && { tags: post.tags }),
      ...(post.author !== undefined && { author: post.author }),
      ...(post.authorName !== undefined && { authorName: post.authorName }),
      ...(post.authorAvatar !== undefined && { authorAvatar: post.authorAvatar }),
      ...(post.seo !== undefined && { seo: post.seo as BlogPost['seo'] }),
      ...(post.status !== undefined && { status: post.status }),
      ...(post.featured !== undefined && { featured: post.featured }),
      ...(post.readTime !== undefined && { readTime: post.readTime }),
      id: postId,
      updatedAt: new Date().toISOString(),
      lastEditedBy: 'system',
    };

    await postRef.set(updatedPost);

    return NextResponse.json({ post: updatedPost });
  } catch (error: unknown) {
    logger.error('Failed to update blog post', error instanceof Error ? error : new Error(String(error)), {
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

    // Get post to verify ownership
    const postRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/blog-posts/{postId}',
      { orgId: DEFAULT_ORG_ID, postId }
    );

    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    await postRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete blog post', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/posts/[postId]',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
