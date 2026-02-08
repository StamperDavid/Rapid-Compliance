import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS, getMerchantCouponsCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import type { CouponRedemption, MerchantCoupon } from '@/types/pricing';
import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * GET: Get coupon analytics for SalesVelocity.ai
 */
export async function GET(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get all coupons
    const couponsPath = getMerchantCouponsCollection();
    const coupons = await FirestoreService.getAll<MerchantCoupon>(couponsPath) ?? [];

    // Get redemptions for merchant coupons
    const allRedemptions = await FirestoreService.getAll<CouponRedemption>(COLLECTIONS.COUPON_REDEMPTIONS) ?? [];
    const redemptions = allRedemptions.filter(
      r => r.coupon_type === 'merchant'
    );

    // Calculate total discount given
    const totalDiscountGiven = redemptions.reduce((sum, r) => sum + (r.discount_amount ?? 0), 0);

    // Calculate top coupons
    const couponStats = new Map<string, { uses: number; revenue_impact: number }>();
    for (const redemption of redemptions) {
      const current = couponStats.get(redemption.coupon_code) ?? { uses: 0, revenue_impact: 0 };
      couponStats.set(redemption.coupon_code, {
        uses: current.uses + 1,
        revenue_impact: current.revenue_impact + (redemption.discount_amount ?? 0),
      });
    }

    const topCoupons = Array.from(couponStats.entries())
      .map(([code, stats]) => ({ code, ...stats }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5);

    const analytics = {
      totalCoupons: coupons.length,
      activeCoupons: coupons.filter(c => c.status === 'active').length,
      totalRedemptions: redemptions.length,
      totalDiscountGiven,
      topCoupons,
    };

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: unknown) {
    logger.error('Error fetching coupon analytics', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
