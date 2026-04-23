/**
 * Public Blog Posts API — no auth required.
 *
 * GET /api/public/blog/posts
 *   → { posts: PublicBlogSummary[] }
 *
 * Returns only posts with status === 'published'. Drafts and scheduled posts
 * are never exposed. Fields are trimmed to what the public listing needs
 * (no raw PageSection content, no draft SEO fields).
 *
 * Optional ?category=... filters by category.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { BlogPost } from '@/types/website';

export const dynamic = 'force-dynamic';

interface PublicBlogSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featuredImage?: string;
  authorName?: string;
  publishedAt?: string;
  categories: string[];
  tags: string[];
  readTime?: number;
  featured: boolean;
}

function toSummary(post: BlogPost): PublicBlogSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    featuredImage: post.featuredImage,
    authorName: post.authorName,
    publishedAt: post.publishedAt,
    categories: post.categories ?? [],
    tags: post.tags ?? [],
    readTime: post.readTime,
    featured: post.featured ?? false,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!adminDal) {
      return NextResponse.json({ posts: [] }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const postsRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/blog-posts`
    );
    const snapshot = await postsRef.get();

    const summaries: PublicBlogSummary[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as BlogPost;
      if (data.status !== 'published') { return; }
      if (category && !(data.categories ?? []).includes(category)) { return; }
      // Skip posts missing a slug — they aren't addressable by the public route
      if (!data.slug) { return; }
      summaries.push(toSummary({ ...data, id: doc.id }));
    });

    summaries.sort((a, b) => {
      const ad = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bd = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bd - ad;
    });

    return NextResponse.json({ posts: summaries });
  } catch (error) {
    logger.error('Public blog list failed', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/public/blog/posts',
    });
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
}
