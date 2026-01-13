import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import type { PlatformCoupon } from '@/types/pricing';

/**
 * GET: Retrieve all platform coupons
 */
export async function GET(request: NextRequest) {
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

    // Get all platform coupons from Firestore
    const coupons = await FirestoreService.getAll(COLLECTIONS.PLATFORM_COUPONS);

    return NextResponse.json({
      success: true,
      coupons: coupons || [],
    });
  } catch (error) {
    logger.error('[Admin] Error fetching platform coupons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create or update a platform coupon
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

    const body = await request.json();
    const couponData = body as Partial<PlatformCoupon>;

    // Validate required fields
    if (!couponData.code) {
      return NextResponse.json(
        { success: false, error: 'Coupon code is required' },
        { status: 400 }
      );
    }

    // Normalize code
    const normalizedCode = couponData.code.toUpperCase().trim();

    // Check if updating existing coupon or creating new one
    const now = new Date().toISOString();
    let couponId = couponData.id;
    let isNew = false;

    if (!couponId) {
      // Check if code already exists
      const existingCoupons = await FirestoreService.getAll(COLLECTIONS.PLATFORM_COUPONS);
      const existing = existingCoupons?.find(c => c.code === normalizedCode);

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Coupon code already exists' },
          { status: 400 }
        );
      }

      // Generate new ID
      couponId = `platform_coupon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      isNew = true;
    }

    // Get existing data if updating
    const existingCoupon = isNew ? null : await FirestoreService.get(COLLECTIONS.PLATFORM_COUPONS, couponId);

    // Build coupon object
    const coupon: PlatformCoupon = {
      id: couponId,
      code: normalizedCode,
      discount_type: couponData.discount_type || 'percentage',
      value: couponData.value || 0,
      is_free_forever: couponData.is_free_forever || false,
      is_internal_only: couponData.is_internal_only || false,
      applies_to_plans: couponData.applies_to_plans || 'all',
      billing_cycles: couponData.billing_cycles || 'all',
      max_uses: couponData.max_uses,
      current_uses: existingCoupon?.current_uses || 0,
      valid_from: couponData.valid_from || now,
      valid_until: couponData.valid_until,
      status: couponData.status || 'active',
      created_at: existingCoupon?.created_at || now,
      updated_at: now,
      created_by: existingCoupon?.created_by || user.uid,
      notes: couponData.notes,
    };

    // If is_free_forever is true, ensure it's 100% discount
    if (coupon.is_free_forever) {
      coupon.discount_type = 'percentage';
      coupon.value = 100;
    }

    // Save to Firestore
    await FirestoreService.set(COLLECTIONS.PLATFORM_COUPONS, couponId, coupon);

    logger.info('[Admin] Platform coupon saved', {
      userId: user.uid,
      couponId,
      code: normalizedCode,
      action: isNew ? 'create' : 'update',
      isFreeForever: coupon.is_free_forever,
    });

    return NextResponse.json({
      success: true,
      coupon,
      message: isNew ? 'Coupon created successfully' : 'Coupon updated successfully',
    });
  } catch (error) {
    logger.error('[Admin] Error saving platform coupon:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save coupon' },
      { status: 500 }
    );
  }
}
