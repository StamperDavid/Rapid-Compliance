/**
 * Zoom OAuth — Disconnect
 * POST /api/integrations/zoom/disconnect
 *
 * Auth-gated. Deletes the stored Zoom credentials so booking flows fall back
 * to "not connected" until the operator re-runs the OAuth flow.
 *
 * Uses Admin SDK (`useAdminSdk: true`) so the delete succeeds regardless of
 * Firestore rules.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';
import { disconnectIntegration } from '@/lib/integrations/integration-manager';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/zoom/disconnect');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    await disconnectIntegration('zoom', { useAdminSdk: true });

    // Compatibility shim: also clear the zoom key in the legacy
    // `integrations/all` map doc that the /settings/integrations page
    // currently reads from. Without this, the UI keeps showing ✓ Connected
    // even after the underlying tokens are gone.
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getSubCollection } = await import('@/lib/firebase/collections');
    if (adminDb) {
      await adminDb
        .collection(getSubCollection('integrations'))
        .doc('all')
        .set({ zoom: null }, { merge: true });
    }

    logger.info('Zoom integration disconnected', {
      route: '/api/integrations/zoom/disconnect',
      uid: authResult.user.uid,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(
      'Failed to disconnect Zoom integration',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/integrations/zoom/disconnect' }
    );
    return errors.internal('Failed to disconnect Zoom', error instanceof Error ? error : undefined);
  }
}
