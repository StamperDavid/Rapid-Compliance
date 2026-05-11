/**
 * Meta Ads OAuth — callback after operator consents on facebook.com.
 *
 * GET /api/integrations/meta-ads/callback?code=...&state=...
 *   1. Validate state.
 *   2. Exchange code for short-lived token.
 *   3. Exchange short-lived for long-lived (~60d) token.
 *   4. Fetch FB user id (/me) for the connection record.
 *   5. List the operator's ad accounts. If exactly one, auto-select; if
 *      multiple, redirect to settings with the long-lived token in a one-time
 *      cookie so the operator can pick one (NOT implemented yet — for now we
 *      auto-pick the first ad account and surface a note in status).
 *
 * Token + ad-account ID are saved to apiKeys.metaAds (encrypted).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { validateOAuthState } from '@/lib/security/oauth-state';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getMetaUserId,
  listAdAccounts,
  saveMetaAdsConfig,
} from '@/lib/integrations/meta-ads-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

function settingsRedirect(host: string, protocol: string, params: Record<string, string>): NextResponse {
  const url = new URL(`${protocol}://${host}/settings/integrations?category=marketing-ads`);
  for (const [k, v] of Object.entries(params)) {url.searchParams.set(k, v);}
  return NextResponse.redirect(url.toString());
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('host') ?? 'localhost:3000';

  if (errorParam) {
    logger.warn('[MetaAdsOAuth] user denied or error during consent', { errorParam, errorDescription });
    return settingsRedirect(host, protocol, { error: errorDescription ?? errorParam });
  }

  if (!code || !state) {
    return settingsRedirect(host, protocol, { error: 'missing code or state' });
  }

  const stateUserId = await validateOAuthState(state, 'meta-ads');
  if (!stateUserId) {
    return settingsRedirect(host, protocol, { error: 'invalid OAuth state' });
  }

  const appId = process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return settingsRedirect(host, protocol, { error: 'META_APP_ID/SECRET env not set' });
  }

  const redirectUri = `${protocol}://${host}/api/integrations/meta-ads/callback`;

  // Step 1: short-lived token
  const shortLivedResult = await exchangeCodeForToken({ appId, appSecret, redirectUri, code });
  if (!shortLivedResult.accessToken) {
    return settingsRedirect(host, protocol, { error: shortLivedResult.error ?? 'token exchange failed' });
  }

  // Step 2: long-lived token (~60d)
  const longLivedResult = await exchangeForLongLivedToken({
    appId,
    appSecret,
    shortLivedToken: shortLivedResult.accessToken,
  });
  if (!longLivedResult.accessToken) {
    return settingsRedirect(host, protocol, { error: longLivedResult.error ?? 'long-lived token exchange failed' });
  }

  // Step 3: who is this?
  const userId = await getMetaUserId(longLivedResult.accessToken);
  if (!userId) {
    return settingsRedirect(host, protocol, { error: 'could not resolve Meta user id from token' });
  }

  // Step 4: pick an ad account. Auto-pick the first if exactly one; for
  // multi-account operators, surface them in a note for now and save the
  // first one as a default (operator can change via save-config later).
  const adAccounts = await listAdAccounts(longLivedResult.accessToken);
  if (adAccounts.length === 0) {
    return settingsRedirect(host, protocol, { error: 'no ad accounts visible to this Meta user — check Business Manager permissions' });
  }

  const tokenExpiresAt = longLivedResult.expiresIn ? Date.now() + longLivedResult.expiresIn * 1000 : null;
  const saved = await saveMetaAdsConfig({
    accessToken: longLivedResult.accessToken,
    adAccountId: adAccounts[0]?.id ?? '',
    tokenExpiresAt,
    scope: 'ads_management ads_read business_management',
    userId,
  });

  if (!saved.success) {
    return settingsRedirect(host, protocol, { error: saved.error ?? 'config save failed' });
  }

  logger.info('[MetaAdsOAuth] connected', { userId, adAccountsCount: adAccounts.length, chosenAdAccount: adAccounts[0]?.id });
  return settingsRedirect(host, protocol, {
    success: 'meta-ads',
    ...(adAccounts.length > 1 ? { adAccountChoices: String(adAccounts.length) } : {}),
  });
}
