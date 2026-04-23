'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import { logger } from '@/lib/logger/logger';

// Minimal shape shared with the API route. The full PageSection tree lives
// elsewhere, but we only extract html widgets for public rendering — blogs
// saved via save_blog_draft put markdown/html inside a single widget.
interface ContentWidget {
  id?: string;
  type?: string;
  data?: { html?: string };
}

interface ContentColumn { widgets?: ContentWidget[] }

interface ContentSection { columns?: ContentColumn[] }

interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: ContentSection[];
  featuredImage?: string;
  authorName?: string;
  authorAvatar?: string;
  publishedAt?: string;
  categories: string[];
  tags: string[];
  readTime?: number;
}

function formatDate(iso?: string): string {
  if (!iso) { return ''; }
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return '';
  }
}

function extractHtml(content: ContentSection[]): string {
  const parts: string[] = [];
  for (const section of content) {
    for (const col of section.columns ?? []) {
      for (const widget of col.widgets ?? []) {
        const html = widget.data?.html;
        if (typeof html === 'string' && html.trim().length > 0) {
          parts.push(html);
        }
      }
    }
  }
  return parts.join('\n');
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug
    : Array.isArray(params.slug) ? params.slug[0]
      : '';
  const { theme } = useWebsiteTheme();
  const [post, setPost] = React.useState<PublicBlogPost | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  React.useEffect(() => {
    if (!slug) { setStatus('not-found'); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/public/blog/posts/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (res.status === 404) {
          if (!cancelled) { setStatus('not-found'); }
          return;
        }
        if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
        const body = (await res.json()) as { post?: PublicBlogPost };
        if (cancelled) { return; }
        if (body.post) {
          setPost(body.post);
          setStatus('ready');
        } else {
          setStatus('not-found');
        }
      } catch (err) {
        logger.error('Public blog slug fetch failed', err instanceof Error ? err : new Error(String(err)), {
          file: 'blog/[slug]/page.tsx',
          slug,
        });
        if (!cancelled) { setStatus('error'); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <PublicLayout>
      <article className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white mb-8 no-underline"
          >
            ← All posts
          </Link>

          {status === 'loading' && (
            <div className="py-20 text-center text-gray-400">Loading…</div>
          )}

          {status === 'not-found' && (
            <div className="py-20 text-center">
              <h1 className="text-3xl font-bold text-white mb-4">Post not found</h1>
              <p className="text-gray-300">This article may have been moved or unpublished.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-20 text-center">
              <h1 className="text-3xl font-bold text-white mb-4">Something went wrong</h1>
              <p className="text-gray-300">Please try again in a moment.</p>
            </div>
          )}

          {status === 'ready' && post && (
            <>
              <header className="mb-10">
                {post.categories[0] && (
                  <span
                    className="inline-block px-3 py-1 text-xs font-semibold rounded-full mb-6"
                    style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
                  >
                    {post.categories[0]}
                  </span>
                )}
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">{post.title}</h1>
                {post.excerpt && (
                  <p className="text-xl text-gray-300 mb-6">{post.excerpt}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  {post.authorName && <span>{post.authorName}</span>}
                  {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
                  {post.readTime ? <span>{post.readTime} min read</span> : null}
                </div>
              </header>

              {post.featuredImage && (
                <div className="relative w-full h-[420px] mb-12 rounded-xl overflow-hidden">
                  <Image
                    src={post.featuredImage}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover"
                    priority
                  />
                </div>
              )}

              <div
                className="prose prose-invert prose-lg max-w-none text-gray-200"
                dangerouslySetInnerHTML={{ __html: extractHtml(post.content) }}
              />

              {post.tags.length > 0 && (
                <div className="mt-16 pt-8 border-t border-white/10">
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 text-xs rounded-full bg-white/5 text-gray-300 border border-white/10">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </article>
    </PublicLayout>
  );
}
