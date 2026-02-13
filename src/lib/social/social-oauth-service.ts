/**
 * Social OAuth Service
 * Handles OAuth flows for Twitter (PKCE) and LinkedIn social platforms.
 * Generates auth URLs, exchanges codes for tokens, fetches profiles.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger/logger';
import { encryptToken } from '@/lib/security/token-encryption';
import { FirestoreService } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { SocialOAuthState, SocialOAuthTokenResult } from '@/types/social';

const OAUTH_STATES_PATH = `organizations/${PLATFORM_ID}/socialOAuthStates`;
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
  provider: 'twitter' | 'linkedin',
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
  expectedProvider: 'twitter' | 'linkedin'
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
