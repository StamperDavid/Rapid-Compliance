/**
 * Microsoft OAuth - Handle callback
 * GET /api/integrations/microsoft/callback
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokensFromCode } from '@/lib/integrations/outlook-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { encryptToken } from '@/lib/security/token-encryption';

export const dynamic = 'force-dynamic';

// Zod schema for OAuth state validation
const OAuthStateSchema = z.object({
  userId: z.string().min(1),
});

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
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }

  try {
    // Decode and validate state
    const decodedState: unknown = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));

    const stateValidation = OAuthStateSchema.safeParse(decodedState);
    if (!stateValidation.success) {
      logger.warn('Invalid OAuth state', { errors: JSON.stringify(stateValidation.error.errors) });
      return NextResponse.redirect('/integrations?error=invalid_state');
    }

    const { userId } = stateValidation.data;
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

    return NextResponse.redirect('/settings/integrations?success=microsoft');
  } catch (error) {
    const _errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Microsoft OAuth callback error', error instanceof Error ? error : undefined, { route: '/api/integrations/microsoft/callback' });
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}
