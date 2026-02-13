/**
 * Social OAuth Zod Schemas
 * Validation schemas for social media OAuth flows
 */

import { z } from 'zod';

export const socialProviderSchema = z.enum(['twitter', 'linkedin']);

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
