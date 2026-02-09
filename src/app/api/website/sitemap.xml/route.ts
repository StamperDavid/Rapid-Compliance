/**
 * Sitemap.xml Generator
 * Dynamically generates sitemap from published pages
 * CRITICAL: Serves content based on request domain/subdomain
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import type { Page } from '@/types/website';
import { logger } from '@/lib/logger/logger';

interface WebsiteData {
  customDomain?: string;
  customDomainVerified?: boolean;
  subdomain?: string;
}

export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return new NextResponse('Server configuration error', { status: 500 });
    }

    // Extract domain or subdomain from request
    const host = request.headers.get('host') ?? '';

    // Find base URL from custom domain or subdomain
    let baseUrl = '';

    // Check if custom domain (query across all orgs' website settings)
    const domainsSnapshot = await adminDal.getCollectionGroup('website').get();
    for (const doc of domainsSnapshot.docs) {
      const data = doc.data() as WebsiteData;
      if (data.customDomain === host && data.customDomainVerified) {
        baseUrl = `https://${host}`;
        break;
      }
    }

    // If not custom domain, check subdomain
    if (!baseUrl) {
      const subdomain = host.split('.')[0];
      const orgsSnapshot = await adminDal.getCollection('ORGANIZATIONS').get();
      const { adminDb } = await import('@/lib/firebase/admin');

      if (!adminDb) {
        return new NextResponse('Server configuration error', { status: 500 });
      }

      for (const orgDoc of orgsSnapshot.docs) {
        // Use environment-aware subcollection path
        const websitePath = adminDal.getSubColPath('website');
        const settingsDoc = await adminDb
          .collection(orgDoc.ref.path)
          .doc(orgDoc.id)
          .collection(websitePath)
          .doc('settings')
          .get();

        const settingsData = settingsDoc.data() as WebsiteData | undefined;
        if (settingsData?.subdomain === subdomain) {
          baseUrl = `https://${host}`;
          break;
        }
      }
    }

    if (!baseUrl) {
      return new NextResponse('Site not found', { status: 404 });
    }

    // Get all published pages for this org
    const pagesRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/pages`
    );
    const pagesSnapshot = await pagesRef.where('status', '==', 'published').get();

    const pages: Page[] = [];
    pagesSnapshot.forEach((doc) => {
      pages.push({
        id: doc.id,
        ...doc.data(),
      } as Page);
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
    logger.error('Sitemap generation error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/sitemap.xml',
      method: 'GET'
    });
    return new NextResponse('Failed to generate sitemap', { status: 500 });
  }
}

function generateSitemapXML(pages: Page[], baseUrl: string): string {
  const urls = pages.map((page) => {
    const lastmod = (page.publishedAt ?? page.updatedAt) || new Date().toISOString();
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

