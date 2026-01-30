/**
 * Promotion Service
 * Service layer for managing platform promotional campaigns in Firestore
 *
 * Handles:
 * - Creating promotional campaigns with nudge strategy metadata
 * - Persisting promotions to Firestore for tracking
 * - Retrieving active and historical promotions
 * - Tracking redemption counts
 *
 * Collection: platform_promotions (platform-level promotional campaigns)
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export type NudgeStrategyId =
  | 'ENGAGEMENT_NUDGE'
  | 'CART_ABANDONMENT'
  | 'WIN_BACK'
  | 'TRIAL_CONVERSION'
  | 'REFERRAL_REWARD'
  | 'SEASONAL_PROMO'
  | 'LOYALTY_TIER';

export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'draft' | 'paused';

export interface Promotion {
  id: string;
  name: string;
  strategy: NudgeStrategyId;
  discountPercent: number;
  status: PromotionStatus;

  // Limits
  maxRedemptions: number | null;
  redemptions: number;

  // Timing
  startsAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Metadata
  createdBy: string;
  createdByEmail?: string;
  description?: string;

  // Stripe integration (optional)
  stripeCouponId?: string;
  stripePromotionCodeId?: string;
}

export interface CreatePromotionRequest {
  name: string;
  strategy: NudgeStrategyId;
  discountPercent: number;
  expiryDays: number;
  maxRedemptions?: number;
  description?: string;
  createdBy: string;
  createdByEmail?: string;
}

export interface UpdatePromotionRequest {
  name?: string;
  discountPercent?: number;
  status?: PromotionStatus;
  maxRedemptions?: number;
  description?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

const PLATFORM_PROMOTIONS_COLLECTION = 'platform_promotions';

/**
 * Promotion Service
 * Manages platform-level promotional campaigns in Firestore
 */
export class PromotionService {
  /**
   * Get the collection path for platform promotions
   */
  private static getCollectionPath(): string {
    return `${COLLECTIONS.ORGANIZATIONS}/platform/${PLATFORM_PROMOTIONS_COLLECTION}`;
  }

  /**
   * Create a new promotional campaign
   */
  static async createPromotion(request: CreatePromotionRequest): Promise<Promotion> {
    const promotionId = `promo_${uuidv4().slice(0, 8)}`;
    const now = new Date();

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + request.expiryDays);

    const promotion: Promotion = {
      id: promotionId,
      name: request.name,
      strategy: request.strategy,
      discountPercent: request.discountPercent,
      status: 'active',

      // Limits
      maxRedemptions: request.maxRedemptions ?? null,
      redemptions: 0,

      // Timing
      startsAt: now,
      expiresAt,
      createdAt: now,
      updatedAt: now,

      // Metadata
      createdBy: request.createdBy,
      createdByEmail: request.createdByEmail,
      description: request.description,
    };

    try {
      await FirestoreService.set(
        PromotionService.getCollectionPath(),
        promotionId,
        promotion,
        false
      );

      logger.info('PromotionService: Created promotion', {
        promotionId,
        strategy: request.strategy,
        discountPercent: request.discountPercent,
        expiresAt: expiresAt.toISOString(),
        file: 'promotion-service.ts',
      });

      return promotion;
    } catch (error) {
      logger.error(
        'PromotionService: Failed to create promotion',
        error instanceof Error ? error : new Error(String(error)),
        {
          name: request.name,
          strategy: request.strategy,
          file: 'promotion-service.ts',
        }
      );
      throw error;
    }
  }

  /**
   * Get a promotion by ID
   */
  static async getPromotion(promotionId: string): Promise<Promotion | null> {
    try {
      const promotion = await FirestoreService.get<Promotion>(
        PromotionService.getCollectionPath(),
        promotionId
      );
      return promotion;
    } catch (error) {
      logger.error(
        'PromotionService: Failed to get promotion',
        error instanceof Error ? error : new Error(String(error)),
        {
          promotionId,
          file: 'promotion-service.ts',
        }
      );
      return null;
    }
  }

  /**
   * Get all active promotions
   */
  static async getActivePromotions(): Promise<Promotion[]> {
    try {
      const { where, orderBy } = await import('firebase/firestore');

      const promotions = await FirestoreService.getAll<Promotion>(
        PromotionService.getCollectionPath(),
        [
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
        ]
      );
      return promotions;
    } catch (error) {
      logger.error(
        'PromotionService: Failed to get active promotions',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'promotion-service.ts' }
      );
      return [];
    }
  }

  /**
   * Get all promotions (active and inactive)
   */
  static async getAllPromotions(limitCount: number = 50): Promise<Promotion[]> {
    try {
      const { orderBy, limit: firestoreLimit } = await import('firebase/firestore');

      const promotions = await FirestoreService.getAll<Promotion>(
        PromotionService.getCollectionPath(),
        [
          orderBy('createdAt', 'desc'),
          firestoreLimit(limitCount),
        ]
      );
      return promotions;
    } catch (error) {
      logger.error(
        'PromotionService: Failed to get all promotions',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'promotion-service.ts' }
      );
      return [];
    }
  }

  /**
   * Update a promotion
   */
  static async updatePromotion(
    promotionId: string,
    updates: UpdatePromotionRequest
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date(),
      };

      await FirestoreService.update(
        PromotionService.getCollectionPath(),
        promotionId,
        updateData
      );

      logger.info('PromotionService: Updated promotion', {
        promotionId,
        updates: Object.keys(updates),
        file: 'promotion-service.ts',
      });

      return { success: true };
    } catch (error) {
      logger.error(
        'PromotionService: Failed to update promotion',
        error instanceof Error ? error : new Error(String(error)),
        {
          promotionId,
          file: 'promotion-service.ts',
        }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update promotion',
      };
    }
  }

  /**
   * Pause a promotion
   */
  static async pausePromotion(promotionId: string): Promise<{ success: boolean; error?: string }> {
    return PromotionService.updatePromotion(promotionId, { status: 'paused' });
  }

  /**
   * Resume a paused promotion
   */
  static async resumePromotion(promotionId: string): Promise<{ success: boolean; error?: string }> {
    return PromotionService.updatePromotion(promotionId, { status: 'active' });
  }

  /**
   * Increment redemption count for a promotion
   */
  static async recordRedemption(promotionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const promotion = await PromotionService.getPromotion(promotionId);

      if (!promotion) {
        return { success: false, error: 'Promotion not found' };
      }

      if (promotion.status !== 'active') {
        return { success: false, error: `Promotion is ${promotion.status}` };
      }

      if (promotion.maxRedemptions && promotion.redemptions >= promotion.maxRedemptions) {
        return { success: false, error: 'Promotion has reached maximum redemptions' };
      }

      const newRedemptions = promotion.redemptions + 1;
      const updates: Partial<Promotion> = {
        redemptions: newRedemptions,
        updatedAt: new Date(),
      };

      // Auto-pause if max redemptions reached
      if (promotion.maxRedemptions && newRedemptions >= promotion.maxRedemptions) {
        updates.status = 'paused';
      }

      await FirestoreService.update(
        PromotionService.getCollectionPath(),
        promotionId,
        updates
      );

      logger.info('PromotionService: Recorded redemption', {
        promotionId,
        newRedemptions,
        file: 'promotion-service.ts',
      });

      return { success: true };
    } catch (error) {
      logger.error(
        'PromotionService: Failed to record redemption',
        error instanceof Error ? error : new Error(String(error)),
        {
          promotionId,
          file: 'promotion-service.ts',
        }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record redemption',
      };
    }
  }

  /**
   * Delete a promotion
   */
  static async deletePromotion(promotionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await FirestoreService.delete(
        PromotionService.getCollectionPath(),
        promotionId
      );

      logger.info('PromotionService: Deleted promotion', {
        promotionId,
        file: 'promotion-service.ts',
      });

      return { success: true };
    } catch (error) {
      logger.error(
        'PromotionService: Failed to delete promotion',
        error instanceof Error ? error : new Error(String(error)),
        {
          promotionId,
          file: 'promotion-service.ts',
        }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete promotion',
      };
    }
  }

  /**
   * Get promotion analytics summary
   */
  static async getPromotionAnalytics(): Promise<{
    totalActive: number;
    totalRedemptions: number;
    averageROI: number;
    conversionLift: number;
  }> {
    try {
      const activePromotions = await PromotionService.getActivePromotions();

      const totalRedemptions = activePromotions.reduce(
        (sum, p) => sum + p.redemptions,
        0
      );

      // ROI calculation based on nudge strategy benchmarks
      const strategyROI: Record<NudgeStrategyId, number> = {
        ENGAGEMENT_NUDGE: 2.8,
        CART_ABANDONMENT: 3.5,
        WIN_BACK: 4.2,
        TRIAL_CONVERSION: 5.1,
        REFERRAL_REWARD: 6.8,
        SEASONAL_PROMO: 2.5,
        LOYALTY_TIER: 3.2,
      };

      const totalROI = activePromotions.reduce(
        (sum, p) => sum + (strategyROI[p.strategy] ?? 3.0),
        0
      );

      const averageROI = activePromotions.length > 0
        ? totalROI / activePromotions.length
        : 0;

      // Estimated conversion lift based on strategy mix
      const conversionLift = activePromotions.length > 0
        ? 15 + (averageROI * 2) // Base 15% + scaled boost
        : 0;

      return {
        totalActive: activePromotions.length,
        totalRedemptions,
        averageROI: Math.round(averageROI * 10) / 10,
        conversionLift: Math.round(conversionLift * 10) / 10,
      };
    } catch (error) {
      logger.error(
        'PromotionService: Failed to get analytics',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'promotion-service.ts' }
      );
      return {
        totalActive: 0,
        totalRedemptions: 0,
        averageROI: 0,
        conversionLift: 0,
      };
    }
  }
}
