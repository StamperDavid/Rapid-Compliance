import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getMerchantCouponsCollection } from '@/lib/firebase/collections';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import type { MerchantCoupon } from '@/types/pricing';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ couponId: string }>;
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
    const { couponId } = await context.params;

    const authResult = await requireRole(request, ['owner', 'admin']);
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
    const couponsPath = getMerchantCouponsCollection();

    // Check if coupon exists
    const existingCoupon = await AdminFirestoreService.get(couponsPath, couponId) as MerchantCoupon | null;
    if (!existingCoupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    // Update status
    await AdminFirestoreService.update(couponsPath, couponId, {
      status,
      updated_at: new Date().toISOString(),
    });

    logger.info('Merchant coupon status updated', {
      userId: user.uid,
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
    logger.error('Error updating coupon status', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update coupon status' },
      { status: 500 }
    );
  }
}
