import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

/**
 * PATCH: Toggle coupon status (active/disabled)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const { couponId } = await params;

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

    const body = await request.json();
    const { status } = body;

    if (!['active', 'disabled', 'expired', 'depleted'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Check if coupon exists
    const existingCoupon = await FirestoreService.get(COLLECTIONS.PLATFORM_COUPONS, couponId);
    if (!existingCoupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    // Update status
    await FirestoreService.update(COLLECTIONS.PLATFORM_COUPONS, couponId, {
      status,
      updated_at: new Date().toISOString(),
    });

    logger.info('[Admin] Platform coupon status updated', {
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
  } catch (error) {
    logger.error('[Admin] Error updating coupon status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update coupon status' },
      { status: 500 }
    );
  }
}
