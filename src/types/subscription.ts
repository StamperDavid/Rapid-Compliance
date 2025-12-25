/**
 * Subscription Types - Volume-Based "Growth Partner" Model
 * All tiers have access to ALL features - differentiated only by record capacity
 */

// NEW: Volume-based tier system (replaces feature-gated plans)
export type SubscriptionTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

// DEPRECATED: Legacy plan types (kept for backward compatibility during migration)
export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise' | 'custom';

export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'canceled' | 'paused';

/**
 * SINGLE SOURCE OF TRUTH: Volume-Based Pricing Tiers
 * Success-Linked Pricing - Pay for what you store, not what you use
 */
export const VOLUME_TIERS = {
  tier1: {
    id: 'tier1',
    name: 'Tier 1',
    price: 400, // $400/month
    recordMin: 0,
    recordMax: 100,
    description: 'Perfect for getting started',
  },
  tier2: {
    id: 'tier2',
    name: 'Tier 2',
    price: 650, // $650/month
    recordMin: 101,
    recordMax: 250,
    description: 'Growing your pipeline',
  },
  tier3: {
    id: 'tier3',
    name: 'Tier 3',
    price: 1000, // $1,000/month
    recordMin: 251,
    recordMax: 500,
    description: 'Scaling your operations',
  },
  tier4: {
    id: 'tier4',
    name: 'Tier 4',
    price: 1250, // $1,250/month
    recordMin: 501,
    recordMax: 1000,
    description: 'Enterprise-level capacity',
  },
} as const;

/**
 * All-Inclusive Features (Every tier gets everything)
 * No feature gating - everyone has access to the full platform
 */
export const ALL_INCLUSIVE_FEATURES = [
  // AI & Automation
  'AI Sales Agents (Unlimited)',
  'AI Email Writer (Unlimited)',
  'AI Reply Handler',
  'AI Meeting Scheduler',
  
  // Lead Generation
  'Lead Scraper & Enrichment',
  'Prospect Finder (All Sources)',
  'Data Import/Export',
  
  // Outbound & Campaigns
  'Email Sequences (Unlimited)',
  'Multi-Channel Outreach (Email, LinkedIn, SMS)',
  'A/B Testing',
  
  // Social Media AI
  'Social Media Management',
  'Content Generation',
  'Auto-Posting',
  
  // CRM & Admin
  'Full CRM Suite',
  'Workflow Automation',
  'E-commerce Integration',
  'Custom Schemas',
  'API Access',
  'White-Label Options',
  
  // Support
  'Email & Chat Support',
  'Knowledge Base',
] as const;

/**
 * BYOK (Bring Your Own Key) - No Token Markup
 * Users connect their own API keys and pay raw market rates
 */
export const BYOK_PROVIDERS = [
  'OpenRouter',
  'OpenAI',
  'Anthropic',
  'Google AI',
  'Custom LLMs',
] as const;

export interface OrganizationSubscription {
  organizationId: string;
  
  // NEW: Volume-based tier (primary pricing model)
  tier: SubscriptionTier;
  
  // DEPRECATED: Legacy plan field (kept for backward compatibility)
  plan?: SubscriptionPlan;
  
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  
  // Trial information
  trialEndsAt?: string; // ISO date
  isTrialing: boolean;
  trialRequiresPayment: boolean; // NEW: Always true - credit card required for trial
  
  // NEW: Record capacity tracking (what determines pricing tier)
  recordCount: number; // Current total records across all workspaces
  recordCapacity: number; // Max allowed for current tier
  recordCountLastUpdated: string; // ISO date
  
  // NEW: All features enabled (no gating)
  // Features are controlled by tier capacity, not feature flags
  allFeaturesEnabled: true; // Always true - everyone gets everything
  
  // DEPRECATED: Feature gating removed in volume-based model
  // Kept for backward compatibility during migration
  coreFeatures?: {
    aiChatAgent: boolean;
    crm: boolean;
    ecommerce: boolean;
    workflows: boolean;
    whiteLabel: boolean;
  };
  
  // DEPRECATED: Outbound features no longer gated
  outboundFeatures?: OutboundFeatures;
  
  // DEPRECATED: Add-ons not needed (everything included)
  addOns?: SubscriptionAddOn[];
  
  // Usage tracking for analytics (not for limiting access)
  usage: UsageMetrics;
  
  // Billing information
  billing: BillingInfo;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface OutboundFeatures {
  // AI Email Writer
  aiEmailWriter: {
    enabled: boolean;
    monthlyLimit: number; // Max emails per month
    used: number; // Current month usage
    resetDate: string; // ISO date - when usage resets
  };
  
  // Email Sequences
  emailSequences: {
    enabled: boolean;
    maxActiveSequences: number; // Max concurrent sequences
    maxProspectsPerSequence: number; // Max prospects per sequence
    currentSequences: number; // Current active sequences
    currentProspects: number; // Total prospects in all sequences
  };
  
  // Email Reply Handler
  emailReplyHandler: {
    enabled: boolean;
    autonomousMode: boolean; // true = auto-send, false = approval required
    confidenceThreshold: number; // 0-100, only auto-send if confidence > threshold
    requireApproval: boolean; // Override for sensitive responses
  };
  
  // Meeting Scheduler
  meetingScheduler: {
    enabled: boolean;
    automated: boolean; // true = AI handles scheduling, false = manual Calendly link
    smartRouting: boolean; // Route to best rep based on criteria
    maxMeetingsPerMonth: number;
    meetingsBookedThisMonth: number;
  };
  
  // Prospect Finder
  prospectFinder: {
    enabled: boolean;
    monthlyLimit: number; // Max prospects to find per month
    used: number; // Current month usage
    resetDate: string;
    enabledSources: ProspectSource[]; // Which data sources are enabled
  };
  
  // Multi-Channel Outreach
  multiChannel: {
    enabled: boolean;
    channels: {
      email: {
        enabled: boolean;
        monthlyLimit: number;
        used: number;
      };
      linkedin: {
        enabled: boolean;
        monthlyLimit: number; // Connection requests + messages
        used: number;
      };
      sms: {
        enabled: boolean;
        monthlyLimit: number;
        used: number;
      };
    };
  };
  
  // A/B Testing
  abTesting: {
    enabled: boolean;
    maxConcurrentTests: number; // Max A/B tests running simultaneously
    currentTests: number;
  };
  
  // Advanced Features (Enterprise only)
  advanced: {
    customAIModel: boolean; // Fine-tuned model
    dedicatedSupport: boolean;
    whiteGloveOnboarding: boolean;
    customIntegrations: boolean;
    apiAccess: boolean;
  };
}

export type ProspectSource = 'apollo' | 'linkedin' | 'zoominfo' | 'clearbit' | 'hunter';

export interface SubscriptionAddOn {
  id: string;
  name: string;
  description: string;
  price: number; // Monthly price
  features: string[]; // List of features this add-on provides
  enabled: boolean;
  addedAt: string; // ISO date
}

export interface UsageMetrics {
  // Email metrics
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  
  // LinkedIn metrics
  linkedinConnectionRequests: number;
  linkedinMessagesSet: number;
  linkedinAcceptanceRate: number;
  
  // SMS metrics
  smsSent: number;
  smsDelivered: number;
  smsReplied: number;
  
  // Prospect metrics
  prospectsFilled: number;
  prospectsEnrolled: number;
  prospectsConverted: number;
  
  // Meeting metrics
  meetingsBooked: number;
  meetingsHeld: number;
  meetingsNoShow: number;
  
  // AI metrics
  aiEmailsGenerated: number;
  aiRepliesGenerated: number;
  aiTokensUsed: number;
  
  // Reset date for monthly metrics
  periodStart: string;
  periodEnd: string;
}

export interface BillingInfo {
  // Stripe customer ID
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Billing period
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  
  // Pricing
  basePrice: number; // Plan base price
  addOnsPrice: number; // Total add-ons price
  totalMRR: number; // Monthly recurring revenue
  
  // Payment method
  paymentMethod?: {
    type: 'card' | 'bank' | 'paypal';
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
  };
  
  // Invoice history
  lastInvoiceDate?: string;
  lastInvoiceAmount?: number;
  lastInvoiceStatus?: 'paid' | 'pending' | 'failed';
}

// Plan configurations (what each plan includes)
export const PLAN_LIMITS: Record<SubscriptionPlan, Partial<OutboundFeatures>> = {
  starter: {
    aiEmailWriter: {
      enabled: false, // Requires add-on
      monthlyLimit: 0,
      used: 0,
      resetDate: new Date().toISOString(),
    },
    emailSequences: {
      enabled: false,
      maxActiveSequences: 0,
      maxProspectsPerSequence: 0,
      currentSequences: 0,
      currentProspects: 0,
    },
    emailReplyHandler: {
      enabled: false,
      autonomousMode: false,
      confidenceThreshold: 80,
      requireApproval: true,
    },
    meetingScheduler: {
      enabled: true, // Manual Calendly link
      automated: false,
      smartRouting: false,
      maxMeetingsPerMonth: 999999,
      meetingsBookedThisMonth: 0,
    },
    prospectFinder: {
      enabled: false,
      monthlyLimit: 0,
      used: 0,
      resetDate: new Date().toISOString(),
      enabledSources: [],
    },
    multiChannel: {
      enabled: false,
      channels: {
        email: { enabled: true, monthlyLimit: 500, used: 0 },
        linkedin: { enabled: false, monthlyLimit: 0, used: 0 },
        sms: { enabled: false, monthlyLimit: 0, used: 0 },
      },
    },
    abTesting: {
      enabled: false,
      maxConcurrentTests: 0,
      currentTests: 0,
    },
    advanced: {
      customAIModel: false,
      dedicatedSupport: false,
      whiteGloveOnboarding: false,
      customIntegrations: false,
      apiAccess: false,
    },
  },
  
  professional: {
    aiEmailWriter: {
      enabled: true,
      monthlyLimit: 500,
      used: 0,
      resetDate: new Date().toISOString(),
    },
    emailSequences: {
      enabled: true,
      maxActiveSequences: 5,
      maxProspectsPerSequence: 1000,
      currentSequences: 0,
      currentProspects: 0,
    },
    emailReplyHandler: {
      enabled: true,
      autonomousMode: false, // Requires approval by default
      confidenceThreshold: 85,
      requireApproval: true,
    },
    meetingScheduler: {
      enabled: true,
      automated: true,
      smartRouting: false,
      maxMeetingsPerMonth: 999999,
      meetingsBookedThisMonth: 0,
    },
    prospectFinder: {
      enabled: false, // Requires add-on
      monthlyLimit: 0,
      used: 0,
      resetDate: new Date().toISOString(),
      enabledSources: [],
    },
    multiChannel: {
      enabled: false, // Requires add-on
      channels: {
        email: { enabled: true, monthlyLimit: 2000, used: 0 },
        linkedin: { enabled: false, monthlyLimit: 0, used: 0 },
        sms: { enabled: false, monthlyLimit: 0, used: 0 },
      },
    },
    abTesting: {
      enabled: true,
      maxConcurrentTests: 3,
      currentTests: 0,
    },
    advanced: {
      customAIModel: false,
      dedicatedSupport: false,
      whiteGloveOnboarding: false,
      customIntegrations: false,
      apiAccess: true,
    },
  },
  
  enterprise: {
    aiEmailWriter: {
      enabled: true,
      monthlyLimit: 5000,
      used: 0,
      resetDate: new Date().toISOString(),
    },
    emailSequences: {
      enabled: true,
      maxActiveSequences: 999999, // Unlimited
      maxProspectsPerSequence: 10000,
      currentSequences: 0,
      currentProspects: 0,
    },
    emailReplyHandler: {
      enabled: true,
      autonomousMode: true, // Can enable autonomous mode
      confidenceThreshold: 90,
      requireApproval: false, // Can disable approval
    },
    meetingScheduler: {
      enabled: true,
      automated: true,
      smartRouting: true,
      maxMeetingsPerMonth: 999999,
      meetingsBookedThisMonth: 0,
    },
    prospectFinder: {
      enabled: true,
      monthlyLimit: 1000,
      used: 0,
      resetDate: new Date().toISOString(),
      enabledSources: ['apollo', 'linkedin', 'zoominfo', 'clearbit', 'hunter'],
    },
    multiChannel: {
      enabled: true,
      channels: {
        email: { enabled: true, monthlyLimit: 999999, used: 0 },
        linkedin: { enabled: true, monthlyLimit: 500, used: 0 },
        sms: { enabled: true, monthlyLimit: 1000, used: 0 },
      },
    },
    abTesting: {
      enabled: true,
      maxConcurrentTests: 999999,
      currentTests: 0,
    },
    advanced: {
      customAIModel: true,
      dedicatedSupport: true,
      whiteGloveOnboarding: true,
      customIntegrations: true,
      apiAccess: true,
    },
  },
  
  custom: {
    // Custom plans are configured per-customer
    // These are just defaults
    aiEmailWriter: {
      enabled: true,
      monthlyLimit: 1000,
      used: 0,
      resetDate: new Date().toISOString(),
    },
    emailSequences: {
      enabled: true,
      maxActiveSequences: 10,
      maxProspectsPerSequence: 5000,
      currentSequences: 0,
      currentProspects: 0,
    },
    emailReplyHandler: {
      enabled: true,
      autonomousMode: true,
      confidenceThreshold: 85,
      requireApproval: false,
    },
    meetingScheduler: {
      enabled: true,
      automated: true,
      smartRouting: true,
      maxMeetingsPerMonth: 999999,
      meetingsBookedThisMonth: 0,
    },
    prospectFinder: {
      enabled: true,
      monthlyLimit: 500,
      used: 0,
      resetDate: new Date().toISOString(),
      enabledSources: ['apollo', 'linkedin', 'clearbit'],
    },
    multiChannel: {
      enabled: true,
      channels: {
        email: { enabled: true, monthlyLimit: 10000, used: 0 },
        linkedin: { enabled: true, monthlyLimit: 300, used: 0 },
        sms: { enabled: true, monthlyLimit: 500, used: 0 },
      },
    },
    abTesting: {
      enabled: true,
      maxConcurrentTests: 10,
      currentTests: 0,
    },
    advanced: {
      customAIModel: true,
      dedicatedSupport: true,
      whiteGloveOnboarding: true,
      customIntegrations: true,
      apiAccess: true,
    },
  },
};

// NEW: Volume-Based Tier Pricing (primary pricing structure)
export const TIER_PRICING: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
  tier1: {
    monthly: 400,
    yearly: 4000, // ~17% discount (10 months pricing)
  },
  tier2: {
    monthly: 650,
    yearly: 6500, // ~17% discount
  },
  tier3: {
    monthly: 1000,
    yearly: 10000, // ~17% discount
  },
  tier4: {
    monthly: 1250,
    yearly: 12500, // ~17% discount
  },
};

// DEPRECATED: Legacy plan pricing (kept for backward compatibility)
export const PLAN_PRICING: Record<SubscriptionPlan, { monthly: number; yearly: number }> = {
  starter: {
    monthly: 99,
    yearly: 990, // 2 months free
  },
  professional: {
    monthly: 299,
    yearly: 2990,
  },
  enterprise: {
    monthly: 999,
    yearly: 9990,
  },
  custom: {
    monthly: 0, // Negotiated
    yearly: 0,
  },
};

// Revenue metrics for admin dashboard
export interface RevenueMetrics {
  // Date range
  startDate?: string;
  endDate?: string;
  generatedAt?: string;
  
  // Monthly Recurring Revenue
  mrr: number;
  mrrGrowth: number; // % change from last month
  mrrByPlan?: Record<SubscriptionPlan, number>;
  revenueByPlan: Array<{ 
    planId: string;
    planName: string;
    mrr: number;
    percentage: number;
    customers: number;
  }>; // Array format for rendering
  
  // Annual Recurring Revenue
  arr: number;
  arrGrowth: number;
  
  // Customer metrics
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  churnRate: number; // %
  revenueChurnRate: number; // % of revenue lost
  
  // Revenue metrics
  averageRevenuePerUser?: number;
  averageRevenuePerCustomer?: number;
  lifetimeValue?: number;
  customerLifetimeValue?: number;
  totalRevenue: number;
  
  // Trial metrics
  trialsActive?: number;
  trialConversionRate?: number; // %
  
  // Plan distribution
  customersByPlan?: Record<SubscriptionPlan, number>;
  
  // Add-ons
  addOnRevenue?: number;
  topAddOns?: Array<{ name: string; revenue: number; customers: number }>;
  
  // Time period
  periodStart?: string;
  periodEnd?: string;
}

// Available add-ons
export const AVAILABLE_ADDONS: Record<string, Omit<SubscriptionAddOn, 'id' | 'enabled' | 'addedAt'>> = {
  'basic-outbound': {
    name: 'Basic Outbound',
    description: 'Unlock AI email writer and basic sequences for Starter plan',
    price: 49,
    features: [
      '50 AI-generated emails per month',
      '1 active sequence',
      '100 prospects per sequence',
    ],
  },
  'advanced-outbound': {
    name: 'Advanced Outbound',
    description: 'Add prospect finder and multi-channel for Professional plan',
    price: 199,
    features: [
      '100 prospects found per month',
      'LinkedIn automation (100 actions/month)',
      'SMS sequences (100 messages/month)',
    ],
  },
  'extra-emails': {
    name: 'Extra Emails',
    description: 'One-time top-up of email credits',
    price: 49,
    features: [
      '+100 AI-generated emails',
      'Valid for current month only',
    ],
  },
  'extra-prospects': {
    name: 'Extra Prospects',
    description: 'One-time top-up of prospect credits',
    price: 99,
    features: [
      '+100 enriched prospects',
      'Valid for current month only',
    ],
  },
};

/**
 * Plan Details (for admin management)
 */
export interface PlanDetails {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency?: string;
  displayOrder: number;
  features: string[];
  limits: Partial<OutboundFeatures> | Record<string, any>;
  isPopular?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Customer Subscription (for admin dashboard)
 */
export interface CustomerSubscription {
  id: string;
  organizationId: string;
  organizationName?: string;
  planId: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused';
  billingCycle?: BillingCycle;
  amount?: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt?: string;
  canceledAt?: string;
  trialEnd?: string;
  mrr: number; // Monthly Recurring Revenue
  createdAt: string;
  metadata?: Record<string, any>;
}

/**
 * Admin Usage Stats (simplified for admin dashboard)
 */
export interface AdminUsageStats {
  agents: number;
  conversations: number;
  crmRecords: number;
  users: number;
}

/**
 * Admin Customer (for admin dashboard)
 */
export interface AdminCustomer {
  id: string;
  organizationId: string;
  companyName: string;
  industry?: string;
  website?: string;
  primaryContact: {
    name: string;
    email: string;
    phone?: string;
  };
  subscription: CustomerSubscription | OrganizationSubscription;
  usage: AdminUsageStats;
  healthScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  lastActive: string;
  openTickets: number;
  totalTickets: number;
  createdAt: string;
  trialStartedAt?: string;
  convertedAt?: string;
}

/**
 * Helper Functions for Volume-Based Tier System
 */

/**
 * Determine the appropriate tier based on record count
 */
export function getTierForRecordCount(recordCount: number): SubscriptionTier {
  if (recordCount <= VOLUME_TIERS.tier1.recordMax) return 'tier1';
  if (recordCount <= VOLUME_TIERS.tier2.recordMax) return 'tier2';
  if (recordCount <= VOLUME_TIERS.tier3.recordMax) return 'tier3';
  return 'tier4';
}

/**
 * Get tier details by tier ID
 */
export function getTierDetails(tier: SubscriptionTier) {
  return VOLUME_TIERS[tier];
}

/**
 * Get pricing for a tier
 */
export function getTierPricing(tier: SubscriptionTier, cycle: BillingCycle = 'monthly') {
  return cycle === 'monthly' 
    ? TIER_PRICING[tier].monthly 
    : TIER_PRICING[tier].yearly;
}

/**
 * Check if record count is within tier capacity
 */
export function isWithinTierCapacity(recordCount: number, tier: SubscriptionTier): boolean {
  const tierDetails = VOLUME_TIERS[tier];
  return recordCount <= tierDetails.recordMax;
}

/**
 * Calculate required tier for given record count
 */
export function calculateRequiredTier(currentCount: number, additionalRecords: number): {
  tier: SubscriptionTier;
  totalRecords: number;
  price: number;
  needsUpgrade: boolean;
  currentTier: SubscriptionTier;
} {
  const totalRecords = currentCount + additionalRecords;
  const requiredTier = getTierForRecordCount(totalRecords);
  const currentTier = getTierForRecordCount(currentCount);
  
  return {
    tier: requiredTier,
    totalRecords,
    price: TIER_PRICING[requiredTier].monthly,
    needsUpgrade: requiredTier !== currentTier,
    currentTier,
  };
}

/**
 * Get all tiers for pricing page display
 */
export function getAllTiers() {
  return Object.entries(VOLUME_TIERS).map(([key, value]) => ({
    ...value,
    tier: key as SubscriptionTier,
    monthlyPrice: TIER_PRICING[key as SubscriptionTier].monthly,
    yearlyPrice: TIER_PRICING[key as SubscriptionTier].yearly,
    features: ALL_INCLUSIVE_FEATURES,
  }));
}
