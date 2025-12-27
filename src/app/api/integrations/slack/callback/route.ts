import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/slack-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/slack/callback');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }

  try {
    const { userId, orgId } = state ? JSON.parse(Buffer.from(state, 'base64').toString('utf-8')) : { userId: 'default', orgId: 'default' };
    const tokens = await getTokensFromCode(code);

    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      `slack_${tokens.team_id}`,
      {
        id: `slack_${tokens.team_id}`,
        userId,
        organizationId: orgId,
        provider: 'slack',
        type: 'messaging',
        status: 'active',
        credentials: {
          access_token: tokens.access_token,
          team_id: tokens.team_id,
          team_name: tokens.team_name,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.redirect(`/workspace/${orgId}/integrations?success=slack`);
  } catch (error) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}



















