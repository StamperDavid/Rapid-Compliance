import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getMerchantCouponsCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import type { MerchantCoupon } from '@/types/pricing';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

const CouponInputSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'Coupon code is required'),
  discount_type: z.enum(['percentage', 'fixed']).optional(),
  value: z.number().optional(),
  min_purchase: z.number().optional(),
  max_discount: z.number().optional(),
  max_uses: z.number().optional(),
  max_uses_per_customer: z.number().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  coupon_category: z.enum(['public_marketing', 'negotiation']).optional(),
  ai_authorized: z.boolean().optional(),
  ai_discount_limit: z.number().optional(),
  ai_auto_apply: z.boolean().optional(),
  ai_trigger_keywords: z.array(z.string()).optional(),
  applies_to: z.enum(['all', 'specific_products', 'specific_categories']).optional(),
  product_ids: z.array(z.string()).optional(),
  category_ids: z.array(z.string()).optional(),
  customer_segments: z.array(z.string()).optional(),
  status: z.enum(['active', 'disabled', 'expired', 'depleted']).optional(),
  notes: z.string().optional(),
});

/**
 * GET: Retrieve all merchant coupons for an organization
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { orgId } = await context.params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get all coupons from merchant's sub-collection
    const couponsPath = getMerchantCouponsCollection(orgId);
    const coupons = await FirestoreService.getAll<MerchantCoupon>(couponsPath);

    return NextResponse.json({
      success: true,
      coupons: coupons ?? [],
    });
  } catch (error: unknown) {
    logger.error('[Workspace] Error fetching merchant coupons:', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create or update a merchant coupon
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { orgId } = await context.params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const rawBody: unknown = await request.json();
    const parseResult = CouponInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.errors[0]?.message ?? 'Invalid coupon data' },
        { status: 400 }
      );
    }

    const couponData = parseResult.data;
    const normalizedCode = couponData.code.toUpperCase().trim();
    const couponsPath = getMerchantCouponsCollection(orgId);
    const now = new Date().toISOString();
    let couponId = couponData.id;
    let isNew = false;

    if (!couponId) {
      // Check if code already exists
      const existingCoupons = await FirestoreService.getAll<MerchantCoupon>(couponsPath);
      const existing = existingCoupons?.find(c => c.code === normalizedCode);

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Coupon code already exists' },
          { status: 400 }
        );
      }

      couponId = `coupon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      isNew = true;
    }

    // Get existing data if updating
    const existingCoupon = isNew ? null : await FirestoreService.get<MerchantCoupon>(couponsPath, couponId);

    // Build coupon object
    const coupon: MerchantCoupon = {
      id: couponId,
      code: normalizedCode,
      discount_type: couponData.discount_type ?? 'percentage',
      value: couponData.value ?? 0,
      min_purchase: couponData.min_purchase ?? 0,
      max_discount: couponData.max_discount,
      max_uses: couponData.max_uses,
      max_uses_per_customer: couponData.max_uses_per_customer,
      current_uses: existingCoupon?.current_uses ?? 0,
      valid_from: couponData.valid_from ?? now,
      valid_until: couponData.valid_until,
      coupon_category: couponData.coupon_category ?? 'public_marketing',
      ai_authorized: couponData.ai_authorized ?? true,
      ai_discount_limit: couponData.ai_discount_limit ?? 20,
      ai_auto_apply: couponData.ai_auto_apply ?? false,
      ai_trigger_keywords: couponData.ai_trigger_keywords ?? [],
      applies_to: couponData.applies_to ?? 'all',
      product_ids: couponData.product_ids,
      category_ids: couponData.category_ids,
      customer_segments: couponData.customer_segments,
      status: couponData.status ?? 'active',
      organization_id: orgId,
      created_at: existingCoupon?.created_at ?? now,
      updated_at: now,
      created_by: existingCoupon?.created_by ?? user.uid,
      notes: couponData.notes,
    };

    // Save to Firestore
    await FirestoreService.set(couponsPath, couponId, coupon);

    logger.info('[Workspace] Merchant coupon saved', {
      userId: user.uid,
      orgId,
      couponId,
      code: normalizedCode,
      action: isNew ? 'create' : 'update',
      aiAuthorized: coupon.ai_authorized,
    });

    return NextResponse.json({
      success: true,
      coupon,
      message: isNew ? 'Coupon created successfully' : 'Coupon updated successfully',
    });
  } catch (error: unknown) {
    logger.error('[Workspace] Error saving merchant coupon:', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Failed to save coupon' },
      { status: 500 }
    );
  }
}
