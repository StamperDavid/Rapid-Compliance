/**
 * GET /api/leads/apollo/credits
 * Returns Apollo credit usage (today, this month, search rate).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { apolloService } = await import('@/lib/integrations/apollo/apollo-service');

    const configured = await apolloService.isConfigured();
    if (!configured) {
      return NextResponse.json({
        success: false,
        error: 'Apollo API key not configured. Add it in Settings > API Keys.',
      }, { status: 400 });
    }

    const snapshot = await apolloService.getCreditsSnapshot();
    return NextResponse.json({ success: true, ...snapshot });
  } catch (error) {
    logger.error('[Apollo Credits] Error', error instanceof Error ? error : new Error(String(error)), { route: '/api/leads/apollo/credits' });
    return errors.externalService('Apollo Credits', error instanceof Error ? error : undefined);
  }
}
