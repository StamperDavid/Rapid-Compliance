/**
 * QuickBooks OAuth - Handle callback
 * GET /api/integrations/quickbooks/callback
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokensFromCode } from '@/lib/integrations/quickbooks-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// Zod schema for OAuth state validation
const OAuthStateSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
});

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
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }

  try {
    // Decode and validate state
    let userId = 'default';
    let orgId = 'default';

    if (state) {
      const decodedState: unknown = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      const stateValidation = OAuthStateSchema.safeParse(decodedState);

      if (stateValidation.success) {
        userId = stateValidation.data.userId;
        orgId = stateValidation.data.orgId;
      } else {
        logger.warn('Invalid QuickBooks OAuth state', { errors: JSON.stringify(stateValidation.error.errors) });
      }
    }

    const tokens = await getTokensFromCode(code);

    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      `quickbooks_${realmId}`,
      {
        id: `quickbooks_${realmId}`,
        userId,
        organizationId: orgId,
        provider: 'quickbooks',
        type: 'accounting',
        status: 'active',
        credentials: {
          ...tokens,
          realmId,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    logger.info('QuickBooks integration saved', { route: '/api/integrations/quickbooks/callback', orgId, realmId });

    return NextResponse.redirect(`/workspace/${orgId}/integrations?success=quickbooks`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('QuickBooks OAuth callback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/quickbooks/callback' });
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}
