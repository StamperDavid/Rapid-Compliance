/**
 * Domain Lookup API
 * Get organization ID from custom domain
 * Used by middleware for routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

/**
 * GET /api/website/domain/[domain]
 * Get organization ID for a custom domain
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ domain: string }> }
) {
  try {
    const params = await context.params;
    const domain = decodeURIComponent(params.domain);

    // Check global domains collection for fast lookup
    const globalDomainDoc = await db.collection('custom-domains').doc(domain).get();

    if (!globalDomainDoc.exists) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const globalData = globalDomainDoc.data();
    const organizationId = globalData?.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Domain not configured' },
        { status: 404 }
      );
    }

    // Verify domain is verified
    const domainRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('custom-domains')
      .doc(domain);

    const domainDoc = await domainRef.get();

    if (!domainDoc.exists) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const domainData = domainDoc.data();

    // Only return if domain is verified
    if (!domainData?.verified) {
      return NextResponse.json(
        { error: 'Domain not verified' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      organizationId,
      domain,
      verified: domainData.verified,
      sslEnabled: domainData.sslEnabled,
    }, {
      headers: {
        // Cache this response at the edge for 1 minute
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    console.error('[Domain Lookup API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup domain', details: error.message },
      { status: 500 }
    );
  }
}
