'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import { logger } from '@/lib/logger/logger';

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

function formatDate(iso?: string): string {
  if (!iso) { return ''; }
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return '';
  }
}

function EmptyState() {
  return (
    <div className="mt-16 text-center p-8 bg-white/5 border border-white/10 rounded-xl">
      <h3 className="text-2xl font-bold text-white mb-2">Fresh articles coming soon</h3>
      <p className="text-gray-300">
        We&apos;re writing. Check back shortly, or subscribe to get notified when the first posts go live.
      </p>
    </div>
  );
}

export default function BlogPage() {
  const { theme } = useWebsiteTheme();
  const [posts, setPosts] = React.useState<PublicBlogSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/public/blog/posts', { cache: 'no-store' });
        if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
        const body = (await res.json()) as { posts?: PublicBlogSummary[] };
        if (!cancelled) { setPosts(Array.isArray(body.posts) ? body.posts : []); }
      } catch (err) {
        logger.error('Public blog list fetch failed', err instanceof Error ? err : new Error(String(err)), {
          file: 'blog/page.tsx',
        });
        if (!cancelled) { setError('Could not load posts right now.'); setPosts([]); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <PublicLayout>
      <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-white mb-6">Blog</h1>
            <p className="text-xl text-gray-300">Insights, guides, and news about AI-powered sales</p>
          </div>

          {posts === null ? (
            <div className="pt-20 pb-20 text-center text-gray-400">Loading…</div>
          ) : posts.length === 0 ? (
            <>
              {error && (
                <div className="mb-8 text-center text-sm text-gray-400">{error}</div>
              )}
              <EmptyState />
            </>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition block no-underline"
                >
                  {post.featuredImage && (
                    <div className="relative w-full h-48">
                      <Image
                        src={post.featuredImage}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {post.categories[0] && (
                      <span
                        className="px-3 py-1 text-xs font-semibold rounded-full"
                        style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
                      >
                        {post.categories[0]}
                      </span>
                    )}
                    <h2 className="text-2xl font-bold text-white mt-4 mb-3 group-hover:underline">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-gray-300 mb-4 line-clamp-3">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{formatDate(post.publishedAt)}</span>
                      {post.readTime ? <span>{post.readTime} min read</span> : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
