/**
 * Usage API Route
 * GET /api/subscription/usage?orgId=xxx&feature=xxx
 * Check usage limits for specific features
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const feature = searchParams.get('feature');

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    if (!feature) {
      return NextResponse.json(
        { success: false, error: 'Feature name required' },
        { status: 400 }
      );
    }

    // Check usage limits
    const validFeatures = ['aiEmailWriter', 'prospectFinder', 'linkedin', 'sms', 'email'];
    if (!validFeatures.includes(feature)) {
      return NextResponse.json(
        { success: false, error: `Invalid feature. Must be one of: ${validFeatures.join(', ')}` },
        { status: 400 }
      );
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
    console.error('[Subscription API] Error checking usage:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check usage' },
      { status: 500 }
    );
  }
}



















