/**
 * Social OAuth Initiation Route
 * GET /api/social/oauth/auth/[provider]
 *
 * Generates an OAuth authorization URL and redirects the user to the platform.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { oauthRedirectProviderSchema } from '@/lib/social/social-oauth-schemas';
import {
  generateLinkedInAuthUrl,
  generateMetaAuthUrl,
  generateGoogleSocialAuthUrl,
  generateTikTokAuthUrl,
  generatePinterestAuthUrl,
  generateDiscordAuthUrl,
  generateTwitchAuthUrl,
} from '@/lib/social/social-oauth-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/oauth/auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Validate provider against the OAuth-redirect whitelist. Excludes
    // X (Twitter) — manual OAuth 1.0a entry only — and the credential-
    // only platforms (Bluesky, Mastodon).
    const providerValidation = oauthRedirectProviderSchema.safeParse(provider);
    if (!providerValidation.success) {
      if (provider === 'twitter') {
        return errors.badRequest('X (Twitter) requires manual API key setup, not OAuth. Open Settings > Integrations > X to enter credentials.');
      }
      return errors.badRequest(`OAuth not supported for provider: ${provider}. Use Settings > Integrations to enter credentials manually.`);
    }

    const validProvider = providerValidation.data;
    const userId = authResult.user.uid;

    logger.info('Starting social OAuth flow', {
      route: '/api/social/oauth/auth',
      provider: validProvider,
      userId,
    });

    let authUrl: string;

    switch (validProvider) {
      case 'linkedin':
        authUrl = await generateLinkedInAuthUrl(userId);
        break;
      case 'facebook':
      case 'instagram':
      case 'threads':
      case 'whatsapp_business':
        // All Meta platforms use the same Facebook OAuth flow
        authUrl = await generateMetaAuthUrl(userId);
        break;
      case 'youtube':
        authUrl = await generateGoogleSocialAuthUrl(userId, [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube',
        ], 'youtube');
        break;
      case 'google_business':
        authUrl = await generateGoogleSocialAuthUrl(userId, [
          'https://www.googleapis.com/auth/business.manage',
        ], 'google_business');
        break;
      case 'tiktok':
        authUrl = await generateTikTokAuthUrl(userId);
        break;
      case 'pinterest':
        authUrl = await generatePinterestAuthUrl(userId);
        break;
      case 'discord':
        authUrl = await generateDiscordAuthUrl(userId);
        break;
      case 'twitch':
        authUrl = await generateTwitchAuthUrl(userId);
        break;
      default:
        // Platforms without OAuth flow yet — return helpful error
        return errors.badRequest(`OAuth not yet configured for ${validProvider}. Please add credentials manually via Settings > Integrations.`);
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error(
      'Social OAuth auth initiation error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/social/oauth/auth' }
    );

    const message = error instanceof Error ? error.message : 'OAuth initiation failed';
    if (message.includes('not configured')) {
      return errors.badRequest(message);
    }

    return errors.externalService('OAuth', error instanceof Error ? error : undefined);
  }
}
