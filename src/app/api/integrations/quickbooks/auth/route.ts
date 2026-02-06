/**
 * QuickBooks OAuth - Initiate Auth Flow
 * GET /api/integrations/quickbooks/auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getQuickBooksAuthUrl } from '@/lib/integrations/quickbooks-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/quickbooks/auth');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  // PENTHOUSE: Always use DEFAULT_ORG_ID

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Missing userId' },
      { status: 400 }
    );
  }

  const state = Buffer.from(JSON.stringify({ userId, DEFAULT_ORG_ID })).toString('base64');
  const authUrl = `${getQuickBooksAuthUrl()}&state=${state}`;
  return NextResponse.redirect(authUrl);
}
