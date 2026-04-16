/**
 * API Route: Connect Truth Social Account
 *
 * POST /api/social/connect/truth_social
 * Validates an access token against the Mastodon-compatible API and stores
 * the credentials in Firestore.
 *
 * Body: { accessToken: string, instanceUrl?: string }
 *   - accessToken: Bearer token for the account
 *   - instanceUrl: Instance URL (defaults to https://truthsocial.com)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { TruthSocialCredentials, SocialAccountStatus } from '@/types/social';

export const dynamic = 'force-dynamic';

const SOCIAL_ACCOUNTS_COLLECTION = getSubCollection('social_accounts');

const DEFAULT_INSTANCE_URL = 'https://truthsocial.com';

const connectTruthSocialSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  instanceUrl: z
    .string()
    .url('Invalid instance URL')
    .optional()
    .default(DEFAULT_INSTANCE_URL),
});

interface MastodonAccountResponse {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = connectTruthSocialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { accessToken, instanceUrl } = validation.data;

    // Strip trailing slash from instance URL
    const normalizedUrl = instanceUrl.replace(/\/+$/, '');

    // Validate token by calling the Mastodon-compatible verify_credentials endpoint
    let account: MastodonAccountResponse;
    try {
      const response = await fetch(
        `${normalizedUrl}/api/v1/accounts/verify_credentials`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('Truth Social Connect: verify_credentials failed', {
          status: String(response.status),
          error: errorText,
        });

        const errorMessage =
          response.status === 401 || response.status === 403
            ? 'Invalid access token'
            : 'Could not verify credentials with Truth Social';

        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: response.status === 401 || response.status === 403 ? 401 : 400 }
        );
      }

      account = (await response.json()) as MastodonAccountResponse;
    } catch (fetchError) {
      logger.error(
        'Truth Social Connect: Network error calling verify_credentials',
        fetchError instanceof Error ? fetchError : new Error(String(fetchError))
      );
      return NextResponse.json(
        { success: false, error: 'Could not reach Truth Social servers. Please try again.' },
        { status: 502 }
      );
    }

    // Build the credential object
    const credentials: TruthSocialCredentials = {
      instanceUrl: normalizedUrl,
      accessToken,
      username: account.username,
    };

    // Store in Firestore
    const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const status: SocialAccountStatus = 'active';

    await AdminFirestoreService.set(
      SOCIAL_ACCOUNTS_COLLECTION,
      accountId,
      {
        id: accountId,
        platform: 'truth_social',
        accountName: account.display_name || account.username,
        handle: `@${account.username}`,
        profileImageUrl: account.avatar,
        isDefault: false,
        status,
        credentials,
        addedAt: now,
        connectedBy: authResult.user.uid,
      },
      false
    );

    logger.info('Truth Social Connect: Account connected', {
      accountId,
      username: account.username,
      userId: authResult.user.uid,
    });

    return NextResponse.json({ success: true, username: account.username });
  } catch (error: unknown) {
    logger.error(
      'Truth Social Connect: POST failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json(
      { success: false, error: 'Failed to connect Truth Social account' },
      { status: 500 }
    );
  }
}
