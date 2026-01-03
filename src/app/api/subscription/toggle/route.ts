/**
 * Toggle Feature API Route
 * POST /api/subscription/toggle
 * Enable/disable specific outbound features
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { OrganizationSubscription } from '@/types/subscription';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscription/toggle');
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, feature, enabled } = body as {
      orgId: string;
      feature: keyof OrganizationSubscription['outboundFeatures'];
      enabled: boolean;
    };

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    if (!feature) {
      return errors.badRequest('Feature name required');
    }

    if (typeof enabled !== 'boolean') {
      return errors.badRequest('Enabled must be a boolean');
    }

    // Toggle feature
    await FeatureGate.toggleFeature(orgId, feature, enabled);

    // Get updated subscription
    const subscription = await FeatureGate.getSubscription(orgId);

    return NextResponse.json({
      success: true,
      message: `${feature} ${enabled ? 'enabled' : 'disabled'}`,
      subscription,
    });
  } catch (error: any) {
    logger.error('Error toggling feature', error, { route: '/api/subscription/toggle' });
    return errors.database('Failed to toggle feature', error);
  }
}



















