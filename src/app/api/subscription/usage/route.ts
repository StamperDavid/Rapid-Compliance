/**
 * Usage API Route
 * GET /api/subscription/usage?orgId=xxx&feature=xxx
 * Check usage limits for specific features
 */

import { type NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Valid features type
type UsageFeature = 'aiEmailWriter' | 'prospectFinder' | 'linkedin' | 'sms' | 'email';
const VALID_FEATURES: readonly UsageFeature[] = ['aiEmailWriter', 'prospectFinder', 'linkedin', 'sms', 'email'] as const;

function isValidFeature(value: string): value is UsageFeature {
  return (VALID_FEATURES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscription/usage');
    if (rateLimitResponse) {return rateLimitResponse;}

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

    // Check usage limits with type guard
    if (!isValidFeature(feature)) {
      return errors.badRequest(`Invalid feature. Must be one of: ${VALID_FEATURES.join(', ')}`);
    }

    const usage = await FeatureGate.checkLimit(orgId, feature, 1);

    return NextResponse.json({
      success: true,
      feature,
      ...usage,
    });
  } catch (error: unknown) {
    const _errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking usage', error instanceof Error ? error : new Error(String(error)), { route: '/api/subscription/usage'  });
    return errors.database('Failed to check usage', error instanceof Error ? error : undefined);
  }
}



















