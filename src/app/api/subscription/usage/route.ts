/**
 * Usage API Route
 * GET /api/subscription/usage?orgId=xxx&feature=xxx
 * Check usage limits for specific features
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscription/usage');
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const feature = searchParams.get('feature');

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    if (!feature) {
      return errors.badRequest('Feature name required');
    }

    // Check usage limits
    const validFeatures = ['aiEmailWriter', 'prospectFinder', 'linkedin', 'sms', 'email'];
    if (!validFeatures.includes(feature)) {
      return errors.badRequest(`Invalid feature. Must be one of: ${validFeatures.join(', ')}`);
    }

    const usage = await FeatureGate.checkLimit(
      orgId,
      feature as any,
      1
    );

    return NextResponse.json({
      success: true,
      feature,
      ...usage,
    });
  } catch (error: any) {
    logger.error('Error checking usage', error, { route: '/api/subscription/usage' });
    return errors.database('Failed to check usage', error);
  }
}



















