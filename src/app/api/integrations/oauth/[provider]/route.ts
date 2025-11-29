import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { organizationIdSchema } from '@/lib/validation/schemas';

/**
 * OAuth Integration Routes
 * Handles OAuth flows for Gmail, Outlook, Google Calendar, etc.
 * Note: This route redirects to OAuth provider, so auth is checked but no rate limiting
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    // Authentication (but allow redirect even if not fully authenticated for OAuth flow)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse && process.env.NODE_ENV === 'production') {
      // In production, require auth
      return authResult;
    }
    
    const user = authResult instanceof NextResponse 
      ? { uid: 'dev-user', organizationId: 'dev-org' } // Dev fallback
      : authResult.user;

    const provider = params.provider;
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const redirectUri = searchParams.get('redirectUri') || `${request.nextUrl.origin}/api/integrations/oauth/${provider}/callback`;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Validate organizationId format
    const orgValidation = organizationIdSchema.safeParse(organizationId);
    if (!orgValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid organizationId format' },
        { status: 400 }
      );
    }

    // Verify user has access to this organization (if authenticated)
    if (user.organizationId && user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Generate OAuth URLs for different providers
    let authUrl = '';

    switch (provider) {
      case 'gmail':
      case 'google-calendar':
        authUrl = generateGoogleAuthUrl(provider, redirectUri, organizationId);
        break;
      case 'outlook':
      case 'outlook-calendar':
        authUrl = generateMicrosoftAuthUrl(provider, redirectUri, organizationId);
        break;
      case 'slack':
        authUrl = generateSlackAuthUrl(redirectUri, organizationId);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    // Redirect to OAuth provider
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}

function generateGoogleAuthUrl(provider: string, redirectUri: string, organizationId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
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
    state: JSON.stringify({ provider, organizationId }),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function generateMicrosoftAuthUrl(provider: string, redirectUri: string, organizationId: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID || '';
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const scopes = provider === 'outlook-calendar'
    ? 'https://graph.microsoft.com/Calendars.ReadWrite'
    : 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read';
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    response_mode: 'query',
    state: JSON.stringify({ provider, organizationId }),
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

function generateSlackAuthUrl(redirectUri: string, organizationId: string): string {
  const clientId = process.env.SLACK_CLIENT_ID || '';
  const scopes = 'chat:write,channels:read,users:read';
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: JSON.stringify({ provider: 'slack', organizationId }),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
