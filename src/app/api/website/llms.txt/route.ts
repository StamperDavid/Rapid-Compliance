/**
 * llms.txt Generator
 * Serves an AI-readable site description for LLM crawlers and AI search engines.
 * Follows the llms.txt specification: https://llmstxt.org/
 *
 * Pulls site metadata, published pages, and blog posts to generate a
 * machine-readable summary of the site's content and purpose.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { Page, BlogPost } from '@/types/website';

interface WebsiteSettings {
  subdomain?: string;
  customDomain?: string;
  customDomainVerified?: boolean;
  llmsTxt?: string;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}

/**
 * GET /api/website/llms.txt
 * Returns an llms.txt file describing the site for AI models.
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return new NextResponse('Server configuration error', { status: 500 });
    }

    const host = request.headers.get('host') ?? '';

    // Resolve settings for the requesting domain
    const settingsRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/settings`
    );
    const settingsDoc = await settingsRef.get();
    const settings = settingsDoc.data() as WebsiteSettings | undefined;

    // If custom llms.txt is configured, serve it directly
    if (settings?.llmsTxt) {
      return new NextResponse(settings.llmsTxt, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    }

    // Auto-generate llms.txt from site data
    const baseUrl = settings?.customDomain && settings.customDomainVerified
      ? `https://${settings.customDomain}`
      : settings?.subdomain
        ? `https://${settings.subdomain}.${host.split('.').slice(-2).join('.')}`
        : `https://${host}`;

    const siteName = settings?.seo?.title ?? 'SalesVelocity.ai';
    const siteDescription = settings?.seo?.description ?? '';
    const keywords = settings?.seo?.keywords ?? [];

    // Fetch published pages
    const pagesRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/pages`
    );
    const pagesSnapshot = await pagesRef.where('status', '==', 'published').get();
    const pages: Page[] = [];
    pagesSnapshot.forEach((doc) => {
      pages.push({ id: doc.id, ...doc.data() } as Page);
    });

    // Fetch published blog posts
    const postsRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/blog-posts`
    );
    const postsSnapshot = await postsRef.where('status', '==', 'published').get();
    const posts: BlogPost[] = [];
    postsSnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as BlogPost);
    });

    const llmsTxt = generateLlmsTxt({
      siteName,
      siteDescription,
      keywords,
      baseUrl,
      pages,
      posts,
    });

    return new NextResponse(llmsTxt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    logger.error('llms.txt generation error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/llms.txt',
      method: 'GET',
    });
    return new NextResponse('Failed to generate llms.txt', { status: 500 });
  }
}

interface LlmsTxtInput {
  siteName: string;
  siteDescription: string;
  keywords: string[];
  baseUrl: string;
  pages: Page[];
  posts: BlogPost[];
}

function generateLlmsTxt(input: LlmsTxtInput): string {
  const { siteName, siteDescription, keywords, baseUrl, pages, posts } = input;

  const lines: string[] = [];

  // Header
  lines.push(`# ${siteName}`);
  lines.push('');

  // Description
  if (siteDescription) {
    lines.push(`> ${siteDescription}`);
    lines.push('');
  }

  // Topics/Keywords
  if (keywords.length > 0) {
    lines.push(`Topics: ${keywords.join(', ')}`);
    lines.push('');
  }

  // Discovery files
  lines.push('## Discovery');
  lines.push('');
  lines.push(`- Sitemap: ${baseUrl}/sitemap.xml`);
  lines.push(`- RSS Feed: ${baseUrl}/blog/feed.xml`);
  lines.push(`- Robots: ${baseUrl}/robots.txt`);
  lines.push('');

  // Published pages
  if (pages.length > 0) {
    lines.push('## Pages');
    lines.push('');
    for (const page of pages) {
      const pageUrl = `${baseUrl}/${page.slug}`;
      const title = page.seo?.metaTitle ?? page.title;
      const desc = page.seo?.metaDescription ? `: ${page.seo.metaDescription}` : '';
      lines.push(`- [${title}](${pageUrl})${desc}`);
    }
    lines.push('');
  }

  // Blog posts
  if (posts.length > 0) {
    lines.push('## Blog');
    lines.push('');
    // Show most recent 20 posts
    const recentPosts = [...posts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    for (const post of recentPosts) {
      const postUrl = `${baseUrl}/blog/${post.slug}`;
      const excerpt = post.excerpt ? `: ${post.excerpt}` : '';
      lines.push(`- [${post.title}](${postUrl})${excerpt}`);
    }
    lines.push('');
  }

  // Structured data availability
  lines.push('## Structured Data');
  lines.push('');
  lines.push('This site provides JSON-LD structured data on all pages including:');
  lines.push('- Organization schema');
  lines.push('- WebSite schema with search action');
  lines.push('- WebPage schema per page');
  lines.push('- BlogPosting schema for blog articles');
  lines.push('- BreadcrumbList navigation');
  lines.push('');

  // Contact
  lines.push('## Contact');
  lines.push('');
  lines.push(`Website: ${baseUrl}`);

  return lines.join('\n');
}
