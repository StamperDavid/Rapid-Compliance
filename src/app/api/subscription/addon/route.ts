/**
 * Add-On Management API Route
 * POST /api/subscription/addon
 * Add or remove subscription add-ons
 */

import { type NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { AVAILABLE_ADDONS } from '@/types/subscription';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { z } from 'zod';

// Strict validation schema for addon management (revenue critical)
const addOnRequestSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
  addOnId: z.string().min(1, 'Add-on ID is required'),
});

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

    const body: unknown = await request.json();

    // Validate request body with strict typing
    const validation = addOnRequestSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest(`Invalid request: ${validation.error.errors.map(e => e.message).join(', ')}`);
    }

    const { orgId, addOnId } = validation.data;

    // Validate add-on exists (type-safe check)
    if (!(addOnId in AVAILABLE_ADDONS)) {
      return NextResponse.json(
        { success: false, error: `Add-on ${addOnId} not found` },
        { status: 404 }
      );
    }

    // Add add-on (now type-safe)
    await FeatureGate.addAddOn(orgId, addOnId);

    // Get updated subscription
    const subscription = await FeatureGate.getSubscription(orgId);

    return NextResponse.json({
      success: true,
      message: `Add-on ${AVAILABLE_ADDONS[addOnId].name} added`,
      subscription,
    });
  } catch (error: unknown) {
    logger.error('Error adding addon', error instanceof Error ? error : new Error('Unknown error'), { route: '/api/subscription/addon' });
    return errors.database('Failed to add addon', error instanceof Error ? error : undefined);
  }
}

/**
 * GET /api/subscription/addon
 * List available add-ons
 */
export function GET(_request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      addOns: AVAILABLE_ADDONS,
    });
  } catch (error: unknown) {
    logger.error('Error listing addons', error instanceof Error ? error : new Error('Unknown error'), { route: '/api/subscription/addon' });
    return errors.database('Failed to list addons', error instanceof Error ? error : undefined);
  }
}



















