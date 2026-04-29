/**
 * Social OAuth Service
 * Handles OAuth flows for Twitter (PKCE), LinkedIn, Meta (Facebook/Instagram/Threads/WhatsApp),
 * Google (YouTube + Google Business Profile), TikTok, Reddit, and Pinterest.
 * Generates auth URLs, exchanges codes for tokens, fetches profiles.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger/logger';
import { encryptToken } from '@/lib/security/token-encryption';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialOAuthState, SocialOAuthTokenResult, SocialPlatform } from '@/types/social';

const OAUTH_STATES_PATH = getSubCollection('socialOAuthStates');
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ─── State Management ─────────────────────────────────────────────────────────

async function storeOAuthState(
  userId: string,
  provider: SocialPlatform,
  codeVerifier?: string
): Promise<string> {
  const stateToken = crypto.randomBytes(32).toString('hex');

  const stateData: SocialOAuthState = {
    userId,
    provider,
    codeVerifier,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  };

  await FirestoreService.set(OAUTH_STATES_PATH, stateToken, stateData, false);
  return stateToken;
}

async function retrieveAndDeleteOAuthState(
  stateToken: string,
  expectedProvider: SocialPlatform
): Promise<SocialOAuthState | null> {
  try {
    const raw = await FirestoreService.get(OAUTH_STATES_PATH, stateToken);
    if (!raw) {
      logger.warn('Social OAuth state not found', { statePrefix: stateToken.substring(0, 8) });
      return null;
    }

    const stateData = raw as SocialOAuthState;

    if (new Date(stateData.expiresAt) < new Date()) {
      logger.warn('Social OAuth state expired', { provider: stateData.provider });
      await FirestoreService.delete(OAUTH_STATES_PATH, stateToken);
      return null;
    }

    if (stateData.provider !== expectedProvider) {
      logger.warn('Social OAuth state provider mismatch', {
        expected: expectedProvider,
        actual: stateData.provider,
      });
      await FirestoreService.delete(OAUTH_STATES_PATH, stateToken);
      return null;
    }

    // Delete to prevent reuse
    await FirestoreService.delete(OAUTH_STATES_PATH, stateToken);
    return stateData;
  } catch (error) {
    logger.error(
      'Social OAuth state retrieval error',
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

// ─── Twitter OAuth 2.0 (PKCE) ────────────────────────────────────────────────

export async function generateTwitterAuthUrl(userId: string): Promise<string> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    throw new Error('TWITTER_CLIENT_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/twitter`;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = await storeOAuthState(userId, 'twitter', codeVerifier);

  const scopes = [
    'tweet.read',
    'tweet.write',
    'users.read',
    'offline.access',
  ].join('%20');

  return (
    `https://twitter.com/i/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopes}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`
  );
}

export async function exchangeTwitterCode(
  code: string,
  stateToken: string
): Promise<{ tokens: SocialOAuthTokenResult; stateData: SocialOAuthState }> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'twitter');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/twitter`;

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: stateData.codeVerifier ?? '',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Twitter token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange Twitter authorization code');
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: data.scope,
  };

  return { tokens, stateData };
}

export async function fetchTwitterProfile(accessToken: string): Promise<{
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
}> {
  const response = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Twitter profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Twitter profile');
  }

  const data = await response.json() as {
    data: {
      id: string;
      name: string;
      username: string;
      profile_image_url?: string;
    };
  };

  return {
    id: data.data.id,
    name: data.data.name,
    username: data.data.username,
    profileImageUrl: data.data.profile_image_url,
  };
}

// ─── LinkedIn OAuth 2.0 ──────────────────────────────────────────────────────

export async function generateLinkedInAuthUrl(userId: string): Promise<string> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    throw new Error('LINKEDIN_CLIENT_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/linkedin`;
  const state = await storeOAuthState(userId, 'linkedin');

  const scopes = [
    'openid',
    'profile',
    'w_member_social',
  ].join('%20');

  return (
    `https://www.linkedin.com/oauth/v2/authorization` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scopes}` +
    `&state=${state}`
  );
}

export async function exchangeLinkedInCode(
  code: string,
  stateToken: string
): Promise<{ tokens: SocialOAuthTokenResult; stateData: SocialOAuthState }> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'linkedin');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/linkedin`;

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('LinkedIn token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange LinkedIn authorization code');
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: data.scope,
  };

  return { tokens, stateData };
}

export async function fetchLinkedInProfile(accessToken: string): Promise<{
  id: string;
  name: string;
  vanityName?: string;
  profileImageUrl?: string;
}> {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('LinkedIn profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch LinkedIn profile');
  }

  const data = await response.json() as {
    sub: string;
    name: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };

  return {
    id: data.sub,
    name: data.name,
    profileImageUrl: data.picture,
  };
}

// ─── Meta OAuth 2.0 (Facebook / Instagram / Threads / WhatsApp) ─────────────

/**
 * Meta Graph API page data returned from /me/accounts
 */
interface MetaPageData {
  id: string;
  name: string;
  access_token: string;
}

/**
 * Shape of the Instagram business account response from the Graph API
 */
interface MetaInstagramBusinessAccount {
  instagram_business_account?: { id: string };
}

export async function generateMetaAuthUrl(userId: string): Promise<string> {
  const clientId = process.env.META_APP_ID;
  if (!clientId) {
    throw new Error('META_APP_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/facebook`;
  const state = await storeOAuthState(userId, 'facebook');

  const scopes = [
    'pages_manage_posts',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
    'threads_basic',
    'threads_content_publish',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ].join(',');

  return (
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}` +
    `&response_type=code`
  );
}

export async function exchangeMetaCode(
  code: string,
  stateToken: string
): Promise<{
  tokens: SocialOAuthTokenResult;
  stateData: SocialOAuthState;
  pages: Array<{ id: string; name: string; accessToken: string }>;
  instagramAccountId?: string;
  metaUserId: string;
  userName: string;
}> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'facebook');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Meta OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/facebook`;

  // Step 1: Exchange code for short-lived token
  const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', clientId);
  tokenUrl.searchParams.set('client_secret', clientSecret);
  tokenUrl.searchParams.set('redirect_uri', redirectUri);
  tokenUrl.searchParams.set('code', code);

  const tokenResponse = await fetch(tokenUrl.toString());
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    logger.error('Meta short-lived token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange Meta authorization code');
  }

  const shortLivedData = await tokenResponse.json() as {
    access_token: string;
    token_type: string;
    expires_in?: number;
  };

  // Step 2: Exchange short-lived token for long-lived token
  const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longLivedUrl.searchParams.set('client_id', clientId);
  longLivedUrl.searchParams.set('client_secret', clientSecret);
  longLivedUrl.searchParams.set('fb_exchange_token', shortLivedData.access_token);

  const longLivedResponse = await fetch(longLivedUrl.toString());
  if (!longLivedResponse.ok) {
    const errorText = await longLivedResponse.text();
    logger.error('Meta long-lived token exchange failed', new Error(errorText));
    throw new Error('Failed to obtain long-lived Meta access token');
  }

  const longLivedTokenData = await longLivedResponse.json() as {
    access_token: string;
    token_type: string;
    expires_in?: number;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: longLivedTokenData.access_token,
    tokenExpiresAt: longLivedTokenData.expires_in
      ? new Date(Date.now() + longLivedTokenData.expires_in * 1000).toISOString()
      : undefined,
  };

  // Step 3: Fetch the user's name and ID
  const meResponse = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${tokens.accessToken}`
  );
  if (!meResponse.ok) {
    const errorText = await meResponse.text();
    logger.error('Meta user profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Meta user profile');
  }

  const meData = await meResponse.json() as { id: string; name: string };

  // Step 4: Fetch the user's Facebook pages
  const pagesResponse = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${tokens.accessToken}`
  );
  if (!pagesResponse.ok) {
    const errorText = await pagesResponse.text();
    logger.error('Meta pages fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Meta pages');
  }

  const pagesData = await pagesResponse.json() as { data: MetaPageData[] };
  const pages = (pagesData.data ?? []).map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
  }));

  // Step 5: For each page, check for linked Instagram Business account
  let instagramAccountId: string | undefined;

  for (const page of pages) {
    try {
      const igResponse = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.accessToken}`
      );
      if (igResponse.ok) {
        const igData = await igResponse.json() as MetaInstagramBusinessAccount;
        if (igData.instagram_business_account?.id) {
          instagramAccountId = igData.instagram_business_account.id;
          break; // Use the first page with a linked IG account
        }
      }
    } catch (igError) {
      logger.warn('Failed to check Instagram business account for page', {
        pageId: page.id,
        error: igError instanceof Error ? igError.message : String(igError),
      });
    }
  }

  return { tokens, stateData, pages, instagramAccountId, metaUserId: meData.id, userName: meData.name };
}

/**
 * Detect the Threads user ID for an authenticated Meta account.
 *
 * Returns { threadsUserId, username } if the user granted Threads permissions
 * and has an active Threads profile. Returns null on any failure — Threads
 * isn't fully rolled out to all Meta users, and many IG Business accounts
 * don't have a Threads profile yet, so a null result is expected and benign.
 */
export async function fetchThreadsProfile(
  accessToken: string
): Promise<{ threadsUserId: string; username?: string } | null> {
  try {
    const response = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json() as { id?: string; username?: string };
    if (!data.id) { return null; }
    return { threadsUserId: data.id, username: data.username };
  } catch (error) {
    logger.warn('Threads profile fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

interface WhatsAppPhoneNumber {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  businessAccountId: string;
}

/**
 * Detect the WhatsApp Business phone numbers the authenticated Meta user can
 * post from.
 *
 * Meta requires the user to have set up a WhatsApp Business Account (WABA)
 * under a Meta Business — this is not automatic with OAuth consent. Returns
 * an empty array when no WABA is configured, which is the common case.
 */
export async function fetchWhatsAppPhoneNumbers(
  accessToken: string
): Promise<WhatsAppPhoneNumber[]> {
  try {
    // One nested query pulls businesses → WABAs → phone numbers in a single call.
    const url = `https://graph.facebook.com/v19.0/me?fields=${encodeURIComponent(
      'businesses{owned_whatsapp_business_accounts{id,phone_numbers{id,display_phone_number}}}'
    )}&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url);
    if (!response.ok) { return []; }

    interface NestedResponse {
      businesses?: {
        data?: Array<{
          owned_whatsapp_business_accounts?: {
            data?: Array<{
              id: string;
              phone_numbers?: {
                data?: Array<{ id: string; display_phone_number?: string }>;
              };
            }>;
          };
        }>;
      };
    }

    const data = await response.json() as NestedResponse;
    const results: WhatsAppPhoneNumber[] = [];
    for (const biz of data.businesses?.data ?? []) {
      for (const waba of biz.owned_whatsapp_business_accounts?.data ?? []) {
        for (const phone of waba.phone_numbers?.data ?? []) {
          results.push({
            phoneNumberId: phone.id,
            displayPhoneNumber: phone.display_phone_number,
            businessAccountId: waba.id,
          });
        }
      }
    }
    return results;
  } catch (error) {
    logger.warn('WhatsApp phone numbers fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ─── Google OAuth 2.0 (YouTube + Google Business Profile) ────────────────────

/**
 * Generate a Google OAuth URL for YouTube or Google Business Profile.
 * Both use Google's OAuth 2.0 but with different scopes and redirect URIs.
 */
export async function generateGoogleSocialAuthUrl(
  userId: string,
  scopes: string[],
  provider: 'youtube' | 'google_business'
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/${provider}`;
  const state = await storeOAuthState(userId, provider);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleSocialCode(
  code: string,
  stateToken: string,
  provider: 'youtube' | 'google_business'
): Promise<{ tokens: SocialOAuthTokenResult; stateData: SocialOAuthState }> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, provider);
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/${provider}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Google token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange Google authorization code');
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: data.scope,
  };

  return { tokens, stateData };
}

/**
 * Fetch the authenticated user's YouTube channel info.
 */
export async function fetchYouTubeChannel(accessToken: string): Promise<{
  channelId: string;
  title: string;
  thumbnailUrl?: string;
}> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('YouTube channel fetch failed', new Error(errorText));
    throw new Error('Failed to fetch YouTube channel');
  }

  const data = await response.json() as {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        thumbnails?: {
          default?: { url: string };
        };
      };
    }>;
  };

  const channel = data.items?.[0];
  if (!channel) {
    throw new Error('No YouTube channel found for this Google account');
  }

  return {
    channelId: channel.id,
    title: channel.snippet.title,
    thumbnailUrl: channel.snippet.thumbnails?.default?.url,
  };
}

/**
 * Fetch the authenticated user's Google profile (used for Google Business).
 */
export async function fetchGoogleProfile(accessToken: string): Promise<{
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string;
}> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Google profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Google profile');
  }

  const data = await response.json() as {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    profileImageUrl: data.picture,
  };
}

// ─── TikTok OAuth 2.0 ──────────────────────────────────────────────────────

export async function generateTikTokAuthUrl(userId: string): Promise<string> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    throw new Error('TIKTOK_CLIENT_KEY environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/tiktok`;
  const state = await storeOAuthState(userId, 'tiktok');

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: 'video.upload,video.publish',
    redirect_uri: redirectUri,
    state,
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeTikTokCode(
  code: string,
  stateToken: string
): Promise<{
  tokens: SocialOAuthTokenResult;
  stateData: SocialOAuthState;
  openId: string;
}> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'tiktok');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error('TikTok OAuth credentials not configured');
  }

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/tiktok`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('TikTok token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange TikTok authorization code');
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    open_id: string;
    scope?: string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: data.scope,
  };

  return { tokens, stateData, openId: data.open_id };
}

/**
 * Fetch TikTok user display name for account labeling.
 */
export async function fetchTikTokProfile(accessToken: string): Promise<{
  openId: string;
  displayName: string;
  avatarUrl?: string;
}> {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('TikTok profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch TikTok profile');
  }

  const data = await response.json() as {
    data: {
      user: {
        open_id: string;
        display_name: string;
        avatar_url?: string;
      };
    };
  };

  return {
    openId: data.data.user.open_id,
    displayName: data.data.user.display_name,
    avatarUrl: data.data.user.avatar_url,
  };
}

// ─── Reddit OAuth 2.0 ──────────────────────────────────────────────────────

export async function generateRedditAuthUrl(userId: string): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  if (!clientId) {
    throw new Error('REDDIT_CLIENT_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/reddit`;
  const state = await storeOAuthState(userId, 'reddit');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: redirectUri,
    duration: 'permanent',
    scope: 'submit,identity',
  });

  return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
}

export async function exchangeRedditCode(
  code: string,
  stateToken: string
): Promise<{ tokens: SocialOAuthTokenResult; stateData: SocialOAuthState }> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'reddit');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Reddit OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/reddit`;

  // Reddit requires HTTP Basic auth with client_id:client_secret
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Reddit token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange Reddit authorization code');
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: data.scope,
  };

  return { tokens, stateData };
}

/**
 * Fetch Reddit user identity (username).
 */
export async function fetchRedditProfile(accessToken: string): Promise<{
  id: string;
  name: string;
  iconUrl?: string;
}> {
  const response = await fetch('https://oauth.reddit.com/api/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'SalesVelocity/1.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Reddit profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Reddit profile');
  }

  const data = await response.json() as {
    id: string;
    name: string;
    icon_img?: string;
  };

  return {
    id: data.id,
    name: data.name,
    iconUrl: data.icon_img,
  };
}

// ─── Pinterest OAuth 2.0 ────────────────────────────────────────────────────

export async function generatePinterestAuthUrl(userId: string): Promise<string> {
  const appId = process.env.PINTEREST_APP_ID;
  if (!appId) {
    throw new Error('PINTEREST_APP_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/pinterest`;
  const state = await storeOAuthState(userId, 'pinterest');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'boards:read,pins:read,pins:write',
    state,
  });

  return `https://api.pinterest.com/oauth/?${params.toString()}`;
}

export async function exchangePinterestCode(
  code: string,
  stateToken: string
): Promise<{ tokens: SocialOAuthTokenResult; stateData: SocialOAuthState }> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'pinterest');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const appId = process.env.PINTEREST_APP_ID;
  const appSecret = process.env.PINTEREST_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('Pinterest OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/pinterest`;

  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Pinterest token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange Pinterest authorization code');
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: data.scope,
  };

  return { tokens, stateData };
}

/**
 * Fetch Pinterest user profile for account labeling.
 */
export async function fetchPinterestProfile(accessToken: string): Promise<{
  username: string;
  profileImageUrl?: string;
}> {
  const response = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Pinterest profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Pinterest profile');
  }

  const data = await response.json() as {
    username: string;
    profile_image?: string;
  };

  return {
    username: data.username,
    profileImageUrl: data.profile_image,
  };
}

// ─── Discord OAuth 2.0 ──────────────────────────────────────────────────────
// Tenants OAuth into the central SalesVelocity Discord application to grant
// the bot access to a server they administer. Scopes:
//   - bot                 install the bot into a guild
//   - applications.commands  register slash commands
//   - identify             read connecting user identity for display
//   - guilds               list servers the user can administer
//
// The `bot` scope makes Discord present a server-picker on consent — the
// authenticating user selects which guild to install into. We persist
// guildId from the callback's `guild` query param (Discord includes it
// when the bot scope is requested with `permissions=`).

export async function generateDiscordAuthUrl(userId: string): Promise<string> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error('DISCORD_CLIENT_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/discord`;
  const state = await storeOAuthState(userId, 'discord');

  // Permissions integer: Send Messages (2048) + Manage Webhooks (536870912)
  // + Create Events (8589934592) + View Channels (1024) = 9126805504.
  // Operator can broaden in Discord dev portal post-install.
  const permissions = '9126805504';

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: redirectUri,
    scope: 'bot applications.commands identify guilds',
    permissions,
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(
  code: string,
  stateToken: string,
): Promise<{ tokens: SocialOAuthTokenResult; stateData: SocialOAuthState }> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'discord');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Discord OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/discord`;

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Discord token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange Discord authorization code');
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: data.scope,
  };

  return { tokens, stateData };
}

/**
 * Fetch the connecting Discord user's identity (id + username) for display.
 * Note: the connected RESOURCE is the guild (server), not the user — but
 * we still capture the user who installed for audit purposes.
 */
export async function fetchDiscordProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  avatarUrl?: string;
}> {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Discord profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Discord profile');
  }

  const data = (await response.json()) as {
    id: string;
    username: string;
    avatar?: string;
  };

  return {
    id: data.id,
    username: data.username,
    avatarUrl: data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
      : undefined,
  };
}

// ─── Twitch OAuth 2.0 ───────────────────────────────────────────────────────
// Tenants OAuth into the central SalesVelocity Twitch application to grant
// the connected channel write access. Scopes:
//   - channel:manage:broadcast        modify channel info (title, category, tags)
//   - moderator:manage:announcements  send chat announcements
//   - clips:edit                       create clips
//   - channel:manage:schedule          create schedule segments
//   - moderator:read:followers         read follower list (metrics)
//   - user:read:email                  basic profile

export async function generateTwitchAuthUrl(userId: string): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error('TWITCH_CLIENT_ID environment variable is not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/twitch`;
  const state = await storeOAuthState(userId, 'twitch');

  const scope = [
    'channel:manage:broadcast',
    'moderator:manage:announcements',
    'clips:edit',
    'channel:manage:schedule',
    'moderator:read:followers',
    'user:read:email',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: redirectUri,
    scope,
  });

  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

export async function exchangeTwitchCode(
  code: string,
  stateToken: string,
): Promise<{ tokens: SocialOAuthTokenResult; stateData: SocialOAuthState }> {
  const stateData = await retrieveAndDeleteOAuthState(stateToken, 'twitch');
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Twitch OAuth credentials not configured');
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/oauth/callback/twitch`;

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Twitch token exchange failed', new Error(errorText));
    throw new Error('Failed to exchange Twitch authorization code');
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string[] | string;
  };

  const tokens: SocialOAuthTokenResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    scope: Array.isArray(data.scope) ? data.scope.join(' ') : data.scope,
  };

  return { tokens, stateData };
}

/**
 * Fetch the connected Twitch user (broadcaster id + login) via Helix.
 * Required to get broadcaster_id for posting endpoints.
 */
export async function fetchTwitchProfile(accessToken: string): Promise<{
  id: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
}> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error('TWITCH_CLIENT_ID environment variable is not configured');
  }

  const response = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Twitch profile fetch failed', new Error(errorText));
    throw new Error('Failed to fetch Twitch profile');
  }

  const data = (await response.json()) as {
    data?: Array<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url?: string;
    }>;
  };

  const user = data.data?.[0];
  if (!user) {
    throw new Error('Twitch /users returned empty data array');
  }

  return {
    id: user.id,
    login: user.login,
    displayName: user.display_name,
    profileImageUrl: user.profile_image_url,
  };
}

// ─── Token Encryption Helpers ─────────────────────────────────────────────────

export function encryptCredentials(tokens: SocialOAuthTokenResult): {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
} {
  return {
    accessToken: encryptToken(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
    tokenExpiresAt: tokens.tokenExpiresAt,
  };
}
