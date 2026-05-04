/**
 * Social OAuth Zod Schemas
 * Validation schemas for social media OAuth flows
 */

import { z } from 'zod';
import { SOCIAL_PLATFORMS } from '@/types/social';

/**
 * Generic provider validator — accepts any value in SOCIAL_PLATFORMS.
 * Used by inbox/listening/etc. routes where every platform is a valid
 * lookup key.
 */
export const socialProviderSchema = z.enum(SOCIAL_PLATFORMS);

/**
 * OAuth-redirect provider whitelist.
 *
 * Excludes platforms that don't have a hosted OAuth flow we can initiate:
 *   - `twitter` — uses OAuth 1.0a manual credential entry; OAuth 2.0 PKCE
 *     was removed because it doesn't cover free-tier write endpoints.
 *   - `bluesky`, `mastodon`, `truth_social`, `telegram` — credential-only.
 *
 * The OAuth auth/callback routes use this stricter list so a stray
 * `/api/social/oauth/auth/twitter` returns 400 instead of an opaque
 * "not configured" path.
 */
export const oauthRedirectProviderSchema = z.enum([
  'linkedin',
  'facebook',
  'instagram',
  'threads',
  'whatsapp_business',
  'youtube',
  'google_business',
  'tiktok',
  'reddit',
  'pinterest',
  'discord',
  'twitch',
]);

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

export const manualTwitterCredentialsSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  accessToken: z.string().min(1, 'Access Token is required'),
  refreshToken: z.string().optional(),
  bearerToken: z.string().optional(),
  accountName: z.string().min(1, 'Account name is required'),
  handle: z.string().min(1, 'Handle is required'),
});

export const manualLinkedInCredentialsSchema = z.object({
  accessToken: z.string().min(1, 'Access Token is required'),
  refreshToken: z.string().optional(),
  orgId: z.string().optional(),
  accountName: z.string().min(1, 'Account name is required'),
  handle: z.string().min(1, 'Handle is required'),
});

export const verifyAccountSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
});

export type SocialProvider = z.infer<typeof socialProviderSchema>;
export type ManualTwitterCredentials = z.infer<typeof manualTwitterCredentialsSchema>;
export type ManualLinkedInCredentials = z.infer<typeof manualLinkedInCredentialsSchema>;
