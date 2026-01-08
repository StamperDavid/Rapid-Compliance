import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/integrations/oauth-service';
import { logger } from '@/lib/logger/logger';

/**
 * GET /api/integrations/oauth/callback/[provider] - OAuth callback handler
 */
export async function GET(
  request: NextRequest,
  { params: _params }: { params: { provider: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      // User denied authorization
      const appUrlEnv = process.env.NEXT_PUBLIC_APP_URL;
      const appUrl = (appUrlEnv !== '' && appUrlEnv != null) ? appUrlEnv : 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/workspace/*/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      const appUrlEnv2 = process.env.NEXT_PUBLIC_APP_URL;
      const appUrl2 = (appUrlEnv2 !== '' && appUrlEnv2 != null) ? appUrlEnv2 : 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl2}/workspace/*/settings/integrations?error=missing_code_or_state`
      );
    }

    // Exchange code for tokens
    await exchangeCodeForTokens(code, state);

    // Redirect to integrations page with success
    const successAppUrlEnv = process.env.NEXT_PUBLIC_APP_URL;
    const successAppUrl = (successAppUrlEnv !== '' && successAppUrlEnv != null) ? successAppUrlEnv : 'http://localhost:3000';
    return NextResponse.redirect(
      `${successAppUrl}/workspace/*/settings/integrations?success=connected`
    );
  } catch (error: any) {
    logger.error('OAuth callback error', error, { route: '/api/integrations/oauth/callback' });
    const errorAppUrlEnv = process.env.NEXT_PUBLIC_APP_URL;
    const errorAppUrl = (errorAppUrlEnv !== '' && errorAppUrlEnv != null) ? errorAppUrlEnv : 'http://localhost:3000';
    const errorMsg = (error.message !== '' && error.message != null) ? error.message : 'OAuth failed';
    return NextResponse.redirect(
      `${errorAppUrl}/workspace/*/settings/integrations?error=${encodeURIComponent(errorMsg)}`
    );
  }
}



















