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
  exchangeMetaCode,
  exchangeGoogleSocialCode,
  exchangeTikTokCode,
  exchangeRedditCode,
  exchangePinterestCode,
  exchangeDiscordCode,
  exchangeTwitchCode,
  fetchTwitterProfile,
  fetchLinkedInProfile,
  fetchYouTubeChannel,
  fetchGoogleProfile,
  fetchTikTokProfile,
  fetchRedditProfile,
  fetchPinterestProfile,
  fetchDiscordProfile,
  fetchTwitchProfile,
  fetchThreadsProfile,
  fetchWhatsAppPhoneNumbers,
  encryptCredentials,
} from '@/lib/social/social-oauth-service';
import { SocialAccountService } from '@/lib/social/social-account-service';
import type {
  MetaCredentials,
  GoogleSocialCredentials,
  TikTokCredentials,
  RedditCredentials,
  PinterestCredentials,
  DiscordCredentials,
  TwitchCredentials,
} from '@/types/social';

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

      case 'facebook': {
        const metaResult = await exchangeMetaCode(code, state);
        const encrypted = encryptCredentials(metaResult.tokens);

        // Encrypt each page access token individually
        const encryptedPages = metaResult.pages.map((page) => ({
          id: page.id,
          name: page.name,
          accessToken: encryptCredentials({
            accessToken: page.accessToken,
          }).accessToken,
        }));

        const baseMetaCredentials: MetaCredentials = {
          accessToken: encrypted.accessToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          pages: encryptedPages,
          instagramAccountId: metaResult.instagramAccountId,
          metaUserId: metaResult.metaUserId,
        };

        const subPlatformsConnected: string[] = [];

        // Facebook record — one per user, always created since a Meta login
        // that returned a valid userName is at minimum usable for the FB Graph
        // even if no pages are linked yet.
        await SocialAccountService.addAccount({
          platform: 'facebook',
          accountName: metaResult.userName,
          handle: metaResult.metaUserId,
          isDefault: true,
          status: 'active',
          credentials: baseMetaCredentials,
        });
        subPlatformsConnected.push('facebook');

        // Instagram record — only if the user has an IG Business account
        // linked to one of their pages. instagram-service looks up accounts
        // by platform === 'instagram', so without this the account was
        // invisible even after a successful Meta OAuth.
        if (metaResult.instagramAccountId) {
          await SocialAccountService.addAccount({
            platform: 'instagram',
            accountName: `${metaResult.userName} (Instagram)`,
            handle: metaResult.instagramAccountId,
            isDefault: true,
            status: 'active',
            credentials: baseMetaCredentials,
          });
          subPlatformsConnected.push('instagram');
        }

        // Threads record — Threads is opt-in per user on Meta's side, so we
        // probe graph.threads.net/me to see if the account has an active
        // Threads profile. fetchThreadsProfile returns null when the user
        // has no Threads profile or didn't grant threads scopes.
        const threadsProfile = await fetchThreadsProfile(metaResult.tokens.accessToken);
        if (threadsProfile) {
          await SocialAccountService.addAccount({
            platform: 'threads',
            accountName: threadsProfile.username
              ? `@${threadsProfile.username}`
              : `${metaResult.userName} (Threads)`,
            handle: threadsProfile.threadsUserId,
            isDefault: true,
            status: 'active',
            credentials: baseMetaCredentials,
          });
          subPlatformsConnected.push('threads');
        }

        // WhatsApp Business record — one record per phone number under any
        // WABA the user owns. Most users don't have a WABA configured, in
        // which case the array is empty and no record is created.
        const waPhones = await fetchWhatsAppPhoneNumbers(metaResult.tokens.accessToken);
        for (const phone of waPhones) {
          await SocialAccountService.addAccount({
            platform: 'whatsapp_business',
            accountName: phone.displayPhoneNumber
              ? `WhatsApp ${phone.displayPhoneNumber}`
              : `WhatsApp ${phone.phoneNumberId}`,
            handle: phone.phoneNumberId,
            isDefault: true,
            status: 'active',
            credentials: baseMetaCredentials,
          });
          subPlatformsConnected.push('whatsapp_business');
        }

        logger.info('Meta account connected via OAuth', {
          route: '/api/social/oauth/callback',
          userName: metaResult.userName,
          pagesCount: metaResult.pages.length,
          subPlatformsConnected,
        });

        return NextResponse.redirect(`${settingsUrl}?success=facebook&category=social`);
      }

      case 'youtube': {
        const { tokens } = await exchangeGoogleSocialCode(code, state, 'youtube');
        const channel = await fetchYouTubeChannel(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        const ytCredentials: GoogleSocialCredentials = {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          channelId: channel.channelId,
          scope: tokens.scope,
        };

        await SocialAccountService.addAccount({
          platform: 'youtube',
          accountName: channel.title,
          handle: channel.channelId,
          profileImageUrl: channel.thumbnailUrl,
          isDefault: true,
          status: 'active',
          credentials: ytCredentials,
        });

        logger.info('YouTube account connected via OAuth', {
          route: '/api/social/oauth/callback',
          channelId: channel.channelId,
          title: channel.title,
        });

        return NextResponse.redirect(`${settingsUrl}?success=youtube&category=social`);
      }

      case 'google_business': {
        const { tokens } = await exchangeGoogleSocialCode(code, state, 'google_business');
        const profile = await fetchGoogleProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        const gbCredentials: GoogleSocialCredentials = {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          scope: tokens.scope,
        };

        await SocialAccountService.addAccount({
          platform: 'google_business',
          accountName: profile.name,
          handle: profile.email,
          profileImageUrl: profile.profileImageUrl,
          isDefault: true,
          status: 'active',
          credentials: gbCredentials,
        });

        logger.info('Google Business Profile connected via OAuth', {
          route: '/api/social/oauth/callback',
          name: profile.name,
          email: profile.email,
        });

        return NextResponse.redirect(`${settingsUrl}?success=google_business&category=social`);
      }

      case 'tiktok': {
        const { tokens, openId } = await exchangeTikTokCode(code, state);
        const profile = await fetchTikTokProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        const ttCredentials: TikTokCredentials = {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          openId,
        };

        await SocialAccountService.addAccount({
          platform: 'tiktok',
          accountName: profile.displayName,
          handle: profile.openId,
          profileImageUrl: profile.avatarUrl,
          isDefault: true,
          status: 'active',
          credentials: ttCredentials,
        });

        logger.info('TikTok account connected via OAuth', {
          route: '/api/social/oauth/callback',
          displayName: profile.displayName,
          openId,
        });

        return NextResponse.redirect(`${settingsUrl}?success=tiktok&category=social`);
      }

      case 'reddit': {
        const { tokens } = await exchangeRedditCode(code, state);
        const profile = await fetchRedditProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        const redditCreds: RedditCredentials = {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          username: profile.name,
        };

        await SocialAccountService.addAccount({
          platform: 'reddit',
          accountName: profile.name,
          handle: profile.name,
          profileImageUrl: profile.iconUrl,
          isDefault: true,
          status: 'active',
          credentials: redditCreds,
        });

        logger.info('Reddit account connected via OAuth', {
          route: '/api/social/oauth/callback',
          username: profile.name,
        });

        return NextResponse.redirect(`${settingsUrl}?success=reddit&category=social`);
      }

      case 'pinterest': {
        const { tokens } = await exchangePinterestCode(code, state);
        const profile = await fetchPinterestProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        const pinterestCreds: PinterestCredentials = {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
        };

        await SocialAccountService.addAccount({
          platform: 'pinterest',
          accountName: profile.username,
          handle: profile.username,
          profileImageUrl: profile.profileImageUrl,
          isDefault: true,
          status: 'active',
          credentials: pinterestCreds,
        });

        logger.info('Pinterest account connected via OAuth', {
          route: '/api/social/oauth/callback',
          username: profile.username,
        });

        return NextResponse.redirect(`${settingsUrl}?success=pinterest&category=social`);
      }

      case 'discord': {
        const { tokens } = await exchangeDiscordCode(code, state);
        const profile = await fetchDiscordProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        // Discord includes guild_id in callback when bot scope is granted.
        const guildId = searchParams.get('guild_id') ?? '';
        const applicationId = process.env.DISCORD_CLIENT_ID ?? '';

        const discordCreds: DiscordCredentials = {
          botToken: process.env.DISCORD_BOT_TOKEN ?? '',
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          guildId,
          applicationId,
        };

        await SocialAccountService.addAccount({
          platform: 'discord',
          accountName: profile.username,
          handle: guildId || profile.id,
          profileImageUrl: profile.avatarUrl,
          isDefault: true,
          status: 'active',
          credentials: discordCreds,
        });

        logger.info('Discord server connected via OAuth', {
          route: '/api/social/oauth/callback',
          username: profile.username,
          guildId,
        });

        return NextResponse.redirect(`${settingsUrl}?success=discord&category=social`);
      }

      case 'twitch': {
        const { tokens } = await exchangeTwitchCode(code, state);
        const profile = await fetchTwitchProfile(tokens.accessToken);
        const encrypted = encryptCredentials(tokens);

        const twitchCreds: TwitchCredentials = {
          accessToken: encrypted.accessToken,
          refreshToken: encrypted.refreshToken,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          userId: profile.id,
          login: profile.login,
          displayName: profile.displayName,
          scope: tokens.scope,
        };

        await SocialAccountService.addAccount({
          platform: 'twitch',
          accountName: profile.displayName,
          handle: profile.login,
          profileImageUrl: profile.profileImageUrl,
          isDefault: true,
          status: 'active',
          credentials: twitchCreds,
        });

        logger.info('Twitch channel connected via OAuth', {
          route: '/api/social/oauth/callback',
          login: profile.login,
          userId: profile.id,
        });

        return NextResponse.redirect(`${settingsUrl}?success=twitch&category=social`);
      }

      default:
        return NextResponse.redirect(
          `${settingsUrl}?error=oauth_not_supported&provider=${validProvider}`
        );
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
