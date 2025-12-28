/**
 * Sitemap.xml Generator
 * Dynamically generates sitemap from published pages
 * CRITICAL: Serves content based on request domain/subdomain
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Page } from '@/types/website';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Extract domain or subdomain from request
    const host = request.headers.get('host') || '';
    
    // Find organization by custom domain or subdomain
    let organizationId: string | null = null;
    let baseUrl = '';

    // Check if custom domain
    const domainsSnapshot = await db.collectionGroup('website').get();
    for (const doc of domainsSnapshot.docs) {
      const data = doc.data();
      if (data.customDomain === host && data.customDomainVerified) {
        organizationId = data.organizationId;
        baseUrl = `https://${host}`;
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
          break;
        }
      }
    }

    if (!organizationId) {
      return new NextResponse('Site not found', { status: 404 });
    }

    // Get all published pages for this org
    const pagesSnapshot = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('pages')
      .where('status', '==', 'published')
      .get();

    const pages: Page[] = [];
    pagesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.organizationId === organizationId) {
        pages.push({
          id: doc.id,
          ...data,
        } as Page);
      }
    });

    // Generate sitemap XML
    const sitemap = generateSitemapXML(pages, baseUrl);

    return new NextResponse(sitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[Sitemap] Generation error:', error);
    return new NextResponse('Failed to generate sitemap', { status: 500 });
  }
}

function generateSitemapXML(pages: Page[], baseUrl: string): string {
  const urls = pages.map((page) => {
    const lastmod = page.publishedAt || page.updatedAt || new Date().toISOString();
    const priority = page.slug === 'home' || page.slug === '' ? '1.0' : '0.8';
    
    return `  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

