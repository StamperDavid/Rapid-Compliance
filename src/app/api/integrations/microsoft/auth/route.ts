/**
 * Microsoft OAuth - Initiate Auth Flow
 * GET /api/integrations/microsoft/auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getMicrosoftAuthUrl } from '@/lib/integrations/outlook-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/microsoft/auth');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Missing userId' },
      { status: 400 }
    );
  }

  const state = Buffer.from(JSON.stringify({ userId, PLATFORM_ID })).toString('base64');
  const authUrl = `${getMicrosoftAuthUrl()}&state=${state}`;

  return NextResponse.redirect(authUrl);
}
