/**
 * Public Blog Post by Slug — no auth required.
 *
 * GET /api/public/blog/posts/{slug}
 *   → { post: PublicBlogPost } on success
 *   → 404 if no published post matches the slug
 *
 * Returns the full post content (PageSection[]) so the public slug page can
 * render via PageRenderer. Drafts and scheduled posts are never returned.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { BlogPost, PageSection, PageSEO } from '@/types/website';

export const dynamic = 'force-dynamic';

interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: PageSection[];
  featuredImage?: string;
  authorName?: string;
  authorAvatar?: string;
  publishedAt?: string;
  categories: string[];
  tags: string[];
  readTime?: number;
  seo?: PageSEO;
}

function toPublicPost(data: BlogPost): PublicBlogPost {
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    content: data.content ?? [],
    featuredImage: data.featuredImage,
    authorName: data.authorName,
    authorAvatar: data.authorAvatar,
    publishedAt: data.publishedAt,
    categories: data.categories ?? [],
    tags: data.tags ?? [],
    readTime: data.readTime,
    seo: data.seo,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug } = await context.params;
    if (!slug) {
      return NextResponse.json({ error: 'Slug required' }, { status: 400 });
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server unavailable' }, { status: 503 });
    }

    const postsRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/blog-posts`
    );
    const snapshot = await postsRef.get();

    let match: BlogPost | null = null;
    snapshot.forEach((doc) => {
      if (match) { return; }
      const data = doc.data() as BlogPost;
      if (data.status !== 'published') { return; }
      if (data.slug !== slug) { return; }
      match = { ...data, id: doc.id };
    });

    if (!match) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post: toPublicPost(match) });
  } catch (error) {
    logger.error('Public blog slug fetch failed', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/public/blog/posts/[slug]',
    });
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
  }
}
