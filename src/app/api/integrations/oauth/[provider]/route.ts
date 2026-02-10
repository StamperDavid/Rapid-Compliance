/**
 * OAuth Integration Routes
 * GET /api/integrations/oauth/[provider]
 *
 * Handles OAuth flows for Gmail, Outlook, Google Calendar, etc.
 * Note: This route redirects to OAuth provider, so auth is checked but no rate limiting
 */

import { randomBytes } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // Always require authentication for OAuth initiation
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const searchParams = request.nextUrl.searchParams;
    const redirectUriParam = searchParams.get('redirectUri');

    // Validate redirect URI to prevent open redirect
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      request.nextUrl.origin,
    ].filter(Boolean);

    let redirectUri: string;
    if (redirectUriParam != null && redirectUriParam !== '') {
      const isAllowed = allowedOrigins.some(origin => origin && redirectUriParam.startsWith(origin));
      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: 'Invalid redirect URI' },
          { status: 400 }
        );
      }
      redirectUri = redirectUriParam;
    } else {
      redirectUri = `${request.nextUrl.origin}/api/integrations/oauth/${provider}/callback`;
    }

    // Generate cryptographically random CSRF token for state parameter
    const csrfToken = randomBytes(32).toString('hex');

    // Generate OAuth URLs for different providers
    let authUrl = '';

    switch (provider) {
      case 'gmail':
      case 'google-calendar':
        authUrl = generateGoogleAuthUrl(provider, redirectUri, csrfToken);
        break;
      case 'outlook':
      case 'outlook-calendar':
        authUrl = generateMicrosoftAuthUrl(provider, redirectUri, csrfToken);
        break;
      case 'slack':
        authUrl = generateSlackAuthUrl(redirectUri, csrfToken);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    // Redirect to OAuth provider
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate OAuth';
    logger.error('OAuth initiation error', error instanceof Error ? error : undefined, { route: '/api/integrations/oauth' });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

function generateGoogleAuthUrl(provider: string, redirectUri: string, csrfToken: string): string {
  const googleClientIdEnv = process.env.GOOGLE_CLIENT_ID;
  const clientId = (googleClientIdEnv !== '' && googleClientIdEnv != null) ? googleClientIdEnv : '';
  const scopes = provider === 'google-calendar'
    ? 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events'
    : 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: JSON.stringify({ provider, csrf: csrfToken }),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function generateMicrosoftAuthUrl(provider: string, redirectUri: string, csrfToken: string): string {
  const msClientIdEnv = process.env.MICROSOFT_CLIENT_ID;
  const clientId = (msClientIdEnv !== '' && msClientIdEnv != null) ? msClientIdEnv : '';
  const msTenantIdEnv = process.env.MICROSOFT_TENANT_ID;
  const tenantId = (msTenantIdEnv !== '' && msTenantIdEnv != null) ? msTenantIdEnv : 'common';
  const scopes = provider === 'outlook-calendar'
    ? 'https://graph.microsoft.com/Calendars.ReadWrite'
    : 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    response_mode: 'query',
    state: JSON.stringify({ provider, csrf: csrfToken }),
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

function generateSlackAuthUrl(redirectUri: string, csrfToken: string): string {
  const slackClientIdEnv = process.env.SLACK_CLIENT_ID;
  const clientId = (slackClientIdEnv !== '' && slackClientIdEnv != null) ? slackClientIdEnv : '';
  const scopes = 'chat:write,channels:read,users:read';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: JSON.stringify({ provider: 'slack', csrf: csrfToken }),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
