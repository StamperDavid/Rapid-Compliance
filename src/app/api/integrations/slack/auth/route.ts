/**
 * Slack OAuth - Initiate Auth Flow
 * GET /api/integrations/slack/auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getSlackAuthUrl } from '@/lib/integrations/slack-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/slack/auth');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}
  const userId = authResult.user.uid;

  const state = Buffer.from(JSON.stringify({ userId, PLATFORM_ID })).toString('base64');
  const authUrl = `${getSlackAuthUrl()}&state=${state}`;

  return NextResponse.redirect(authUrl);
}
