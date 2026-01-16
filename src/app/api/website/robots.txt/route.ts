/**
 * Robots.txt Generator
 * Serves custom robots.txt from site settings
 * CRITICAL: Serves content based on request domain/subdomain
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface WebsiteData {
  customDomain?: string;
  customDomainVerified?: boolean;
  organizationId?: string;
  subdomain?: string;
  robotsTxt?: string;
}

export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return new NextResponse('Server configuration error', { status: 500 });
    }

    // Extract domain or subdomain from request
    const host = request.headers.get('host') ?? '';
    
    // Find organization by custom domain or subdomain
    let organizationId: string | null = null;

    // Check if custom domain (query across all orgs' website settings)
    const domainsSnapshot = await adminDal.getCollectionGroup('website').get();
    for (const doc of domainsSnapshot.docs) {
      const data = doc.data() as WebsiteData;
      if (data.customDomain === host && data.customDomainVerified) {
        organizationId = data.organizationId ?? null;
        break;
      }
    }

    // If not custom domain, check subdomain
    if (!organizationId) {
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
          organizationId = orgDoc.id;
          break;
        }
      }
    }

    if (!organizationId) {
      return new NextResponse('Site not found', { status: 404 });
    }

    // Get robots.txt from settings
    const settingsRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/settings',
      { orgId: organizationId }
    );
    const settingsDoc = await settingsRef.get();

    const settingsData = settingsDoc.data() as WebsiteData | undefined;
    let robotsTxt = settingsData?.robotsTxt;

    // Default robots.txt if not configured
    robotsTxt ??= `User-agent: *
Allow: /

Sitemap: https://${host}/sitemap.xml`;

    return new NextResponse(robotsTxt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    logger.error('Robots.txt generation error', error, {
      route: '/api/website/robots.txt',
      method: 'GET'
    });
    return new NextResponse('Failed to generate robots.txt', { status: 500 });
  }
}

