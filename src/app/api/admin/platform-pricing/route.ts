import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { type PlatformPricingPlan, DEFAULT_PRICING_TIERS } from '@/types/pricing';

/**
 * GET: Retrieve all platform pricing plans
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get all pricing plans from Firestore
    const plans = await FirestoreService.getAll(COLLECTIONS.PLATFORM_PRICING);

    if (plans && plans.length > 0) {
      const typedPlans = plans as PlatformPricingPlan[];
      return NextResponse.json({
        success: true,
        plans: typedPlans.sort((a, b) => a.display_order - b.display_order),
      });
    }

    // Return defaults if none exist
    const now = new Date().toISOString();
    const defaultPlans = DEFAULT_PRICING_TIERS.map(t => ({
      ...t,
      created_at: now,
      updated_at: now,
    }));

    return NextResponse.json({
      success: true,
      plans: defaultPlans,
      isDefault: true,
    });
  } catch (error: unknown) {
    logger.error('[Admin] Error fetching platform pricing', error instanceof Error ? error : new Error(String(error)), {});
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pricing plans' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create or update a platform pricing plan
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PlatformPricingPlan;
    const plan = body;

    // Validate required fields
    if (!plan.plan_id || !plan.name || typeof plan.price_usd !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid plan data: plan_id, name, and price_usd are required' },
        { status: 400 }
      );
    }

    // Validate feature_limits
    if (!plan.feature_limits || typeof plan.feature_limits !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid plan data: feature_limits is required' },
        { status: 400 }
      );
    }

    // Check if plan exists
    const existingPlan = await FirestoreService.get<PlatformPricingPlan>(COLLECTIONS.PLATFORM_PRICING, plan.plan_id);
    const now = new Date().toISOString();

    const planData: PlatformPricingPlan = {
      ...plan,
      created_at: existingPlan?.created_at ?? now,
      updated_at: now,
      created_by: existingPlan?.created_by ?? user.uid,
    };

    // Save to Firestore
    await FirestoreService.set(COLLECTIONS.PLATFORM_PRICING, plan.plan_id, planData);

    logger.info('[Admin] Platform pricing plan saved', {
      userId: user.uid,
      planId: plan.plan_id,
      action: existingPlan ? 'update' : 'create',
    });

    return NextResponse.json({
      success: true,
      plan: planData,
      message: existingPlan ? 'Plan updated successfully' : 'Plan created successfully',
    });
  } catch (error: unknown) {
    logger.error('[Admin] Error saving platform pricing plan', error instanceof Error ? error : new Error(String(error)), {});
    return NextResponse.json(
      { success: false, error: 'Failed to save pricing plan' },
      { status: 500 }
    );
  }
}
