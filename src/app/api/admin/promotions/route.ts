/**
 * Admin Promotions API
 * POST /api/admin/promotions - Create new promotional campaign
 * GET /api/admin/promotions - Get all promotions with analytics
 * DELETE /api/admin/promotions - Delete a promotion
 *
 * This endpoint manages platform-level promotional campaigns
 * based on the 7 Nudge Strategies for discount-driven conversion optimization.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import { PromotionService } from '@/lib/promotions/promotion-service';

// =============================================================================
// REQUEST VALIDATION SCHEMAS
// =============================================================================

const NudgeStrategySchema = z.enum([
  'ENGAGEMENT_NUDGE',
  'CART_ABANDONMENT',
  'WIN_BACK',
  'TRIAL_CONVERSION',
  'REFERRAL_REWARD',
  'SEASONAL_PROMO',
  'LOYALTY_TIER',
]);

const CreatePromotionSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name too long'),
  strategy: NudgeStrategySchema,
  discountPercent: z.number().min(1, 'Discount must be at least 1%').max(100, 'Discount cannot exceed 100%'),
  expiryDays: z.number().min(1, 'Expiry must be at least 1 day').max(365, 'Expiry cannot exceed 365 days'),
  maxRedemptions: z.number().positive().optional(),
  description: z.string().max(500).optional(),
});

const DeletePromotionSchema = z.object({
  promotionId: z.string().min(1, 'Promotion ID is required'),
});

// =============================================================================
// POST /api/admin/promotions
// Create new promotional campaign
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const validation = CreatePromotionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { name, strategy, discountPercent, expiryDays, maxRedemptions, description } = validation.data;

    logger.info('[AdminPromotions] Creating promotion', {
      name,
      strategy,
      discountPercent,
      expiryDays,
      adminId: authResult.user.uid,
      file: 'admin/promotions/route.ts',
    });

    // Create the promotion via service layer
    const promotion = await PromotionService.createPromotion({
      name,
      strategy,
      discountPercent,
      expiryDays,
      maxRedemptions,
      description,
      createdBy: authResult.user.uid,
      createdByEmail: authResult.user.email,
    });

    logger.info('[AdminPromotions] Promotion created successfully', {
      promotionId: promotion.id,
      strategy,
      file: 'admin/promotions/route.ts',
    });

    return NextResponse.json({
      success: true,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        strategy: promotion.strategy,
        discountPercent: promotion.discountPercent,
        status: promotion.status,
        maxRedemptions: promotion.maxRedemptions,
        redemptions: promotion.redemptions,
        startsAt: promotion.startsAt instanceof Date ? promotion.startsAt.toISOString() : promotion.startsAt,
        expiresAt: promotion.expiresAt instanceof Date ? promotion.expiresAt.toISOString() : promotion.expiresAt,
        createdAt: promotion.createdAt instanceof Date ? promotion.createdAt.toISOString() : promotion.createdAt,
      },
      message: 'Promotion created successfully',
    });
  } catch (error: unknown) {
    logger.error(
      '[AdminPromotions] Unexpected error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'admin/promotions/route.ts' }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/admin/promotions
// Get all promotions with analytics
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Fetch all promotions and analytics in parallel
    const [promotions, analytics] = await Promise.all([
      PromotionService.getAllPromotions(),
      PromotionService.getPromotionAnalytics(),
    ]);

    // Transform promotions for response
    const transformedPromotions = promotions.map((p) => ({
      id: p.id,
      name: p.name,
      strategy: p.strategy,
      discountPercent: p.discountPercent,
      status: p.status,
      maxRedemptions: p.maxRedemptions,
      redemptions: p.redemptions,
      startsAt: p.startsAt instanceof Date ? p.startsAt.toISOString() : p.startsAt,
      expiresAt: p.expiresAt instanceof Date ? p.expiresAt.toISOString() : p.expiresAt,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      promotions: transformedPromotions,
      analytics: {
        activeCount: analytics.totalActive,
        totalRedemptions: analytics.totalRedemptions,
        averageROI: analytics.averageROI,
        conversionLift: analytics.conversionLift,
      },
    });
  } catch (error: unknown) {
    logger.error(
      '[AdminPromotions] GET error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'admin/promotions/route.ts' }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/admin/promotions
// Delete a promotion
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const validation = DeletePromotionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { promotionId } = validation.data;

    logger.info('[AdminPromotions] Deleting promotion', {
      promotionId,
      adminId: authResult.user.uid,
      file: 'admin/promotions/route.ts',
    });

    const result = await PromotionService.deletePromotion(promotionId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to delete promotion',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Promotion deleted successfully',
    });
  } catch (error: unknown) {
    logger.error(
      '[AdminPromotions] DELETE error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'admin/promotions/route.ts' }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
