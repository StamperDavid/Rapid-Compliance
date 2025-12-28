/**
 * RSS Feed Generator
 * Generates RSS feed from published blog posts
 * CRITICAL: Serves content based on request domain/subdomain
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { BlogPost } from '@/types/website';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Extract domain or subdomain from request
    const host = request.headers.get('host') || '';
    
    // Find organization by custom domain or subdomain
    let organizationId: string | null = null;
    let baseUrl = '';
    let siteTitle = 'Blog';
    let siteDescription = 'Latest blog posts';

    // Check if custom domain
    const domainsSnapshot = await db.collectionGroup('website').get();
    for (const doc of domainsSnapshot.docs) {
      const data = doc.data();
      if (data.customDomain === host && data.customDomainVerified) {
        organizationId = data.organizationId;
        baseUrl = `https://${host}`;
        siteTitle = data.seo?.title || siteTitle;
        siteDescription = data.seo?.description || siteDescription;
        break;
      }
    }

    // If not custom domain, check subdomain
    if (!organizationId) {
      const subdomain = host.split('.')[0];
      const orgsSnapshot = await db.collection('organizations').get();
      
      for (const orgDoc of orgsSnapshot.docs) {
        const settingsDoc = await orgDoc.ref
          .collection('website')
          .doc('settings')
          .get();
        
        const settingsData = settingsDoc.data();
        if (settingsData?.subdomain === subdomain) {
          organizationId = orgDoc.id;
          baseUrl = `https://${host}`;
          siteTitle = settingsData.seo?.title || siteTitle;
          siteDescription = settingsData.seo?.description || siteDescription;
          break;
        }
      }
    }

    if (!organizationId) {
      return new NextResponse('Site not found', { status: 404 });
    }

    // Get all published blog posts for this org
    const postsSnapshot = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('blog-posts')
      .where('status', '==', 'published')
      .get();

    const posts: BlogPost[] = [];
    postsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.organizationId === organizationId) {
        posts.push({
          id: doc.id,
          ...data,
        } as BlogPost);
      }
    });

    // Sort by published date (newest first)
    posts.sort((a, b) => {
      const aDate = new Date(a.publishedAt || a.createdAt).getTime();
      const bDate = new Date(b.publishedAt || b.createdAt).getTime();
      return bDate - aDate;
    });

    // Generate RSS XML
    const rss = generateRSSXML(posts, baseUrl, siteTitle, siteDescription);

    return new NextResponse(rss, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    logger.error('RSS feed generation error', error, {
      route: '/api/website/blog/feed.xml',
      method: 'GET'
    });
    return new NextResponse('Failed to generate RSS feed', { status: 500 });
  }
}

function generateRSSXML(posts: BlogPost[], baseUrl: string, siteTitle: string, siteDescription: string): string {
  const items = posts.map((post) => {
    const pubDate = new Date(post.publishedAt || post.createdAt).toUTCString();
    const link = `${baseUrl}/blog/${post.slug}`;
    const description = escapeXML(post.excerpt || '');
    const title = escapeXML(post.title);
    const author = escapeXML(post.authorName || 'Unknown');
    
    const categories = post.categories.map(cat => 
      `    <category>${escapeXML(cat)}</category>`
    ).join('\n');

    return `  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid>${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${description}</description>
    <author>${author}</author>
${categories}
  </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(siteTitle)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXML(siteDescription)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/blog/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

