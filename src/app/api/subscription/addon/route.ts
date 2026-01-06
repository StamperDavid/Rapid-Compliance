/**
 * Add-On Management API Route
 * POST /api/subscription/addon
 * Add or remove subscription add-ons
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { AVAILABLE_ADDONS } from '@/types/subscription';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * POST /api/subscription/addon
 * Add an add-on to subscription
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscription/addon');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, addOnId } = body;

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    if (!addOnId) {
      return errors.badRequest('Add-on ID required');
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
    logger.error('Error adding addon', error, { route: '/api/subscription/addon' });
    return errors.database('Failed to add addon', error);
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
    logger.error('Error listing addons', error, { route: '/api/subscription/addon' });
    return errors.database('Failed to list addons', error);
  }
}



















