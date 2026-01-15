/**
 * Slack OAuth - Initiate Auth Flow
 * GET /api/integrations/slack/auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getSlackAuthUrl } from '@/lib/integrations/slack-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/slack/auth');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const orgId = searchParams.get('orgId');

  if (!userId || !orgId) {
    return NextResponse.json(
      { success: false, error: 'Missing userId or orgId' },
      { status: 400 }
    );
  }

  const state = Buffer.from(JSON.stringify({ userId, orgId })).toString('base64');
  const authUrl = `${getSlackAuthUrl()}&state=${state}`;

  return NextResponse.redirect(authUrl);
}
