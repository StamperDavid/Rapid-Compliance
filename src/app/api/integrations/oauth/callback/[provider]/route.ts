import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/integrations/oauth-service';

/**
 * GET /api/integrations/oauth/callback/[provider] - OAuth callback handler
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      // User denied authorization
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workspace/*/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workspace/*/settings/integrations?error=missing_code_or_state`
      );
    }

    // Exchange code for tokens
    await exchangeCodeForTokens(code, state);

    // Redirect to integrations page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workspace/*/settings/integrations?success=connected`
    );
  } catch (error: any) {
    logger.error('OAuth callback error', error, { route: '/api/integrations/oauth/callback' });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workspace/*/settings/integrations?error=${encodeURIComponent(error.message || 'OAuth failed')}`
    );
  }
}



















