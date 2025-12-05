/**
 * Add-On Management API Route
 * POST /api/subscription/addon
 * Add or remove subscription add-ons
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { AVAILABLE_ADDONS } from '@/types/subscription';

/**
 * POST /api/subscription/addon
 * Add an add-on to subscription
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, addOnId } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    if (!addOnId) {
      return NextResponse.json(
        { success: false, error: 'Add-on ID required' },
        { status: 400 }
      );
    }

    // Validate add-on exists
    if (!AVAILABLE_ADDONS[addOnId]) {
      return NextResponse.json(
        { success: false, error: `Add-on ${addOnId} not found` },
        { status: 404 }
      );
    }

    // Add add-on
    await FeatureGate.addAddOn(orgId, addOnId);

    // Get updated subscription
    const subscription = await FeatureGate.getSubscription(orgId);

    return NextResponse.json({
      success: true,
      message: `Add-on ${AVAILABLE_ADDONS[addOnId].name} added`,
      subscription,
    });
  } catch (error: any) {
    console.error('[Subscription API] Error adding add-on:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add add-on' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscription/addon
 * List available add-ons
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      addOns: AVAILABLE_ADDONS,
    });
  } catch (error: any) {
    console.error('[Subscription API] Error listing add-ons:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list add-ons' },
      { status: 500 }
    );
  }
}





