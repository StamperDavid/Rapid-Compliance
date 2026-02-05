/**
 * Platform Pricing & Coupon Types
 * Centralized Pricing and Coupon Engine for SalesVelocity.ai
 */

// ============================================
// TASK 1: Global Platform Pricing (Admin Level)
// ============================================

export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';

/**
 * Platform Pricing Plan - Stored in platform_pricing collection
 * These are the global SaaS tiers managed by platform admins
 */
export interface PlatformPricingPlan {
  // Primary identifier
  plan_id: string;

  // Pricing
  price_usd: number;
  billing_cycle: BillingCycle;
  yearly_price_usd?: number; // Optional yearly discount price

  // Display info
  name: string;
  description?: string;
  badge?: string; // e.g., "Most Popular", "Best Value"
  display_order: number;

  // Feature limits (JSON structure)
  feature_limits: FeatureLimits;

  // Visibility
  is_public: boolean; // Show on pricing page
  is_active: boolean; // Available for new subscriptions

  // Stripe integration
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Feature limits configuration
 * Defines what each plan tier includes
 */
export interface FeatureLimits {
  // Record/Data limits
  max_records: number; // -1 for unlimited
  max_workspaces: number;
  max_team_members: number;

  // AI limits
  ai_conversations_per_month: number; // -1 for unlimited
  ai_email_generations_per_month: number;
  ai_agents_count: number;

  // Outbound limits
  emails_per_month: number;
  sms_per_month: number;
  linkedin_actions_per_month: number;

  // Feature flags
  features: {
    crm: boolean;
    ecommerce: boolean;
    workflows: boolean;
    white_label: boolean;
    custom_domain: boolean;
    api_access: boolean;
    priority_support: boolean;
    dedicated_account_manager: boolean;
    custom_integrations: boolean;
    advanced_analytics: boolean;
    ai_training: boolean;
    voice_agents: boolean;
    video_generation: boolean;
  };

  // Custom overrides (for enterprise/custom plans)
  custom_limits?: Record<string, number | boolean | string>;
}

// ============================================
// TASK 2: Merchant-Level Coupons (Client Level)
// ============================================

export type DiscountType = 'percentage' | 'fixed';
export type CouponStatus = 'active' | 'expired' | 'depleted' | 'disabled';

/**
 * SECURITY: Coupon category determines AI access levels
 * - public_marketing: AI can MENTION these to customers (no can_negotiate required)
 * - negotiation: AI can only ACCESS if agent.can_negotiate === true
 */
export type CouponCategory = 'public_marketing' | 'negotiation';

/**
 * Merchant Coupon - Stored in organizations/{orgId}/merchant_coupons
 * These are coupons created by merchants for their customers
 */
export interface MerchantCoupon {
  // Primary identifier
  id: string;
  code: string; // User-facing coupon code (uppercase, normalized)

  // Discount configuration
  discount_type: DiscountType;
  value: number; // Percentage (0-100) or fixed amount in cents

  // Constraints
  min_purchase: number; // Minimum purchase amount in cents (0 = no minimum)
  max_discount?: number; // Cap for percentage discounts (in cents)
  max_uses?: number; // Total redemptions allowed (null = unlimited)
  max_uses_per_customer?: number; // Per-customer limit
  current_uses: number;

  // Validity
  valid_from: string; // ISO date
  valid_until?: string; // ISO date (null = no expiration)

  // SECURITY: Coupon Category
  /**
   * Determines AI access level:
   * - 'public_marketing': AI can mention these codes to customers (visible on website, social media)
   *   No can_negotiate permission required. AI can tell customers "Use code SUMMER20 for 10% off!"
   * - 'negotiation': AI can ONLY access if agent.can_negotiate === true
   *   These are reserved for closing deals, price objection handling, etc.
   *   Default for backward compatibility: 'negotiation'
   */
  coupon_category: CouponCategory;

  // AI Authorization - CRITICAL for Inbound Closer
  ai_authorized: boolean; // Can AI agents apply this coupon?
  ai_discount_limit: number; // Max discount AI can offer without human approval (percentage 0-100)
  ai_auto_apply: boolean; // Should AI automatically mention/offer this?
  ai_trigger_keywords?: string[]; // Keywords that trigger AI to offer this coupon

  // Targeting
  applies_to: 'all' | 'specific_products' | 'specific_categories' | 'first_purchase';
  product_ids?: string[];
  category_ids?: string[];
  customer_segments?: string[]; // e.g., 'new', 'returning', 'vip'

  // Status
  status: CouponStatus;

  // Metadata
  organization_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  notes?: string; // Internal notes for the merchant
}

/**
 * Platform Coupon - Global coupons for SaaS subscriptions
 * Stored in platform_coupons collection (admin-managed)
 */
export interface PlatformCoupon {
  id: string;
  code: string;

  discount_type: DiscountType;
  value: number;

  // Special flags
  is_free_forever: boolean; // 100% discount, bypasses Stripe
  is_internal_only: boolean; // Only for internal testing

  // Plan restrictions
  applies_to_plans: string[] | 'all'; // plan_ids or 'all'
  billing_cycles: BillingCycle[] | 'all';

  // Usage limits
  max_uses?: number;
  current_uses: number;

  // Validity
  valid_from: string;
  valid_until?: string;

  status: CouponStatus;

  created_at: string;
  updated_at: string;
  created_by: string;
  notes?: string;
}

// ============================================
// TASK 3: Coupon Redemption Types
// ============================================

/**
 * Coupon redemption record
 */
export interface CouponRedemption {
  id: string;
  coupon_id: string;
  coupon_type: 'platform' | 'merchant';
  coupon_code: string;

  // Who redeemed
  organization_id?: string; // For platform coupons
  customer_id?: string; // For merchant coupons

  // Transaction details
  original_amount: number;
  discount_amount: number;
  final_amount: number;

  // Context
  applied_by: 'user' | 'ai_agent' | 'admin';
  agent_id?: string; // If applied by AI

  // Metadata
  redeemed_at: string;
  order_id?: string;
  subscription_id?: string;
}

/**
 * Coupon validation result
 */
export interface CouponValidationResult {
  valid: boolean;
  coupon?: MerchantCoupon | PlatformCoupon;
  error?: CouponValidationError;
  discount_amount?: number;
  final_amount?: number;
  warnings?: string[];
}

export type CouponValidationError =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_EXPIRED'
  | 'COUPON_DEPLETED'
  | 'COUPON_DISABLED'
  | 'COUPON_NOT_STARTED'
  | 'MIN_PURCHASE_NOT_MET'
  | 'PRODUCT_NOT_ELIGIBLE'
  | 'CUSTOMER_LIMIT_REACHED'
  | 'PLAN_NOT_ELIGIBLE'
  | 'AI_NOT_AUTHORIZED'
  | 'AI_DISCOUNT_LIMIT_EXCEEDED';

// ============================================
// AI Integration Types
// ============================================

/**
 * Authorized discounts for AI agents
 * Used by Inbound Closer and Campaign Strategist
 *
 * SECURITY: The available_coupons array is filtered based on agent permissions:
 * - can_negotiate=false: Only 'public_marketing' coupons
 * - can_negotiate=true: All AI-authorized coupons
 * - is_internal_admin=true: Overrides all restrictions
 */
export interface AIAuthorizedDiscounts {
  organization_id: string;

  // Available coupons the AI can offer (filtered by permissions)
  available_coupons: {
    code: string;
    discount_type: DiscountType;
    value: number;
    max_discount?: number;
    description?: string;
    trigger_keywords?: string[];
    /**
     * Coupon category for display purposes
     * - 'public_marketing': Can be mentioned to customers
     * - 'negotiation': Reserved for deal closing
     */
    category?: CouponCategory;
  }[];

  // Global AI discount settings
  max_ai_discount_percentage: number; // Overall cap
  require_human_approval_above: number; // Percentage threshold

  // Contextual rules
  can_stack_discounts: boolean;
  auto_offer_on_hesitation: boolean;
  auto_offer_on_price_objection: boolean;
}

/**
 * AI discount request (for audit trail)
 */
export interface AIDiscountRequest {
  id: string;
  organization_id: string;
  agent_id: string;
  conversation_id: string;

  requested_discount: number;
  coupon_code?: string;

  status: 'auto_approved' | 'pending_approval' | 'approved' | 'rejected';
  approved_by?: string;

  customer_context: {
    customer_id?: string;
    cart_value?: number;
    customer_segment?: string;
    conversation_sentiment?: string;
  };

  created_at: string;
  resolved_at?: string;
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_FEATURE_LIMITS: FeatureLimits = {
  max_records: 100,
  max_workspaces: 1,
  max_team_members: 3,
  ai_conversations_per_month: 100,
  ai_email_generations_per_month: 50,
  ai_agents_count: 1,
  emails_per_month: 500,
  sms_per_month: 0,
  linkedin_actions_per_month: 0,
  features: {
    crm: true,
    ecommerce: false,
    workflows: false,
    white_label: false,
    custom_domain: false,
    api_access: false,
    priority_support: false,
    dedicated_account_manager: false,
    custom_integrations: false,
    advanced_analytics: false,
    ai_training: false,
    voice_agents: false,
    video_generation: false,
  },
};

/**
 * Default SaaS pricing tiers
 */
export const DEFAULT_PRICING_TIERS: Omit<PlatformPricingPlan, 'created_at' | 'updated_at'>[] = [
  {
    plan_id: 'basic',
    name: 'Basic',
    price_usd: 49,
    yearly_price_usd: 490,
    billing_cycle: 'monthly',
    description: 'Perfect for solopreneurs and small teams getting started',
    badge: undefined,
    display_order: 1,
    is_public: true,
    is_active: true,
    feature_limits: {
      max_records: 500,
      max_workspaces: 1,
      max_team_members: 3,
      ai_conversations_per_month: 500,
      ai_email_generations_per_month: 200,
      ai_agents_count: 2,
      emails_per_month: 2000,
      sms_per_month: 100,
      linkedin_actions_per_month: 0,
      features: {
        crm: true,
        ecommerce: true,
        workflows: true,
        white_label: false,
        custom_domain: false,
        api_access: false,
        priority_support: false,
        dedicated_account_manager: false,
        custom_integrations: false,
        advanced_analytics: false,
        ai_training: false,
        voice_agents: false,
        video_generation: false,
      },
    },
  },
  {
    plan_id: 'pro',
    name: 'Pro',
    price_usd: 149,
    yearly_price_usd: 1490,
    billing_cycle: 'monthly',
    description: 'For growing businesses that need more power',
    badge: 'Most Popular',
    display_order: 2,
    is_public: true,
    is_active: true,
    feature_limits: {
      max_records: 5000,
      max_workspaces: 5,
      max_team_members: 10,
      ai_conversations_per_month: -1, // Unlimited
      ai_email_generations_per_month: -1,
      ai_agents_count: 10,
      emails_per_month: -1,
      sms_per_month: 1000,
      linkedin_actions_per_month: 500,
      features: {
        crm: true,
        ecommerce: true,
        workflows: true,
        white_label: true,
        custom_domain: true,
        api_access: true,
        priority_support: true,
        dedicated_account_manager: false,
        custom_integrations: false,
        advanced_analytics: true,
        ai_training: true,
        voice_agents: true,
        video_generation: false,
      },
    },
  },
  {
    plan_id: 'influencer',
    name: 'Influencer',
    price_usd: 299,
    yearly_price_usd: 2990,
    billing_cycle: 'monthly',
    description: 'Built for content creators and influencers with large audiences',
    badge: 'Creator\'s Choice',
    display_order: 3,
    is_public: true,
    is_active: true,
    feature_limits: {
      max_records: 25000,
      max_workspaces: 10,
      max_team_members: 25,
      ai_conversations_per_month: -1,
      ai_email_generations_per_month: -1,
      ai_agents_count: -1,
      emails_per_month: -1,
      sms_per_month: 5000,
      linkedin_actions_per_month: 2000,
      features: {
        crm: true,
        ecommerce: true,
        workflows: true,
        white_label: true,
        custom_domain: true,
        api_access: true,
        priority_support: true,
        dedicated_account_manager: true,
        custom_integrations: true,
        advanced_analytics: true,
        ai_training: true,
        voice_agents: true,
        video_generation: true,
      },
    },
  },
  {
    plan_id: 'enterprise',
    name: 'Enterprise',
    price_usd: 0, // Custom pricing
    billing_cycle: 'monthly',
    description: 'Custom solutions for large organizations',
    badge: 'Contact Sales',
    display_order: 4,
    is_public: true,
    is_active: true,
    feature_limits: {
      max_records: -1,
      max_workspaces: -1,
      max_team_members: -1,
      ai_conversations_per_month: -1,
      ai_email_generations_per_month: -1,
      ai_agents_count: -1,
      emails_per_month: -1,
      sms_per_month: -1,
      linkedin_actions_per_month: -1,
      features: {
        crm: true,
        ecommerce: true,
        workflows: true,
        white_label: true,
        custom_domain: true,
        api_access: true,
        priority_support: true,
        dedicated_account_manager: true,
        custom_integrations: true,
        advanced_analytics: true,
        ai_training: true,
        voice_agents: true,
        video_generation: true,
      },
    },
  },
];
