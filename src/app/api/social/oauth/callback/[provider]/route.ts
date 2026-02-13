/**
 * Social OAuth Callback Route
 * GET /api/social/oauth/callback/[provider]
 *
 * Handles the OAuth redirect: exchanges code for tokens, fetches profile,
 * creates social account, and redirects to settings.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { socialProviderSchema, oauthCallbackQuerySchema } from '@/lib/social/social-oauth-schemas';
import {
  exchangeTwitterCode,
  exchangeLinkedInCode,
  fetchTwitterProfile,
  fetchLinkedInProfile,
  encryptCredentials,
} from '@/lib/social/social-oauth-service';
import { SocialAccountService } from '@/lib/social/social-account-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const settingsUrl = `${appUrl}/settings/integrations`;

  try {
    const { provider } = await params;

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/oauth/callback');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Validate provider
    const providerValidation = socialProviderSchema.safeParse(provider);
    if (!providerValidation.success) {
      return NextResponse.redirect(`${settingsUrl}?error=invalid_provider`);
    }

    const validProvider = providerValidation.data;

    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = oauthCallbackQuerySchema.safeParse({
      code: searchParams.get('code'),
      state: searchParams.get('state'),
    });

    if (!queryValidation.success) {
      logger.warn('OAuth callback: invalid query params', {
        route: '/api/social/oauth/callback',
        provider: validProvider,
        errors: queryValidation.error.errors.map((e) => e.message).join(', '),
      });
      return NextResponse.redirect(`${settingsUrl}?error=invalid_callback&category=social`);
    }

    const { code, state } = queryValidation.data;

    logger.info('Processing social OAuth callback', {
      route: '/api/social/oauth/callback',
      provider: validProvider,
    });

    // Exchange code for tokens and fetch profile
    switch (validProvider) {
      case 'twitter': {
        const { tokens } = await exchangeTwitterCode(code, state);
        const profile = await fetchTwitterProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        await SocialAccountService.addAccount({
          platform: 'twitter',
          accountName: profile.name,
          handle: profile.username,
          profileImageUrl: profile.profileImageUrl,
          isDefault: true,
          status: 'active',
          credentials: {
            clientId: process.env.TWITTER_CLIENT_ID ?? '',
            clientSecret: process.env.TWITTER_CLIENT_SECRET ?? '',
            accessToken: encrypted.accessToken,
            refreshToken: encrypted.refreshToken,
            tokenExpiresAt: encrypted.tokenExpiresAt,
          },
        });

        logger.info('Twitter account connected via OAuth', {
          route: '/api/social/oauth/callback',
          handle: profile.username,
        });

        return NextResponse.redirect(`${settingsUrl}?success=twitter&category=social`);
      }

      case 'linkedin': {
        const { tokens } = await exchangeLinkedInCode(code, state);
        const profile = await fetchLinkedInProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        await SocialAccountService.addAccount({
          platform: 'linkedin',
          accountName: profile.name,
          handle: profile.vanityName ?? profile.id,
          profileImageUrl: profile.profileImageUrl,
          isDefault: true,
          status: 'active',
          credentials: {
            accessToken: encrypted.accessToken,
            refreshToken: encrypted.refreshToken,
            tokenExpiresAt: encrypted.tokenExpiresAt,
          },
        });

        logger.info('LinkedIn account connected via OAuth', {
          route: '/api/social/oauth/callback',
          name: profile.name,
        });

        return NextResponse.redirect(`${settingsUrl}?success=linkedin&category=social`);
      }

      default: {
        const _exhaustive: never = validProvider;
        return NextResponse.redirect(
          `${settingsUrl}?error=unsupported_provider&provider=${String(_exhaustive)}`
        );
      }
    }
  } catch (error) {
    logger.error(
      'Social OAuth callback error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/social/oauth/callback' }
    );

    const message = error instanceof Error ? error.message : 'unknown';
    const errorParam = message.includes('expired') ? 'state_expired' : 'callback_failed';

    return NextResponse.redirect(`${settingsUrl}?error=${errorParam}&category=social`);
  }
}
