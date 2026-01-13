import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getMerchantCouponsCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

/**
 * PATCH: Toggle merchant coupon status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; couponId: string }> }
) {
  try {
    const { orgId, couponId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    const { status } = body;

    if (!['active', 'disabled', 'expired', 'depleted'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      );
    }

    const couponsPath = getMerchantCouponsCollection(orgId);

    // Check if coupon exists
    const existingCoupon = await FirestoreService.get(couponsPath, couponId);
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
  } catch (error) {
    logger.error('[Workspace] Error updating coupon status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update coupon status' },
      { status: 500 }
    );
  }
}
