import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS, getMerchantCouponsCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import type { CouponRedemption, MerchantCoupon } from '@/types/pricing';

const paramsSchema = z.object({
  orgId: z.string().min(1, 'orgId is required'),
});

/**
 * GET: Get coupon analytics for a merchant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const resolvedParams = await params;
    const paramsResult = paramsSchema.safeParse(resolvedParams);
    if (!paramsResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid orgId parameter' },
        { status: 400 }
      );
    }
    const { orgId } = paramsResult.data;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get all coupons
    const couponsPath = getMerchantCouponsCollection(orgId);
    const coupons = await FirestoreService.getAll<MerchantCoupon>(couponsPath) ?? [];

    // Get redemptions for this org
    const allRedemptions = await FirestoreService.getAll<CouponRedemption>(COLLECTIONS.COUPON_REDEMPTIONS) ?? [];
    const redemptions = allRedemptions.filter(
      r => r.organization_id === orgId && r.coupon_type === 'merchant'
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
    logger.error('[Workspace] Error fetching coupon analytics', error instanceof Error ? error : new Error(String(error)), {});
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
