import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokensFromCode } from '@/lib/integrations/slack-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Zod schema for OAuth callback validation
const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

// Interface for decoded state
interface SlackOAuthState {
  userId: string;
  orgId: string;
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/slack/callback');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Zod validation for OAuth callback params
  const validation = oauthCallbackSchema.safeParse({ code, state });
  if (!validation.success) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }

  try {
    // Parse and type the state properly
    let parsedState: SlackOAuthState = { userId: 'default', orgId: 'default' };
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8')) as SlackOAuthState;
      parsedState = decoded;
    }
    const { userId, orgId } = parsedState;
    const tokens = await getTokensFromCode(validation.data.code);

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

    return NextResponse.redirect(`/integrations?success=slack`);
  } catch (_error) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}



















