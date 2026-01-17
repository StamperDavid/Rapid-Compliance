import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getMerchantCouponsCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import type { MerchantCoupon } from '@/types/pricing';

interface RouteContext {
  params: Promise<{ orgId: string; couponId: string }>;
}

const CouponStatusSchema = z.object({
  status: z.enum(['active', 'disabled', 'expired', 'depleted']),
});

/**
 * PATCH: Toggle merchant coupon status
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { orgId, couponId } = await context.params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const rawBody: unknown = await request.json();
    const parseResult = CouponStatusSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      );
    }

    const { status } = parseResult.data;
    const couponsPath = getMerchantCouponsCollection(orgId);

    // Check if coupon exists
    const existingCoupon = await FirestoreService.get<MerchantCoupon>(couponsPath, couponId);
    if (!existingCoupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    // Update status
    await FirestoreService.update(couponsPath, couponId, {
      status,
      updated_at: new Date().toISOString(),
    });

    logger.info('[Workspace] Merchant coupon status updated', {
      userId: user.uid,
      orgId,
      couponId,
      code: existingCoupon.code,
      oldStatus: existingCoupon.status,
      newStatus: status,
    });

    return NextResponse.json({
      success: true,
      message: 'Coupon status updated',
      couponId,
      status,
    });
  } catch (error: unknown) {
    logger.error('[Workspace] Error updating coupon status', error instanceof Error ? error : new Error(String(error)), {});
    return NextResponse.json(
      { success: false, error: 'Failed to update coupon status' },
      { status: 500 }
    );
  }
}
