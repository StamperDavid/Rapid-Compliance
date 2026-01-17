/**
 * Subdomain Lookup API
 * Maps subdomain to organizationId for routing
 * Used by middleware for fast subdomain resolution
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';

interface SubdomainData {
  organizationId?: string;
}

/**
 * GET /api/website/subdomain/[subdomain]
 * Look up organizationId by subdomain
 * NOTE: This is called by middleware, should be FAST
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const subdomain = params.subdomain.toLowerCase();

    // Query global subdomain registry
    const subdomainRef = adminDal.getNestedDocRef('subdomains/{subdomain}', { subdomain });
    const subdomainDoc = await subdomainRef.get();

    if (!subdomainDoc.exists) {
      return NextResponse.json(
        { error: 'Subdomain not found' },
        { status: 404 }
      );
    }

    const data = subdomainDoc.data() as SubdomainData | undefined;

    return NextResponse.json({
      success: true,
      organizationId: data?.organizationId,
      subdomain,
    });
  } catch (error: unknown) {
    logger.error('Subdomain lookup error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/subdomain/[subdomain]',
      method: 'GET'
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to lookup subdomain', details: message },
      { status: 500 }
    );
  }
}

