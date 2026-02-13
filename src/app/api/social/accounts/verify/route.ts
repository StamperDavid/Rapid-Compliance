/**
 * Social Account Verification Route
 * POST /api/social/accounts/verify
 *
 * Tests a connected social account's credentials by calling the platform API.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { verifyAccountSchema } from '@/lib/social/social-oauth-schemas';
import { SocialAccountService } from '@/lib/social/social-account-service';
import { decryptToken } from '@/lib/security/token-encryption';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/accounts/verify');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = verifyAccountSchema.safeParse(body);

    if (!validation.success) {
      return errors.badRequest(validation.error.errors[0]?.message ?? 'Invalid input');
    }

    const { accountId } = validation.data;

    // Get account with credentials
    const account = await SocialAccountService.getAccount(accountId);
    if (!account) {
      return errors.notFound('Account not found');
    }

    const credentials = account.credentials;
    let accessToken: string;

    if ('accessToken' in credentials && credentials.accessToken) {
      accessToken = decryptToken(credentials.accessToken);
    } else {
      return NextResponse.json(
        { success: false, valid: false, error: 'No access token found' },
        { status: 400 }
      );
    }

    // Test the connection by fetching the user's profile
    let valid = false;
    let profile: { name?: string; handle?: string } | undefined;

    switch (account.platform) {
      case 'twitter': {
        const response = await fetch(
          'https://api.twitter.com/2/users/me?user.fields=name,username',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (response.ok) {
          const data = await response.json() as {
            data: { name: string; username: string };
          };
          valid = true;
          profile = { name: data.data.name, handle: data.data.username };
        }
        break;
      }

      case 'linkedin': {
        const response = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json() as { name: string; sub: string };
          valid = true;
          profile = { name: data.name, handle: data.sub };
        }
        break;
      }
    }

    if (valid && account.status !== 'active') {
      await SocialAccountService.updateAccount(accountId, { status: 'active' });
    } else if (!valid && account.status === 'active') {
      await SocialAccountService.updateAccount(accountId, { status: 'expired' });
    }

    logger.info('Social account verification', {
      route: '/api/social/accounts/verify',
      accountId,
      platform: account.platform,
      valid,
    });

    return NextResponse.json({
      success: true,
      valid,
      profile,
    });
  } catch (error) {
    logger.error(
      'Social account verification error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/social/accounts/verify' }
    );
    return errors.externalService(
      'Social Platform',
      error instanceof Error ? error : undefined
    );
  }
}
