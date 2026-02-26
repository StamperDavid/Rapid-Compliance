import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokensFromCode } from '@/lib/integrations/slack-service';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { encryptToken } from '@/lib/security/token-encryption';
import { validateOAuthState } from '@/lib/security/oauth-state';

export const dynamic = 'force-dynamic';

// Zod schema for OAuth callback validation
const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

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
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  }

  try {
    // Validate CSRF-safe state token against Firestore
    const userId = await validateOAuthState(validation.data.state, 'slack');
    if (!userId) {
      return NextResponse.redirect('/integrations?error=invalid_state');
    }
    const tokens = await getTokensFromCode(validation.data.code);

    await AdminFirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      `slack_${tokens.team_id}`,
      {
        id: `slack_${tokens.team_id}`,
        userId,
        provider: 'slack',
        type: 'messaging',
        status: 'active',
        credentials: {
          access_token: encryptToken(tokens.access_token),
          team_id: tokens.team_id,
          team_name: tokens.team_name,
          encrypted: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.redirect(new URL('/integrations?success=slack', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  } catch (_error) {
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  }
}



















