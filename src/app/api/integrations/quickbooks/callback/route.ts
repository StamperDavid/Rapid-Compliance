/**
 * QuickBooks OAuth - Handle callback
 * GET /api/integrations/quickbooks/callback
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/quickbooks-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { encryptToken } from '@/lib/security/token-encryption';
import { validateOAuthState } from '@/lib/security/oauth-state';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/quickbooks/callback');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId');

  if (!code || !realmId) {
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  }

  try {
    // Validate CSRF-safe state token against Firestore
    const userId = state ? await validateOAuthState(state, 'quickbooks') : null;
    if (!userId) {
      logger.warn('Invalid or expired QuickBooks OAuth state', { route: '/api/integrations/quickbooks/callback' });
      return NextResponse.redirect(new URL('/integrations?error=invalid_state', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
    }

    const tokens = await getTokensFromCode(code);

    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      `quickbooks_${realmId}`,
      {
        id: `quickbooks_${realmId}`,
        userId,
        provider: 'quickbooks',
        type: 'accounting',
        status: 'active',
        credentials: {
          access_token: encryptToken(tokens.access_token),
          refresh_token: encryptToken(tokens.refresh_token),
          realmId,
          encrypted: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    logger.info('QuickBooks integration saved', { route: '/api/integrations/quickbooks/callback', realmId });

    return NextResponse.redirect(new URL('/settings/integrations?success=quickbooks', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  } catch (error) {
    const _errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('QuickBooks OAuth callback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/quickbooks/callback' });
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', process.env.NEXT_PUBLIC_APP_URL ?? request.url));
  }
}
