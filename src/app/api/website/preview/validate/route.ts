/**
 * Preview Token Validation API
 * Validate preview tokens and return page info
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/website/preview/validate
 * Validate a preview token and return page/org info
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Preview token is required' },
        { status: 400 }
      );
    }

    // Search for the token across all organizations
    // This is safe because the token is cryptographically secure
    const orgsSnapshot = await adminDal.getCollection('ORGANIZATIONS').get();

    for (const orgDoc of orgsSnapshot.docs) {
      const tokenRef = adminDal.getNestedDocRef(
        'organizations/{orgId}/website/preview-tokens/tokens/{token}',
        { orgId: orgDoc.id, token }
      );

      const tokenDoc = await tokenRef.get();

      if (tokenDoc.exists) {
        const tokenData = tokenDoc.data();

        // Check if token is expired
        const expiresAt = new Date(tokenData?.expiresAt || '');
        if (expiresAt < new Date()) {
          return NextResponse.json(
            { error: 'Preview token has expired' },
            { status: 403 }
          );
        }

        return NextResponse.json({
          success: true,
          pageId: tokenData?.pageId,
          organizationId: orgDoc.id,
          expiresAt: tokenData?.expiresAt,
        });
      }
    }

    // Token not found
    return NextResponse.json(
      { error: 'Invalid preview token' },
      { status: 403 }
    );
  } catch (error: any) {
    logger.error('Preview token validation error', error, {
      route: '/api/website/preview/validate',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to validate token', details: error.message },
      { status: 500 }
    );
  }
}

