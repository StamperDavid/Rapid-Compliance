/**
 * OAuth Callback Handler
 * GET /api/integrations/oauth/callback/[provider]
 */

import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/integrations/oauth-service';
import { validateOAuthState } from '@/lib/security/oauth-state';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

function getAppUrl(): string {
  const appUrlEnv = process.env.NEXT_PUBLIC_APP_URL;
  return (appUrlEnv !== '' && appUrlEnv != null) ? appUrlEnv : 'http://localhost:3000';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      // User denied authorization
      return NextResponse.redirect(
        `${getAppUrl()}/settings/integrations?error=${encodeURIComponent(errorParam)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${getAppUrl()}/settings/integrations?error=missing_code_or_state`
      );
    }

    // Validate CSRF state token
    const userId = await validateOAuthState(state, provider);
    if (!userId) {
      logger.error('OAuth state validation failed', new Error('Invalid or expired state token'), {
        route: '/api/integrations/oauth/callback',
        provider,
      });
      return NextResponse.redirect(
        `${getAppUrl()}/settings/integrations?error=invalid_state`
      );
    }

    // Exchange code for tokens
    await exchangeCodeForTokens(code, state);

    // Redirect to integrations page with success
    return NextResponse.redirect(
      `${getAppUrl()}/settings/integrations?success=connected`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'OAuth failed';
    logger.error('OAuth callback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/oauth/callback' });
    return NextResponse.redirect(
      `${getAppUrl()}/settings/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
