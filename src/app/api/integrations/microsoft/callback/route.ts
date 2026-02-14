/**
 * Microsoft OAuth - Handle callback
 * GET /api/integrations/microsoft/callback
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/outlook-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { encryptToken } from '@/lib/security/token-encryption';
import { validateOAuthState } from '@/lib/security/oauth-state';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/microsoft/callback');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  }

  try {
    // Validate CSRF-safe state token against Firestore
    const userId = await validateOAuthState(state, 'microsoft');
    if (!userId) {
      logger.warn('Invalid or expired OAuth state', { route: '/api/integrations/microsoft/callback' });
      return NextResponse.redirect(new URL('/integrations?error=invalid_state', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
    }

    const tokens = await getTokensFromCode(code);

    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      `microsoft_${userId}`,
      {
        id: `microsoft_${userId}`,
        userId,
        provider: 'microsoft',
        type: 'outlook',
        status: 'active',
        credentials: {
          access_token: encryptToken(String(tokens.access_token)),
          refresh_token: tokens.refresh_token ? encryptToken(String(tokens.refresh_token)) : undefined,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          encrypted: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    logger.info('Microsoft integration saved', { route: '/api/integrations/microsoft/callback', PLATFORM_ID });

    return NextResponse.redirect(new URL('/settings/integrations?success=microsoft', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  } catch (error) {
    const _errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Microsoft OAuth callback error', error instanceof Error ? error : undefined, { route: '/api/integrations/microsoft/callback' });
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  }
}
