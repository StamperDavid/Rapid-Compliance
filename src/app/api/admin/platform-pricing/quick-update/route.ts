import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

interface QuickUpdateRequest {
  plan_id: string;
  price_usd: number;
  yearly_price_usd?: number;
}

interface ExistingPlan {
  price_usd: number;
}

/**
 * POST: Quick price update for a single plan
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as QuickUpdateRequest;
    const { plan_id, price_usd, yearly_price_usd } = body;

    if (!plan_id || typeof price_usd !== 'number') {
      return NextResponse.json(
        { success: false, error: 'plan_id and price_usd are required' },
        { status: 400 }
      );
    }

    // Check if plan exists
    const existingPlan = await FirestoreService.get<ExistingPlan>(COLLECTIONS.PLATFORM_PRICING, plan_id);
    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Update only price fields
    const updates: Record<string, unknown> = {
      price_usd,
      updated_at: new Date().toISOString(),
    };

    if (typeof yearly_price_usd === 'number') {
      updates.yearly_price_usd = yearly_price_usd;
    }

    await FirestoreService.update(COLLECTIONS.PLATFORM_PRICING, plan_id, updates);

    logger.info('[Admin] Quick price update', {
      userId: user.uid,
      planId: plan_id,
      newPrice: price_usd,
      oldPrice: existingPlan.price_usd,
    });

    return NextResponse.json({
      success: true,
      message: 'Price updated successfully',
      plan_id,
      price_usd,
    });
  } catch (error) {
    logger.error('[Admin] Error in quick price update', error instanceof Error ? error : new Error(String(error)), { file: 'quick-update/route.ts' });
    return NextResponse.json(
      { success: false, error: 'Failed to update price' },
      { status: 500 }
    );
  }
}
