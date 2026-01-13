/**
 * Coupon Service - Centralized Pricing and Coupon Engine
 *
 * Handles validation, redemption, and AI authorization for both
 * Platform-level and Merchant-level coupons.
 */

import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, increment, Timestamp } from 'firebase/firestore';
import { COLLECTIONS, getMerchantCouponsCollection } from '@/lib/firebase/collections';
import type {
  MerchantCoupon,
  PlatformCoupon,
  CouponValidationResult,
  CouponValidationError,
  CouponRedemption,
  AIAuthorizedDiscounts,
  AIDiscountRequest,
  PlatformPricingPlan,
} from '@/types/pricing';

// ============================================
// PLATFORM PRICING SERVICE
// ============================================

export class PlatformPricingService {
  private static db = getFirestore();

  /**
   * Get all active pricing plans
   */
  static async getActivePlans(): Promise<PlatformPricingPlan[]> {
    const plansRef = collection(this.db, COLLECTIONS.PLATFORM_PRICING);
    const q = query(plansRef, where('is_active', '==', true));
    const snapshot = await getDocs(q);

    const plans = snapshot.docs.map(doc => ({
      ...doc.data(),
      plan_id: doc.id,
    })) as PlatformPricingPlan[];

    return plans.sort((a, b) => a.display_order - b.display_order);
  }

  /**
   * Get public pricing plans (for pricing page)
   */
  static async getPublicPlans(): Promise<PlatformPricingPlan[]> {
    const plansRef = collection(this.db, COLLECTIONS.PLATFORM_PRICING);
    const q = query(
      plansRef,
      where('is_active', '==', true),
      where('is_public', '==', true)
    );
    const snapshot = await getDocs(q);

    const plans = snapshot.docs.map(doc => ({
      ...doc.data(),
      plan_id: doc.id,
    })) as PlatformPricingPlan[];

    return plans.sort((a, b) => a.display_order - b.display_order);
  }

  /**
   * Get a specific plan by ID
   */
  static async getPlan(planId: string): Promise<PlatformPricingPlan | null> {
    const planRef = doc(this.db, COLLECTIONS.PLATFORM_PRICING, planId);
    const snapshot = await getDoc(planRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      ...snapshot.data(),
      plan_id: snapshot.id,
    } as PlatformPricingPlan;
  }

  /**
   * Create or update a pricing plan (Admin only)
   */
  static async savePlan(plan: Omit<PlatformPricingPlan, 'created_at' | 'updated_at'>): Promise<PlatformPricingPlan> {
    const planRef = doc(this.db, COLLECTIONS.PLATFORM_PRICING, plan.plan_id);
    const existingPlan = await getDoc(planRef);

    const now = new Date().toISOString();
    const planData: PlatformPricingPlan = {
      ...plan,
      created_at: existingPlan.exists() ? existingPlan.data()?.created_at : now,
      updated_at: now,
    };

    await setDoc(planRef, planData);
    return planData;
  }

  /**
   * Update plan pricing (quick update for admin)
   */
  static async updatePricing(
    planId: string,
    priceUsd: number,
    yearlyPriceUsd?: number
  ): Promise<void> {
    const planRef = doc(this.db, COLLECTIONS.PLATFORM_PRICING, planId);
    await updateDoc(planRef, {
      price_usd: priceUsd,
      ...(yearlyPriceUsd !== undefined && { yearly_price_usd: yearlyPriceUsd }),
      updated_at: new Date().toISOString(),
    });
  }
}

// ============================================
// COUPON SERVICE
// ============================================

export class CouponService {
  private static db = getFirestore();

  // ----------------------------------------
  // PLATFORM COUPON METHODS
  // ----------------------------------------

  /**
   * Validate a platform coupon (for SaaS subscriptions)
   */
  static async validatePlatformCoupon(
    code: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    originalAmount: number
  ): Promise<CouponValidationResult> {
    const normalizedCode = code.toUpperCase().trim();

    // Find the coupon
    const couponsRef = collection(this.db, COLLECTIONS.PLATFORM_COUPONS);
    const q = query(couponsRef, where('code', '==', normalizedCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { valid: false, error: 'COUPON_NOT_FOUND' };
    }

    const coupon = {
      ...snapshot.docs[0].data(),
      id: snapshot.docs[0].id,
    } as PlatformCoupon;

    // Validate status
    if (coupon.status !== 'active') {
      const errorMap: Record<string, CouponValidationError> = {
        expired: 'COUPON_EXPIRED',
        depleted: 'COUPON_DEPLETED',
        disabled: 'COUPON_DISABLED',
      };
      return { valid: false, error: errorMap[coupon.status] || 'COUPON_DISABLED' };
    }

    // Validate date range
    const now = new Date();
    if (new Date(coupon.valid_from) > now) {
      return { valid: false, error: 'COUPON_NOT_STARTED' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { valid: false, error: 'COUPON_EXPIRED' };
    }

    // Validate usage limits
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, error: 'COUPON_DEPLETED' };
    }

    // Validate plan eligibility
    if (coupon.applies_to_plans !== 'all' && !coupon.applies_to_plans.includes(planId)) {
      return { valid: false, error: 'PLAN_NOT_ELIGIBLE' };
    }

    // Validate billing cycle
    if (coupon.billing_cycles !== 'all' && !coupon.billing_cycles.includes(billingCycle)) {
      return { valid: false, error: 'PLAN_NOT_ELIGIBLE' };
    }

    // Calculate discount
    const discountAmount = this.calculateDiscount(
      originalAmount,
      coupon.discount_type,
      coupon.value
    );

    const finalAmount = originalAmount - discountAmount;

    // Check for FREE FOREVER (100% discount)
    const warnings: string[] = [];
    if (coupon.is_free_forever || coupon.value === 100) {
      warnings.push('FREE_FOREVER_COUPON');
    }

    return {
      valid: true,
      coupon,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      warnings,
    };
  }

  /**
   * Redeem a platform coupon
   * CRITICAL: If is_free_forever or 100% discount, bypass Stripe and activate directly
   */
  static async redeemPlatformCoupon(
    code: string,
    organizationId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    originalAmount: number
  ): Promise<{
    success: boolean;
    redemption?: CouponRedemption;
    bypass_stripe?: boolean;
    error?: string;
  }> {
    // First validate
    const validation = await this.validatePlatformCoupon(code, planId, billingCycle, originalAmount);

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const coupon = validation.coupon as PlatformCoupon;

    // Check for FREE FOREVER - bypass Stripe entirely
    const isFreeForever = coupon.is_free_forever ||
      (coupon.discount_type === 'percentage' && coupon.value === 100);

    // Create redemption record
    const redemptionId = `redemption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const redemption: CouponRedemption = {
      id: redemptionId,
      coupon_id: coupon.id,
      coupon_type: 'platform',
      coupon_code: coupon.code,
      organization_id: organizationId,
      original_amount: originalAmount,
      discount_amount: validation.discount_amount!,
      final_amount: validation.final_amount!,
      applied_by: 'user',
      redeemed_at: new Date().toISOString(),
    };

    // Save redemption
    const redemptionRef = doc(this.db, COLLECTIONS.COUPON_REDEMPTIONS, redemptionId);
    await setDoc(redemptionRef, redemption);

    // Increment coupon usage
    const couponRef = doc(this.db, COLLECTIONS.PLATFORM_COUPONS, coupon.id);
    await updateDoc(couponRef, {
      current_uses: increment(1),
    });

    // Handle FREE FOREVER - Mark org as active_internal
    if (isFreeForever) {
      await this.activateInternalOrganization(organizationId, coupon.code);
    }

    return {
      success: true,
      redemption,
      bypass_stripe: isFreeForever,
    };
  }

  /**
   * Activate organization with internal/free-forever status
   * Bypasses Stripe checkout completely
   */
  private static async activateInternalOrganization(
    organizationId: string,
    couponCode: string
  ): Promise<void> {
    const orgRef = doc(this.db, COLLECTIONS.ORGANIZATIONS, organizationId);
    await updateDoc(orgRef, {
      status: 'active_internal',
      subscription_status: 'active',
      is_internal: true,
      free_forever_coupon: couponCode,
      activated_at: new Date().toISOString(),
      // No Stripe subscription needed
      stripe_customer_id: null,
      stripe_subscription_id: null,
    });
  }

  // ----------------------------------------
  // MERCHANT COUPON METHODS
  // ----------------------------------------

  /**
   * Validate a merchant coupon (for e-commerce purchases)
   */
  static async validateMerchantCoupon(
    code: string,
    organizationId: string,
    purchaseAmount: number,
    productIds?: string[],
    customerId?: string,
    isAIRequest: boolean = false
  ): Promise<CouponValidationResult> {
    const normalizedCode = code.toUpperCase().trim();

    // Get coupon from merchant's collection
    const couponsPath = getMerchantCouponsCollection(organizationId);
    const couponsRef = collection(this.db, couponsPath);
    const q = query(couponsRef, where('code', '==', normalizedCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { valid: false, error: 'COUPON_NOT_FOUND' };
    }

    const coupon = {
      ...snapshot.docs[0].data(),
      id: snapshot.docs[0].id,
    } as MerchantCoupon;

    // Validate status
    if (coupon.status !== 'active') {
      const errorMap: Record<string, CouponValidationError> = {
        expired: 'COUPON_EXPIRED',
        depleted: 'COUPON_DEPLETED',
        disabled: 'COUPON_DISABLED',
      };
      return { valid: false, error: errorMap[coupon.status] || 'COUPON_DISABLED' };
    }

    // Validate AI authorization if this is an AI request
    if (isAIRequest && !coupon.ai_authorized) {
      return { valid: false, error: 'AI_NOT_AUTHORIZED' };
    }

    // Validate date range
    const now = new Date();
    if (new Date(coupon.valid_from) > now) {
      return { valid: false, error: 'COUPON_NOT_STARTED' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { valid: false, error: 'COUPON_EXPIRED' };
    }

    // Validate usage limits
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, error: 'COUPON_DEPLETED' };
    }

    // Validate minimum purchase
    if (purchaseAmount < coupon.min_purchase) {
      return { valid: false, error: 'MIN_PURCHASE_NOT_MET' };
    }

    // Validate product eligibility
    if (coupon.applies_to === 'specific_products' && productIds) {
      const eligibleProducts = productIds.filter(id =>
        coupon.product_ids?.includes(id)
      );
      if (eligibleProducts.length === 0) {
        return { valid: false, error: 'PRODUCT_NOT_ELIGIBLE' };
      }
    }

    // Check per-customer limit
    if (customerId && coupon.max_uses_per_customer) {
      const customerUsage = await this.getCustomerCouponUsage(coupon.id, customerId);
      if (customerUsage >= coupon.max_uses_per_customer) {
        return { valid: false, error: 'CUSTOMER_LIMIT_REACHED' };
      }
    }

    // Calculate discount
    let discountAmount = this.calculateDiscount(
      purchaseAmount,
      coupon.discount_type,
      coupon.value
    );

    // Apply max discount cap if set
    if (coupon.max_discount && discountAmount > coupon.max_discount) {
      discountAmount = coupon.max_discount;
    }

    // Check AI discount limit if this is an AI request
    const warnings: string[] = [];
    if (isAIRequest) {
      const discountPercentage = (discountAmount / purchaseAmount) * 100;
      if (discountPercentage > coupon.ai_discount_limit) {
        return { valid: false, error: 'AI_DISCOUNT_LIMIT_EXCEEDED' };
      }
    }

    const finalAmount = purchaseAmount - discountAmount;

    return {
      valid: true,
      coupon,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      warnings,
    };
  }

  /**
   * Redeem a merchant coupon
   */
  static async redeemMerchantCoupon(
    code: string,
    organizationId: string,
    customerId: string,
    purchaseAmount: number,
    orderId: string,
    productIds?: string[],
    appliedBy: 'user' | 'ai_agent' | 'admin' = 'user',
    agentId?: string
  ): Promise<{
    success: boolean;
    redemption?: CouponRedemption;
    error?: string;
  }> {
    // Validate first
    const validation = await this.validateMerchantCoupon(
      code,
      organizationId,
      purchaseAmount,
      productIds,
      customerId,
      appliedBy === 'ai_agent'
    );

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const coupon = validation.coupon as MerchantCoupon;

    // Create redemption record
    const redemptionId = `redemption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const redemption: CouponRedemption = {
      id: redemptionId,
      coupon_id: coupon.id,
      coupon_type: 'merchant',
      coupon_code: coupon.code,
      organization_id: organizationId,
      customer_id: customerId,
      original_amount: purchaseAmount,
      discount_amount: validation.discount_amount!,
      final_amount: validation.final_amount!,
      applied_by: appliedBy,
      agent_id: agentId,
      redeemed_at: new Date().toISOString(),
      order_id: orderId,
    };

    // Save redemption
    const redemptionRef = doc(this.db, COLLECTIONS.COUPON_REDEMPTIONS, redemptionId);
    await setDoc(redemptionRef, redemption);

    // Increment coupon usage
    const couponPath = getMerchantCouponsCollection(organizationId);
    const couponRef = doc(this.db, couponPath, coupon.id);
    await updateDoc(couponRef, {
      current_uses: increment(1),
    });

    return {
      success: true,
      redemption,
    };
  }

  // ----------------------------------------
  // AI AGENT INTEGRATION
  // ----------------------------------------

  /**
   * Check if organization has is_internal_admin flag
   * Internal admin orgs get full AI access regardless of agent permissions
   */
  static async isInternalAdminOrg(organizationId: string): Promise<boolean> {
    const orgRef = doc(this.db, COLLECTIONS.ORGANIZATIONS, organizationId);
    const orgSnap = await getDoc(orgRef);
    const orgData = orgSnap.data() || {};
    return orgData.is_internal_admin === true;
  }

  /**
   * Get authorized discounts for AI agents
   * Called by Inbound Closer and Campaign Strategist
   *
   * SECURITY: Filters coupons based on permissions:
   * - canNegotiate=false: Only returns 'public_marketing' coupons
   * - canNegotiate=true: Returns all AI-authorized coupons
   * - isInternalAdmin=true: Overrides all restrictions, returns everything
   */
  static async getAuthorizedDiscounts(
    organizationId: string,
    options: {
      canNegotiate?: boolean;
      isInternalAdmin?: boolean;
    } = {}
  ): Promise<AIAuthorizedDiscounts> {
    const { canNegotiate = false, isInternalAdmin = false } = options;

    // Check if org is internal admin (override flag)
    const orgIsInternalAdmin = isInternalAdmin || await this.isInternalAdminOrg(organizationId);

    // Get all AI-authorized coupons for this organization
    const couponsPath = getMerchantCouponsCollection(organizationId);
    const couponsRef = collection(this.db, couponsPath);
    const q = query(
      couponsRef,
      where('ai_authorized', '==', true),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);

    // Filter coupons based on permissions
    const filteredDocs = snapshot.docs.filter(docSnap => {
      const data = docSnap.data() as MerchantCoupon;

      // Internal admin orgs get ALL coupons
      if (orgIsInternalAdmin) {
        return true;
      }

      // If agent can negotiate, return all coupons
      if (canNegotiate) {
        return true;
      }

      // Default: Only return public_marketing coupons
      // For backward compatibility, treat undefined/null as 'negotiation' (restricted)
      return data.coupon_category === 'public_marketing';
    });

    const availableCoupons = filteredDocs.map(docSnap => {
      const data = docSnap.data() as MerchantCoupon;
      return {
        code: data.code,
        discount_type: data.discount_type,
        value: data.value,
        max_discount: data.max_discount,
        description: data.notes,
        trigger_keywords: data.ai_trigger_keywords,
        category: data.coupon_category || 'negotiation', // Include category for transparency
      };
    });

    // Get organization's AI discount settings
    const orgRef = doc(this.db, COLLECTIONS.ORGANIZATIONS, organizationId);
    const orgSnap = await getDoc(orgRef);
    const orgData = orgSnap.data() || {};

    // Calculate max AI discount from available coupons (post-filter)
    const maxAiDiscountPercentage = Math.max(
      ...availableCoupons
        .filter(c => c.discount_type === 'percentage')
        .map(c => c.value),
      0
    );

    return {
      organization_id: organizationId,
      available_coupons: availableCoupons,
      max_ai_discount_percentage: orgData.ai_max_discount_percentage || maxAiDiscountPercentage,
      require_human_approval_above: orgData.ai_human_approval_threshold || 30,
      can_stack_discounts: orgData.ai_can_stack_discounts || false,
      auto_offer_on_hesitation: orgData.ai_auto_offer_hesitation || true,
      auto_offer_on_price_objection: orgData.ai_auto_offer_price_objection || true,
    };
  }

  /**
   * Request a discount (for AI agents when exceeding their limit)
   */
  static async requestAIDiscount(
    organizationId: string,
    agentId: string,
    conversationId: string,
    requestedDiscount: number,
    couponCode?: string,
    customerContext?: {
      customer_id?: string;
      cart_value?: number;
      customer_segment?: string;
      conversation_sentiment?: string;
    }
  ): Promise<AIDiscountRequest> {
    const requestId = `ai_discount_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if within auto-approval threshold
    const authorized = await this.getAuthorizedDiscounts(organizationId);
    const isAutoApproved = requestedDiscount <= authorized.require_human_approval_above;

    const request: AIDiscountRequest = {
      id: requestId,
      organization_id: organizationId,
      agent_id: agentId,
      conversation_id: conversationId,
      requested_discount: requestedDiscount,
      coupon_code: couponCode,
      status: isAutoApproved ? 'auto_approved' : 'pending_approval',
      customer_context: customerContext || {},
      created_at: new Date().toISOString(),
      resolved_at: isAutoApproved ? new Date().toISOString() : undefined,
    };

    const requestRef = doc(this.db, COLLECTIONS.AI_DISCOUNT_REQUESTS, requestId);
    await setDoc(requestRef, request);

    return request;
  }

  // ----------------------------------------
  // MERCHANT COUPON MANAGEMENT
  // ----------------------------------------

  /**
   * Create a merchant coupon
   */
  static async createMerchantCoupon(
    organizationId: string,
    couponData: Omit<MerchantCoupon, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'current_uses'>,
    createdBy: string
  ): Promise<MerchantCoupon> {
    const couponId = `coupon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const coupon: MerchantCoupon = {
      ...couponData,
      id: couponId,
      code: couponData.code.toUpperCase().trim(),
      organization_id: organizationId,
      current_uses: 0,
      created_at: now,
      updated_at: now,
      created_by: createdBy,
    };

    const couponPath = getMerchantCouponsCollection(organizationId);
    const couponRef = doc(this.db, couponPath, couponId);
    await setDoc(couponRef, coupon);

    return coupon;
  }

  /**
   * Get all merchant coupons for an organization
   */
  static async getMerchantCoupons(organizationId: string): Promise<MerchantCoupon[]> {
    const couponPath = getMerchantCouponsCollection(organizationId);
    const couponsRef = collection(this.db, couponPath);
    const snapshot = await getDocs(couponsRef);

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as MerchantCoupon[];
  }

  /**
   * Update a merchant coupon
   */
  static async updateMerchantCoupon(
    organizationId: string,
    couponId: string,
    updates: Partial<MerchantCoupon>
  ): Promise<void> {
    const couponPath = getMerchantCouponsCollection(organizationId);
    const couponRef = doc(this.db, couponPath, couponId);

    await updateDoc(couponRef, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Disable a merchant coupon
   */
  static async disableMerchantCoupon(organizationId: string, couponId: string): Promise<void> {
    await this.updateMerchantCoupon(organizationId, couponId, { status: 'disabled' });
  }

  // ----------------------------------------
  // PLATFORM COUPON MANAGEMENT (Admin)
  // ----------------------------------------

  /**
   * Create a platform coupon (Admin only)
   */
  static async createPlatformCoupon(
    couponData: Omit<PlatformCoupon, 'id' | 'created_at' | 'updated_at' | 'current_uses'>,
    createdBy: string
  ): Promise<PlatformCoupon> {
    const couponId = `platform_coupon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const coupon: PlatformCoupon = {
      ...couponData,
      id: couponId,
      code: couponData.code.toUpperCase().trim(),
      current_uses: 0,
      created_at: now,
      updated_at: now,
      created_by: createdBy,
    };

    const couponRef = doc(this.db, COLLECTIONS.PLATFORM_COUPONS, couponId);
    await setDoc(couponRef, coupon);

    return coupon;
  }

  /**
   * Get all platform coupons (Admin only)
   */
  static async getPlatformCoupons(): Promise<PlatformCoupon[]> {
    const couponsRef = collection(this.db, COLLECTIONS.PLATFORM_COUPONS);
    const snapshot = await getDocs(couponsRef);

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as PlatformCoupon[];
  }

  // ----------------------------------------
  // HELPER METHODS
  // ----------------------------------------

  /**
   * Calculate discount amount
   */
  private static calculateDiscount(
    amount: number,
    discountType: 'percentage' | 'fixed',
    value: number
  ): number {
    if (discountType === 'percentage') {
      return Math.round((amount * value) / 100);
    }
    return Math.min(value, amount); // Fixed discount can't exceed amount
  }

  /**
   * Get customer's usage count for a specific coupon
   */
  private static async getCustomerCouponUsage(
    couponId: string,
    customerId: string
  ): Promise<number> {
    const redemptionsRef = collection(this.db, COLLECTIONS.COUPON_REDEMPTIONS);
    const q = query(
      redemptionsRef,
      where('coupon_id', '==', couponId),
      where('customer_id', '==', customerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  /**
   * Get coupon analytics for a merchant
   */
  static async getCouponAnalytics(organizationId: string): Promise<{
    totalCoupons: number;
    activeCoupons: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
    topCoupons: { code: string; uses: number; revenue_impact: number }[];
  }> {
    const coupons = await this.getMerchantCoupons(organizationId);

    // Get redemptions
    const redemptionsRef = collection(this.db, COLLECTIONS.COUPON_REDEMPTIONS);
    const q = query(
      redemptionsRef,
      where('organization_id', '==', organizationId),
      where('coupon_type', '==', 'merchant')
    );
    const redemptionsSnap = await getDocs(q);
    const redemptions = redemptionsSnap.docs.map(d => d.data() as CouponRedemption);

    const totalDiscountGiven = redemptions.reduce((sum, r) => sum + r.discount_amount, 0);

    // Calculate top coupons
    const couponStats = new Map<string, { uses: number; revenue_impact: number }>();
    for (const redemption of redemptions) {
      const current = couponStats.get(redemption.coupon_code) || { uses: 0, revenue_impact: 0 };
      couponStats.set(redemption.coupon_code, {
        uses: current.uses + 1,
        revenue_impact: current.revenue_impact + redemption.discount_amount,
      });
    }

    const topCoupons = Array.from(couponStats.entries())
      .map(([code, stats]) => ({ code, ...stats }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5);

    return {
      totalCoupons: coupons.length,
      activeCoupons: coupons.filter(c => c.status === 'active').length,
      totalRedemptions: redemptions.length,
      totalDiscountGiven,
      topCoupons,
    };
  }
}

// Export singleton-style functions for convenience
export const validatePlatformCoupon = CouponService.validatePlatformCoupon.bind(CouponService);
export const validateMerchantCoupon = CouponService.validateMerchantCoupon.bind(CouponService);
export const redeemPlatformCoupon = CouponService.redeemPlatformCoupon.bind(CouponService);
export const redeemMerchantCoupon = CouponService.redeemMerchantCoupon.bind(CouponService);
export const getAuthorizedDiscounts = CouponService.getAuthorizedDiscounts.bind(CouponService);
export const isInternalAdminOrg = CouponService.isInternalAdminOrg.bind(CouponService);
