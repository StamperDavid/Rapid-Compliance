/**
 * Subdomain Lookup API
 * Maps subdomain to organizationId for routing
 * Used by middleware for fast subdomain resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

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
    const params = await context.params;
    const subdomain = params.subdomain.toLowerCase();

    // Query global subdomain registry
    const subdomainDoc = await db.collection('subdomains').doc(subdomain).get();

    if (!subdomainDoc.exists) {
      return NextResponse.json(
        { error: 'Subdomain not found' },
        { status: 404 }
      );
    }

    const data = subdomainDoc.data();

    return NextResponse.json({
      success: true,
      organizationId: data?.organizationId,
      subdomain,
    });
  } catch (error: any) {
    console.error('[Subdomain Lookup API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup subdomain', details: error.message },
      { status: 500 }
    );
  }
}

