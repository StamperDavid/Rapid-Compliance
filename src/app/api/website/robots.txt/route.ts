/**
 * Robots.txt Generator
 * Serves custom robots.txt from site settings
 * CRITICAL: Serves content based on request domain/subdomain
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    // Extract domain or subdomain from request
    const host = request.headers.get('host') || '';
    
    // Find organization by custom domain or subdomain
    let organizationId: string | null = null;

    // Check if custom domain
    const domainsSnapshot = await db.collectionGroup('website').get();
    for (const doc of domainsSnapshot.docs) {
      const data = doc.data();
      if (data.customDomain === host && data.customDomainVerified) {
        organizationId = data.organizationId;
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
          break;
        }
      }
    }

    if (!organizationId) {
      return new NextResponse('Site not found', { status: 404 });
    }

    // Get robots.txt from settings
    const settingsDoc = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('settings')
      .get();

    const settingsData = settingsDoc.data();
    let robotsTxt = settingsData?.robotsTxt;

    // Default robots.txt if not configured
    if (!robotsTxt) {
      robotsTxt = `User-agent: *
Allow: /

Sitemap: https://${host}/sitemap.xml`;
    }

    return new NextResponse(robotsTxt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[Robots.txt] Generation error:', error);
    return new NextResponse('Failed to generate robots.txt', { status: 500 });
  }
}

