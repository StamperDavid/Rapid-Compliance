/**
 * Meta Ads OAuth — start authorize flow.
 *
 * GET /api/integrations/meta-ads/auth
 *   Returns { authUrl } with the Facebook OAuth dialog URL pre-loaded with
 *   ads_management + ads_read + business_management scope. Client redirects
 *   the operator there; FB calls our callback after consent.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { generateOAuthState } from '@/lib/security/oauth-state';
import { buildMetaAdsAuthorizeUrl } from '@/lib/integrations/meta-ads-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) {return auth;}

  const appId = process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { success: false, error: 'META_APP_ID (or FACEBOOK_APP_ID) env var not set' },
      { status: 500 },
    );
  }

  const state = await generateOAuthState(auth.user.uid, 'meta-ads');
  const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('host') ?? 'localhost:3000';
  const redirectUri = `${protocol}://${host}/api/integrations/meta-ads/callback`;

  const authUrl = buildMetaAdsAuthorizeUrl({ appId, redirectUri, state });
  logger.info('[MetaAdsOAuth] authorize URL issued', { redirectUri });
  return NextResponse.json({ success: true, authUrl });
}
