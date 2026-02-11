/**
 * Blog Posts API
 * Manage blog posts
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import type { BlogPost, PageSection, PageSEO } from '@/types/website';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const getQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  category: z.string().optional(),
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

const postBodySchema = z.object({
  post: z.object({
    id: z.string().optional(),
    title: z.string().min(1, 'Post title is required'),
    slug: z.string().optional(),
    excerpt: z.string().optional(),
    content: z.array(z.unknown()).optional(), // PageSection[] - validated at storage layer
    featuredImage: z.string().optional(),
    categories: z.array(z.string()).optional().default([]),
    tags: z.array(z.string()).optional().default([]),
    author: z.string().optional(), // User ID
    authorName: z.string().optional(),
    authorAvatar: z.string().optional(),
    seo: pageSEOSchema.optional(),
    status: z.enum(['draft', 'published', 'scheduled']).optional().default('draft'),
    featured: z.boolean().optional().default(false),
    readTime: z.number().optional(),
  }),
});

/**
 * GET /api/website/blog/posts
 * List blog posts for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = getQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      category: searchParams.get('category') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: queryResult.error.errors[0]?.message ?? 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { status, category } = queryResult.data;

    // Get posts collection
    const postsRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/blog-posts`
    );

    // Get all posts and filter
    const snapshot = await postsRef.get();
    const posts: BlogPost[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as BlogPost;
      // Apply status filter
      if (status && data.status !== status) {
        return;
      }

      const post: BlogPost = {
        ...data,
        id: doc.id,
      };

      // Filter by category if specified
      if (!category || post.categories.includes(category)) {
        posts.push(post);
      }
    });

    // Sort by creation date (newest first)
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ posts });
  } catch (error: unknown) {
    logger.error('Failed to fetch blog posts', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/posts',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/blog/posts
 * Create a new blog post
 */
export async function POST(request: NextRequest) {
  try {
    const postAuthResult = await requireAuth(request);
    if (postAuthResult instanceof NextResponse) {return postAuthResult;}

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const rawBody: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { post } = bodyResult.data;
    const now = new Date().toISOString();

    // Create post document matching BlogPost interface
    const postId = post.id ?? `post_${Date.now()}`;
    const postData: BlogPost = {
      id: postId,
      slug: post.slug ?? '',
      title: post.title,
      excerpt: post.excerpt ?? '',
      content: post.content as PageSection[] ?? [],
      featuredImage: post.featuredImage,
      author: post.author ?? 'system',
      authorName: post.authorName,
      authorAvatar: post.authorAvatar,
      categories: post.categories,
      tags: post.tags,
      featured: post.featured,
      seo: (post.seo ?? { title: post.title }) as PageSEO,
      status: post.status,
      views: 0,
      readTime: post.readTime,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      lastEditedBy: 'system',
    };

    // Save to Firestore
    const postRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/config/blog-posts/{postId}`,
      { postId: postData.id }
    );

    await postRef.set(postData);

    return NextResponse.json({ post: postData }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Failed to create blog post', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/posts',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
