/**
 * Toggle Feature API Route
 * POST /api/subscription/toggle
 * Enable/disable specific outbound features
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, feature, enabled } = body;

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

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Enabled must be a boolean' },
        { status: 400 }
      );
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
    console.error('[Subscription API] Error toggling feature:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle feature' },
      { status: 500 }
    );
  }
}

