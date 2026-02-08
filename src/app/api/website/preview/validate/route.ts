/**
 * Preview Token Validation API
 * Validate preview tokens and return page info
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  token: z.string().min(1, 'Preview token is required'),
});

interface PreviewTokenData {
  expiresAt?: string;
  pageId?: string;
}

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
    const queryResult = querySchema.safeParse({
      token: searchParams.get('token'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: queryResult.error.errors[0]?.message ?? 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { token } = queryResult.data;

    // Search for the token across all organizations
    // This is safe because the token is cryptographically secure
    const orgsSnapshot = await adminDal.getCollection('ORGANIZATIONS').get();

    for (const _orgDoc of orgsSnapshot.docs) {
      const tokenRef = adminDal.getNestedDocRef(
        'organizations/rapid-compliance-root/website/preview-tokens/tokens/{token}',
        { token }
      );

      const tokenDoc = await tokenRef.get();

      if (tokenDoc.exists) {
        const tokenData = tokenDoc.data() as PreviewTokenData | undefined;

        // Check if token is expired
        const expiresAt = new Date(tokenData?.expiresAt ?? '');
        if (expiresAt < new Date()) {
          return NextResponse.json(
            { error: 'Preview token has expired' },
            { status: 403 }
          );
        }

        return NextResponse.json({
          success: true,
          pageId: tokenData?.pageId,
          expiresAt: tokenData?.expiresAt,
        });
      }
    }

    // Token not found
    return NextResponse.json(
      { error: 'Invalid preview token' },
      { status: 403 }
    );
  } catch (error: unknown) {
    logger.error('Preview token validation error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/preview/validate',
      method: 'GET'
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to validate token', details: message },
      { status: 500 }
    );
  }
}

