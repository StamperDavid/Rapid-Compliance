/**
 * Domain Lookup API
 * Get organization ID from custom domain
 * Used by middleware for routing
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

interface GlobalDomainData {
  domain?: string;
}

interface DomainData {
  verified: boolean;
  sslEnabled: boolean;
}

/**
 * GET /api/website/domain/[domain]
 * Get organization ID for a custom domain
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ domain: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const domain = decodeURIComponent(params.domain);

    // Check global domains collection for fast lookup
    const globalDomainRef = adminDal.getNestedDocRef('custom-domains/{domain}', { domain });
    const globalDomainDoc = await globalDomainRef.get();

    if (!globalDomainDoc.exists) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const globalData = globalDomainDoc.data() as GlobalDomainData | undefined;

    if (!globalData?.domain) {
      return NextResponse.json(
        { error: 'Domain not configured' },
        { status: 404 }
      );
    }

    // Verify domain is verified
    const domainRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/config/custom-domains/{domain}`,
      { domain }
    );

    const domainDoc = await domainRef.get();

    if (!domainDoc.exists) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const domainData = domainDoc.data() as DomainData | undefined;

    // Only return if domain is verified
    if (!domainData?.verified) {
      return NextResponse.json(
        { error: 'Domain not verified' },
        { status: 403 }
      );
    }

    const verified: boolean = domainData.verified;
    const sslEnabled: boolean = domainData.sslEnabled;

    return NextResponse.json({
      success: true,
      domain,
      verified,
      sslEnabled,
    }, {
      headers: {
        // Cache this response at the edge for 1 minute
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Domain lookup error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/domain/[domain]',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to lookup domain', details: message },
      { status: 500 }
    );
  }
}
