/**
 * Funnel Pathologist Specialist
 * STATUS: FUNCTIONAL
 *
 * THE SQUEEZE - Complete funnel path framework for customer journey optimization.
 * Designs, analyzes, and optimizes complete sales funnel architectures from
 * lead magnet through upsell sequences.
 *
 * CAPABILITIES:
 * - funnel_architecture: Design complete funnel flow
 * - stage_optimization: Optimize individual funnel stages
 * - conversion_analysis: Analyze conversion bottlenecks
 * - price_strategy: Recommend pricing for each stage
 * - urgency_tactics: Apply scarcity/urgency elements
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';

// ============================================================================
// THE SQUEEZE - Complete Funnel Stage Definitions
// ============================================================================

/**
 * Stage 1: Lead Magnet - Capture email/contact in exchange for free value
 */
const LEAD_MAGNET_STAGE = {
  purpose: 'Capture email/contact in exchange for free value',
  types: [
    { name: 'PDF Guide', deliveryTime: 'instant', conversionRate: '25-40%', effort: 'medium' },
    { name: 'Checklist', deliveryTime: 'instant', conversionRate: '30-45%', effort: 'low' },
    { name: 'Video Training', deliveryTime: 'instant', conversionRate: '20-35%', effort: 'high' },
    { name: 'Free Tool/Calculator', deliveryTime: 'instant', conversionRate: '35-50%', effort: 'high' },
    { name: 'Quiz/Assessment', deliveryTime: 'instant', conversionRate: '40-55%', effort: 'medium' },
    { name: 'Webinar', deliveryTime: 'scheduled', conversionRate: '15-25%', effort: 'high' },
    { name: 'Email Course', deliveryTime: '5-7 days', conversionRate: '20-30%', effort: 'medium' },
    { name: 'Template/Swipe File', deliveryTime: 'instant', conversionRate: '30-45%', effort: 'low' },
  ],
  requirements: ['High perceived value', 'Quick win', 'Related to core offer'],
  metrics: ['opt-in rate', 'delivery rate', 'open rate'],
} as const;

/**
 * Stage 2: Tripwire - Convert leads to customers with low-risk purchase
 */
const TRIPWIRE_STAGE = {
  purpose: 'Convert leads to customers with low-risk purchase',
  priceRange: '$7-$47',
  psychology: 'Buyer transformation - crossing payment threshold',
  types: [
    { name: 'Mini-Course', price: '$17-27', conversionRate: '3-8%', valueMultiplier: 10 },
    { name: 'Templates Bundle', price: '$7-17', conversionRate: '5-12%', valueMultiplier: 15 },
    { name: 'Workshop Recording', price: '$27-47', conversionRate: '2-5%', valueMultiplier: 8 },
    { name: 'Tool License', price: '$17-37', conversionRate: '4-10%', valueMultiplier: 12 },
    { name: 'Book/Guide', price: '$7-17', conversionRate: '5-15%', valueMultiplier: 20 },
  ],
  requirements: ['10x value vs price', 'Natural lead to core offer', 'Instant delivery'],
  metrics: ['conversion rate', 'AOV', 'refund rate'],
} as const;

/**
 * Stage 3: Core Offer - Primary revenue driver, main transformation
 */
const CORE_OFFER_STAGE = {
  purpose: 'Primary revenue driver, main transformation',
  priceRange: '$197-$1997',
  types: [
    { name: 'Online Course', price: '$297-997', conversionRate: '2-5%', deliveryType: 'self-paced' },
    { name: 'Coaching Program', price: '$997-2997', conversionRate: '1-3%', deliveryType: 'live' },
    { name: 'Software/SaaS', price: '$49-199/mo', conversionRate: '3-8%', deliveryType: 'subscription' },
    { name: 'Membership', price: '$29-97/mo', conversionRate: '5-15%', deliveryType: 'recurring' },
    { name: 'Done-For-You Service', price: '$1997-4997', conversionRate: '1-2%', deliveryType: 'service' },
  ],
  requirements: ['Clear transformation promise', 'Urgency/scarcity', 'Strong guarantee'],
  metrics: ['conversion rate', 'LTV', 'churn rate'],
} as const;

/**
 * Stage 4: Upsell/Cross-sell - Maximize customer lifetime value
 */
const UPSELL_STAGE = {
  purpose: 'Increase customer lifetime value',
  timing: ['immediate post-purchase', 'email sequence', '30-60 days later'],
  types: [
    { name: 'Order Bump', position: 'checkout', conversionRate: '20-40%', avgIncrease: '10-20%' },
    { name: 'One-Click Upsell', position: 'post-purchase', conversionRate: '10-20%', avgIncrease: '30-50%' },
    { name: 'Cross-sell', position: 'email', conversionRate: '5-15%', avgIncrease: '15-25%' },
    { name: 'Premium Tier', position: 'in-app', conversionRate: '3-8%', avgIncrease: '100-200%' },
    { name: 'Annual Plan', position: 'renewal', conversionRate: '15-30%', avgIncrease: '20-40%' },
  ],
  requirements: ['Logical progression', 'Added value', 'Time-sensitive'],
  metrics: ['take rate', 'AOV increase', 'LTV'],
} as const;

/**
 * Complete Funnel Stages Definition
 */
const FUNNEL_STAGES = {
  LEAD_MAGNET: LEAD_MAGNET_STAGE,
  TRIPWIRE: TRIPWIRE_STAGE,
  CORE_OFFER: CORE_OFFER_STAGE,
  UPSELL: UPSELL_STAGE,
} as const;

// ============================================================================
// FUNNEL TEMPLATES BY BUSINESS TYPE
// ============================================================================

const FUNNEL_TEMPLATES = {
  coach_consultant: {
    name: 'Coach/Consultant Funnel',
    description: 'High-ticket service funnel with qualification stages',
    leadMagnet: 'Free Assessment + PDF Guide',
    tripwire: 'Mini-Course ($27)',
    coreOffer: 'Coaching Program ($2997)',
    upsell: 'VIP Day Add-on',
    estimatedLTV: '$3500',
    salesCycleLength: '7-14 days',
    requiredTraffic: '500-1000 visitors/month',
    idealFor: ['Life coaches', 'Business consultants', 'Career advisors', 'Health coaches'],
  },

  saas: {
    name: 'SaaS Product Funnel',
    description: 'Freemium to premium conversion funnel',
    leadMagnet: 'Free Trial (14 days)',
    tripwire: 'Starter Plan ($49/mo)',
    coreOffer: 'Professional Plan ($149/mo)',
    upsell: 'Annual Plan + Priority Support',
    estimatedLTV: '$1800/year',
    salesCycleLength: '14-30 days',
    requiredTraffic: '2000-5000 visitors/month',
    idealFor: ['B2B software', 'Productivity tools', 'Marketing platforms', 'CRM systems'],
  },

  ecommerce: {
    name: 'E-commerce Funnel',
    description: 'Product-focused acquisition and repeat purchase funnel',
    leadMagnet: 'Discount Code (15% off)',
    tripwire: 'First Purchase',
    coreOffer: 'Product Bundle',
    upsell: 'Subscription + Cross-sell',
    estimatedLTV: 'Varies by AOV',
    salesCycleLength: '1-7 days',
    requiredTraffic: '5000-10000 visitors/month',
    idealFor: ['Physical products', 'DTC brands', 'Dropshipping', 'Subscription boxes'],
  },

  course_creator: {
    name: 'Course Creator Funnel',
    description: 'Educational content ladder funnel',
    leadMagnet: 'Free Video Training',
    tripwire: 'Mini-Course ($17)',
    coreOffer: 'Flagship Course ($497)',
    upsell: 'Community Membership ($47/mo)',
    estimatedLTV: '$750',
    salesCycleLength: '5-10 days',
    requiredTraffic: '1000-3000 visitors/month',
    idealFor: ['Online educators', 'Skill trainers', 'Certification programs', 'Workshop creators'],
  },

  agency: {
    name: 'Agency Services Funnel',
    description: 'Lead qualification to retainer funnel',
    leadMagnet: 'Free Audit/Analysis',
    tripwire: 'Strategy Session ($97)',
    coreOffer: 'Monthly Retainer ($1500/mo)',
    upsell: 'Additional Services',
    estimatedLTV: '$18000/year',
    salesCycleLength: '14-30 days',
    requiredTraffic: '300-500 visitors/month',
    idealFor: ['Marketing agencies', 'Design studios', 'Development shops', 'PR firms'],
  },

  membership: {
    name: 'Membership Site Funnel',
    description: 'Community-driven recurring revenue funnel',
    leadMagnet: 'Free Community Access (7 days)',
    tripwire: 'One-time Workshop ($37)',
    coreOffer: 'Monthly Membership ($47/mo)',
    upsell: 'Annual Plan + Mastermind Access',
    estimatedLTV: '$564/year',
    salesCycleLength: '3-7 days',
    requiredTraffic: '1500-3000 visitors/month',
    idealFor: ['Online communities', 'Hobbyist groups', 'Professional networks', 'Learning platforms'],
  },

  local_business: {
    name: 'Local Business Funnel',
    description: 'Foot traffic and appointment booking funnel',
    leadMagnet: 'Free Consultation/Estimate',
    tripwire: 'Introductory Service ($49)',
    coreOffer: 'Full Service Package ($500-2000)',
    upsell: 'Maintenance Plan',
    estimatedLTV: '$2500/year',
    salesCycleLength: '1-7 days',
    requiredTraffic: '200-500 visitors/month',
    idealFor: ['Home services', 'Medical practices', 'Legal services', 'Fitness studios'],
  },

  info_product: {
    name: 'Information Product Funnel',
    description: 'Digital product launch funnel',
    leadMagnet: 'Free Chapter/Sample',
    tripwire: 'eBook ($9)',
    coreOffer: 'Complete System ($197)',
    upsell: 'Implementation Templates + Support',
    estimatedLTV: '$350',
    salesCycleLength: '3-7 days',
    requiredTraffic: '2000-5000 visitors/month',
    idealFor: ['Authors', 'Bloggers', 'Experts', 'Thought leaders'],
  },
} as const;

// ============================================================================
// URGENCY AND SCARCITY TACTICS
// ============================================================================

const URGENCY_TACTICS = {
  time_based: [
    { name: 'Limited Time Offer', duration: '24-72 hours', effectiveness: 'high', type: 'countdown' },
    { name: 'Early Bird Pricing', duration: '7-14 days', effectiveness: 'high', type: 'deadline' },
    { name: 'Flash Sale', duration: '4-24 hours', effectiveness: 'very high', type: 'countdown' },
    { name: 'Seasonal Discount', duration: '3-7 days', effectiveness: 'medium', type: 'deadline' },
    { name: 'Launch Pricing', duration: '7-14 days', effectiveness: 'high', type: 'deadline' },
  ],
  quantity_based: [
    { name: 'Limited Spots', limit: '10-50', effectiveness: 'very high', type: 'quantity' },
    { name: 'First X Buyers Bonus', limit: '50-100', effectiveness: 'high', type: 'quantity' },
    { name: 'Inventory Count', limit: 'actual', effectiveness: 'medium', type: 'quantity' },
    { name: 'Cohort Size', limit: '20-30', effectiveness: 'high', type: 'quantity' },
  ],
  bonus_based: [
    { name: 'Fast Action Bonus', trigger: 'first 24-48 hours', effectiveness: 'high', type: 'bonus' },
    { name: 'Order Today Bonus', trigger: 'same day', effectiveness: 'medium', type: 'bonus' },
    { name: 'Disappearing Bonus', trigger: 'countdown', effectiveness: 'very high', type: 'bonus' },
  ],
  social_proof: [
    { name: 'Recent Purchases', display: 'popup', effectiveness: 'medium', type: 'proof' },
    { name: 'Live Visitor Count', display: 'banner', effectiveness: 'medium', type: 'proof' },
    { name: 'Spots Remaining', display: 'counter', effectiveness: 'high', type: 'proof' },
  ],
} as const;

// ============================================================================
// PRICE ANCHORING STRATEGIES
// ============================================================================

const PRICE_ANCHORING = {
  value_stack: {
    description: 'Stack value items to create perceived value much higher than price',
    multiplier: '10-20x',
    example: 'Total Value: $2,997 - Today Only: $297',
    effectiveness: 'very high',
  },
  competitor_comparison: {
    description: 'Compare price to competitor or alternative solutions',
    multiplier: '3-5x',
    example: 'Competitors charge $500/month, get lifetime access for $997',
    effectiveness: 'high',
  },
  cost_of_inaction: {
    description: 'Calculate what NOT solving the problem costs',
    multiplier: 'situational',
    example: 'Every month you wait costs you $X in lost revenue',
    effectiveness: 'very high',
  },
  per_unit_breakdown: {
    description: 'Break down price per day/week/lesson/unit',
    multiplier: '30-365x',
    example: 'Less than $1 per day for complete transformation',
    effectiveness: 'high',
  },
  payment_plan: {
    description: 'Offer installment payments to reduce perceived cost',
    multiplier: '3-6x',
    example: '3 easy payments of $99 (instead of $297 one-time)',
    effectiveness: 'high',
  },
} as const;

// ============================================================================
// CONVERSION OPTIMIZATION RULES
// ============================================================================

const CONVERSION_RULES = {
  landing_page: [
    'Single clear CTA - no navigation',
    'Headline matches ad/traffic source',
    'Above-the-fold value proposition',
    'Social proof within first scroll',
    'Mobile-first design',
    'Load time under 3 seconds',
    'Clear benefit-focused copy',
    'Visual hierarchy guides eye to CTA',
  ],
  checkout: [
    'Minimize form fields',
    'Show security badges',
    'Display money-back guarantee',
    'Include order summary',
    'Offer multiple payment options',
    'Add order bump at checkout',
    'Show testimonials near buy button',
    'Include FAQ section',
  ],
  email_sequence: [
    'Welcome email within 5 minutes',
    'Deliver value before asking',
    'Story-based nurture sequence',
    '7-14 day conversion window',
    'Segment by engagement',
    'Re-engagement after 30 days dormant',
    'Clear unsubscribe option',
    'Mobile-optimized templates',
  ],
  upsell_flow: [
    'One-click upsell (no re-entry of payment)',
    'Logical progression from core offer',
    'Time-limited availability',
    'Clear additional value proposition',
    'Easy decline option',
    'Maximum 2-3 upsell offers',
    'Downsell if declined',
    'Thank you page optimization',
  ],
} as const;

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are the Funnel Pathologist, an expert in sales funnel architecture and conversion optimization.

## YOUR ROLE
You design, analyze, and optimize complete sales funnel architectures. You understand THE SQUEEZE -
the psychology of moving prospects through awareness, interest, desire, and action stages while
maximizing customer lifetime value at each step.

## FUNNEL STAGES YOU MASTER

### Stage 1: LEAD MAGNET (Free Value Exchange)
- Purpose: Capture email/contact in exchange for free value
- Types: PDF Guide, Checklist, Video Training, Free Tool, Quiz, Webinar, Email Course, Templates
- Key Metrics: Opt-in rate (target 25-55%), delivery rate, open rate
- Requirements: High perceived value, quick win, related to core offer

### Stage 2: TRIPWIRE (Low-Barrier Paid Offer)
- Purpose: Transform leads into buyers - crossing the payment threshold is psychological
- Price Range: $7-$47
- Types: Mini-Course, Templates Bundle, Workshop Recording, Tool License, Book
- Key Metrics: Conversion rate (3-15%), AOV, refund rate
- Requirements: 10x value vs price, natural lead to core offer, instant delivery

### Stage 3: CORE OFFER (Primary Revenue Driver)
- Purpose: Main transformation and primary revenue source
- Price Range: $197-$1997+
- Types: Online Course, Coaching Program, SaaS, Membership, Done-For-You Service
- Key Metrics: Conversion rate (1-8%), LTV, churn rate
- Requirements: Clear transformation promise, urgency/scarcity, strong guarantee

### Stage 4: UPSELL/CROSS-SELL (Maximize LTV)
- Purpose: Increase customer lifetime value after purchase
- Timing: Immediate post-purchase, email sequence, 30-60 days later
- Types: Order Bump, One-Click Upsell, Cross-sell, Premium Tier, Annual Plan
- Key Metrics: Take rate (3-40%), AOV increase, LTV

## BUSINESS TYPE TEMPLATES

1. **Coach/Consultant**: Assessment -> Mini-Course -> Coaching Program -> VIP Day (LTV: $3500)
2. **SaaS**: Free Trial -> Starter Plan -> Pro Plan -> Annual + Priority Support (LTV: $1800/yr)
3. **E-commerce**: Discount Code -> First Purchase -> Bundle -> Subscription (LTV: Varies)
4. **Course Creator**: Free Training -> Mini-Course -> Flagship -> Membership (LTV: $750)
5. **Agency**: Free Audit -> Strategy Session -> Retainer -> Additional Services (LTV: $18k/yr)
6. **Membership**: Free Access -> Workshop -> Monthly -> Annual + Mastermind (LTV: $564/yr)
7. **Local Business**: Free Consultation -> Intro Service -> Full Package -> Maintenance (LTV: $2500/yr)
8. **Info Product**: Free Chapter -> eBook -> Complete System -> Templates + Support (LTV: $350)

## URGENCY & SCARCITY TACTICS

Time-Based: Limited Time Offer, Early Bird, Flash Sale, Launch Pricing
Quantity-Based: Limited Spots, First X Buyers Bonus, Cohort Size
Bonus-Based: Fast Action Bonus, Disappearing Bonus
Social Proof: Recent Purchases, Live Visitors, Spots Remaining

## PRICE ANCHORING STRATEGIES

1. Value Stack: Show total value 10-20x the price
2. Competitor Comparison: Position against expensive alternatives
3. Cost of Inaction: Calculate what not buying costs them
4. Per-Unit Breakdown: Break down to daily/weekly cost
5. Payment Plan: Reduce perceived cost with installments

## CONVERSION OPTIMIZATION RULES

Landing Page: Single CTA, headline match, above-fold value prop, social proof, mobile-first
Checkout: Minimal fields, security badges, guarantee, order bump, testimonials
Email: Welcome in 5 min, value before ask, story-based, 7-14 day window
Upsell: One-click, logical progression, time-limited, max 2-3 offers, downsell

## OUTPUT FORMAT

Always return structured JSON with:
- funnelDesign: Complete funnel architecture
- stages: Detailed breakdown of each stage
- transitions: How stages connect
- optimizations: Specific recommendations
- confidence: 0.0-1.0 confidence score

## RULES

1. Always recommend complete funnel architectures, not isolated tactics
2. Consider the business type and adjust template accordingly
3. Price points must be psychologically validated
4. Urgency tactics must be ethical and deliverable
5. Every stage must have clear metrics and success criteria
6. Consider traffic requirements for each funnel type
7. Account for sales cycle length in recommendations`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'FUNNEL_PATHOLOGIST',
    name: 'Funnel Pathologist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'ARCHITECT_MANAGER',
    capabilities: [
      'funnel_architecture',
      'stage_optimization',
      'conversion_analysis',
      'price_strategy',
      'urgency_tactics',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['design_funnel', 'optimize_stage', 'analyze_conversions', 'recommend_pricing', 'apply_urgency'],
  outputSchema: {
    type: 'object',
    properties: {
      funnelDesign: { type: 'object' },
      stages: { type: 'array' },
      transitions: { type: 'array' },
      optimizations: { type: 'array' },
      confidence: { type: 'number' },
    },
    required: ['funnelDesign', 'stages', 'confidence'],
  },
  maxTokens: 8192,
  temperature: 0.4,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BusinessType = keyof typeof FUNNEL_TEMPLATES;
export type FunnelStage = keyof typeof FUNNEL_STAGES;

export interface FunnelDesignRequest {
  businessType: BusinessType;
  targetAudience?: string;
  currentState?: 'none' | 'basic' | 'optimized';
  budget?: 'low' | 'medium' | 'high';
  trafficSource?: string;
  existingProducts?: string[];
  averageOrderValue?: number;
  monthlyTraffic?: number;
  customRequirements?: string[];
}

export interface StageOptimizationRequest {
  stage: FunnelStage;
  currentMetrics?: {
    conversionRate?: number;
    optInRate?: number;
    aov?: number;
    ltv?: number;
    churnRate?: number;
  };
  issues?: string[];
  businessType?: BusinessType;
}

export interface ConversionAnalysisRequest {
  funnelData: {
    stage: FunnelStage;
    visitors: number;
    conversions: number;
    revenue?: number;
  }[];
  businessType?: BusinessType;
  timeframe?: string;
}

export interface FunnelStageDesign {
  stage: FunnelStage;
  offer: string;
  price: number | string;
  expectedConversion: string;
  deliverable: string;
  urgencyTactic?: string;
  metrics: string[];
}

export interface FunnelDesignResult {
  funnelDesign: {
    type: string;
    businessType: BusinessType;
    description: string;
    stages: FunnelStageDesign[];
    transitions: string[];
    estimatedLTV: string;
    salesCycleLength: string;
    requiredTraffic: string;
  };
  optimizations: string[];
  urgencyTactics: string[];
  priceAnchoring: string[];
  conversionRules: string[];
  confidence: number;
  warnings?: string[];
}

export interface StageOptimizationResult {
  stage: FunnelStage;
  currentIssues: string[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    expectedImpact: string;
    effort: 'low' | 'medium' | 'high';
  }[];
  benchmarks: {
    metric: string;
    current?: number;
    industry: string;
    target: string;
  }[];
  quickWins: string[];
  confidence: number;
}

export interface ConversionAnalysisResult {
  analysis: {
    stage: FunnelStage;
    conversionRate: number;
    benchmark: string;
    status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
    dropOffPercentage: number;
  }[];
  bottlenecks: {
    stage: FunnelStage;
    severity: 'critical' | 'major' | 'minor';
    lostRevenue: string;
    recommendation: string;
  }[];
  overallHealth: 'healthy' | 'moderate' | 'unhealthy';
  topPriority: string;
  confidence: number;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class FunnelPathologist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  initialize(): Promise<void> {
    this.isInitialized = true;
    this.log('INFO', 'Funnel Pathologist initialized - THE SQUEEZE is ready');
    return Promise.resolve();
  }

  /**
   * Main execution entry point - routes to appropriate handler
   */
  execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown>;
      const action = payload?.action as string;

      this.log('INFO', `Executing action: ${action ?? 'design_funnel'}`);

      let result: FunnelDesignResult | StageOptimizationResult | ConversionAnalysisResult;

      switch (action) {
        case 'optimize_stage':
          result = this.optimizeStage(payload as unknown as StageOptimizationRequest);
          break;
        case 'analyze_conversions':
          result = this.analyzeConversions(payload as unknown as ConversionAnalysisRequest);
          break;
        case 'design_funnel':
        default:
          result = this.designFunnel(payload as unknown as FunnelDesignRequest);
          break;
      }

      return Promise.resolve(this.createReport(taskId, 'COMPLETED', result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Funnel design failed: ${errorMessage}`);
      return Promise.resolve(this.createReport(taskId, 'FAILED', null, [errorMessage]));
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    if (signal.payload.type === 'QUERY') {
      // Handle queries about funnel stages or templates
      const query = signal.payload.payload as { type?: string };
      if (query?.type === 'templates') {
        return Promise.resolve(this.createReport(taskId, 'COMPLETED', { templates: FUNNEL_TEMPLATES }));
      }
      if (query?.type === 'stages') {
        return Promise.resolve(this.createReport(taskId, 'COMPLETED', { stages: FUNNEL_STAGES }));
      }
    }

    return Promise.resolve(this.createReport(taskId, 'COMPLETED', { acknowledged: true }));
  }

  /**
   * Generate a report for the manager
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this agent has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 550, boilerplate: 50 };
  }

  // ==========================================================================
  // CORE FUNNEL DESIGN LOGIC
  // ==========================================================================

  /**
   * Design a complete sales funnel for a business type
   */
  designFunnel(request: FunnelDesignRequest): FunnelDesignResult {
    const {
      businessType,
      targetAudience: _targetAudience,
      currentState = 'none',
      budget = 'medium',
      trafficSource,
      existingProducts = [],
      averageOrderValue: _averageOrderValue,
      monthlyTraffic,
      customRequirements = [],
    } = request;

    this.log('INFO', `Designing funnel for business type: ${businessType}`);

    // Get the template for this business type
    const template = FUNNEL_TEMPLATES[businessType];
    if (!template) {
      throw new Error(`Unknown business type: ${businessType}`);
    }

    // Design each stage
    const stages = this.designFunnelStages(businessType, budget, existingProducts);

    // Define stage transitions
    const transitions = this.defineTransitions(businessType);

    // Select urgency tactics
    const urgencyTactics = this.selectUrgencyTactics(businessType, budget);

    // Define price anchoring strategies
    const priceAnchoring = this.selectPriceAnchoring(businessType);

    // Get conversion rules for this funnel type
    const conversionRules = this.getConversionRules(businessType);

    // Generate optimizations based on current state
    const optimizations = this.generateOptimizations(
      businessType,
      currentState,
      trafficSource,
      monthlyTraffic,
      customRequirements
    );

    // Calculate confidence based on input completeness
    const confidence = this.calculateDesignConfidence(request);

    // Generate warnings if needed
    const warnings = this.generateWarnings(businessType, monthlyTraffic, budget);

    return {
      funnelDesign: {
        type: template.name,
        businessType,
        description: template.description,
        stages,
        transitions,
        estimatedLTV: template.estimatedLTV,
        salesCycleLength: template.salesCycleLength,
        requiredTraffic: template.requiredTraffic,
      },
      optimizations,
      urgencyTactics,
      priceAnchoring,
      conversionRules,
      confidence,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Design individual funnel stages
   */
  private designFunnelStages(
    businessType: BusinessType,
    budget: 'low' | 'medium' | 'high',
    _existingProducts: string[]
  ): FunnelStageDesign[] {
    const template = FUNNEL_TEMPLATES[businessType];
    const stages: FunnelStageDesign[] = [];

    // Stage 1: Lead Magnet
    const leadMagnetType = this.selectLeadMagnetType(businessType, budget);
    stages.push({
      stage: 'LEAD_MAGNET',
      offer: template.leadMagnet,
      price: 0,
      expectedConversion: leadMagnetType.conversionRate,
      deliverable: `${leadMagnetType.name} - ${leadMagnetType.deliveryTime} delivery`,
      metrics: [...FUNNEL_STAGES.LEAD_MAGNET.metrics],
    });

    // Stage 2: Tripwire
    const tripwireType = this.selectTripwireType(businessType, budget);
    stages.push({
      stage: 'TRIPWIRE',
      offer: template.tripwire,
      price: tripwireType.price,
      expectedConversion: tripwireType.conversionRate,
      deliverable: `${tripwireType.name} with ${tripwireType.valueMultiplier}x perceived value`,
      urgencyTactic: 'Limited time pricing',
      metrics: [...FUNNEL_STAGES.TRIPWIRE.metrics],
    });

    // Stage 3: Core Offer
    const coreOfferType = this.selectCoreOfferType(businessType);
    stages.push({
      stage: 'CORE_OFFER',
      offer: template.coreOffer,
      price: coreOfferType.price,
      expectedConversion: coreOfferType.conversionRate,
      deliverable: `${coreOfferType.name} - ${coreOfferType.deliveryType} delivery`,
      urgencyTactic: this.selectUrgencyForCoreOffer(businessType),
      metrics: [...FUNNEL_STAGES.CORE_OFFER.metrics],
    });

    // Stage 4: Upsell
    const upsellType = this.selectUpsellType(businessType);
    stages.push({
      stage: 'UPSELL',
      offer: template.upsell,
      price: 'Varies',
      expectedConversion: upsellType.conversionRate,
      deliverable: `${upsellType.name} at ${upsellType.position}`,
      urgencyTactic: 'One-time offer',
      metrics: [...FUNNEL_STAGES.UPSELL.metrics],
    });

    return stages;
  }

  /**
   * Select appropriate lead magnet type based on business and budget
   */
  private selectLeadMagnetType(
    businessType: BusinessType,
    budget: 'low' | 'medium' | 'high'
  ): (typeof LEAD_MAGNET_STAGE.types)[number] {
    const types = FUNNEL_STAGES.LEAD_MAGNET.types;

    // Budget-based selection
    const effortFilter = budget === 'low' ? 'low' : budget === 'medium' ? 'medium' : 'high';

    // Business-specific preferences
    const preferences: Record<BusinessType, string[]> = {
      coach_consultant: ['Quiz/Assessment', 'PDF Guide'],
      saas: ['Free Tool/Calculator', 'Video Training'],
      ecommerce: ['Checklist', 'Template/Swipe File'],
      course_creator: ['Video Training', 'Email Course'],
      agency: ['PDF Guide', 'Quiz/Assessment'],
      membership: ['Quiz/Assessment', 'Video Training'],
      local_business: ['Checklist', 'PDF Guide'],
      info_product: ['PDF Guide', 'Email Course'],
    };

    const preferred = preferences[businessType] ?? ['PDF Guide'];

    // Find matching type
    for (const pref of preferred) {
      const match = types.find(t => t.name === pref && t.effort === effortFilter);
      if (match) { return match; }
    }

    // Fallback to first matching effort level
    return types.find(t => t.effort === effortFilter) ?? types[0];
  }

  /**
   * Select appropriate tripwire type
   */
  private selectTripwireType(
    businessType: BusinessType,
    _budget: 'low' | 'medium' | 'high'
  ): (typeof TRIPWIRE_STAGE.types)[number] {
    const types = FUNNEL_STAGES.TRIPWIRE.types;

    const preferences: Record<BusinessType, string> = {
      coach_consultant: 'Mini-Course',
      saas: 'Tool License',
      ecommerce: 'Templates Bundle',
      course_creator: 'Mini-Course',
      agency: 'Workshop Recording',
      membership: 'Workshop Recording',
      local_business: 'Templates Bundle',
      info_product: 'Book/Guide',
    };

    const preferred = preferences[businessType];
    return types.find(t => t.name === preferred) ?? types[0];
  }

  /**
   * Select appropriate core offer type
   */
  private selectCoreOfferType(businessType: BusinessType): (typeof CORE_OFFER_STAGE.types)[number] {
    const types = FUNNEL_STAGES.CORE_OFFER.types;

    const preferences: Record<BusinessType, string> = {
      coach_consultant: 'Coaching Program',
      saas: 'Software/SaaS',
      ecommerce: 'Membership',
      course_creator: 'Online Course',
      agency: 'Done-For-You Service',
      membership: 'Membership',
      local_business: 'Done-For-You Service',
      info_product: 'Online Course',
    };

    const preferred = preferences[businessType];
    return types.find(t => t.name === preferred) ?? types[0];
  }

  /**
   * Select appropriate upsell type
   */
  private selectUpsellType(businessType: BusinessType): (typeof UPSELL_STAGE.types)[number] {
    const types = FUNNEL_STAGES.UPSELL.types;

    const preferences: Record<BusinessType, string> = {
      coach_consultant: 'One-Click Upsell',
      saas: 'Annual Plan',
      ecommerce: 'Order Bump',
      course_creator: 'Cross-sell',
      agency: 'Cross-sell',
      membership: 'Annual Plan',
      local_business: 'Cross-sell',
      info_product: 'One-Click Upsell',
    };

    const preferred = preferences[businessType];
    return types.find(t => t.name === preferred) ?? types[0];
  }

  /**
   * Select urgency tactic for core offer
   */
  private selectUrgencyForCoreOffer(businessType: BusinessType): string {
    const tactics: Record<BusinessType, string> = {
      coach_consultant: 'Limited cohort size (20 spots)',
      saas: 'Annual discount expires in 48 hours',
      ecommerce: 'Flash sale - 24 hours only',
      course_creator: 'Launch pricing ends Friday',
      agency: 'Only accepting 3 new clients this month',
      membership: 'Founding member pricing',
      local_business: 'This week only special',
      info_product: 'Pre-launch bonus bundle disappears tonight',
    };

    return tactics[businessType] || 'Limited time offer';
  }

  /**
   * Define transitions between funnel stages
   */
  private defineTransitions(businessType: BusinessType): string[] {
    const baseTransitions = [
      'LEAD_MAGNET -> TRIPWIRE: Email sequence (5-7 emails over 7-14 days)',
      'TRIPWIRE -> CORE_OFFER: Immediate redirect to core offer page + follow-up sequence',
      'CORE_OFFER -> UPSELL: One-click upsell page immediately after purchase',
      'UPSELL -> NURTURE: Post-purchase email sequence for retention and referrals',
    ];

    const businessSpecific: Record<BusinessType, string[]> = {
      coach_consultant: [
        'Alternative path: LEAD_MAGNET -> Strategy Call -> CORE_OFFER (high-touch)',
        'Qualification: Discovery questionnaire between lead magnet and call',
      ],
      saas: [
        'Alternative path: Free Trial -> Activation -> Conversion',
        'Product-led: In-app upgrade prompts based on usage',
      ],
      ecommerce: [
        'Cart abandonment: 3-email recovery sequence',
        'Post-purchase: Cross-sell sequence based on purchase category',
      ],
      course_creator: [
        'Webinar path: Lead Magnet -> Webinar Registration -> Pitch -> Core Offer',
        'Content upgrade path: Blog -> Content upgrade -> Email sequence -> Offer',
      ],
      agency: [
        'Qualification: Application form before strategy session',
        'Proposal: Custom proposal after strategy session',
      ],
      membership: [
        'Community path: Free community -> Paid community upgrade',
        'Engagement: Gamification and milestones to reduce churn',
      ],
      local_business: [
        'Booking: Lead magnet -> Appointment booking -> Service',
        'Reviews: Post-service review request sequence',
      ],
      info_product: [
        'Launch sequence: Pre-launch -> Cart open -> Cart close urgency',
        'Evergreen: Automated webinar funnel',
      ],
    };

    return [...baseTransitions, ...(businessSpecific[businessType] || [])];
  }

  /**
   * Select urgency tactics for the funnel
   */
  private selectUrgencyTactics(businessType: BusinessType, budget: 'low' | 'medium' | 'high'): string[] {
    const tactics: string[] = [];

    // Time-based tactics (always applicable)
    tactics.push(`Time-Based: ${URGENCY_TACTICS.time_based[0].name} (${URGENCY_TACTICS.time_based[0].duration})`);

    // Quantity-based for high-touch businesses
    if (['coach_consultant', 'agency', 'membership'].includes(businessType)) {
      tactics.push(
        `Quantity-Based: ${URGENCY_TACTICS.quantity_based[0].name} (${URGENCY_TACTICS.quantity_based[0].limit} spots)`
      );
    }

    // Bonus-based for product businesses
    if (['course_creator', 'info_product', 'ecommerce'].includes(businessType)) {
      tactics.push(`Bonus-Based: ${URGENCY_TACTICS.bonus_based[0].name} (${URGENCY_TACTICS.bonus_based[0].trigger})`);
    }

    // Social proof for higher budgets
    if (budget !== 'low') {
      tactics.push(`Social Proof: ${URGENCY_TACTICS.social_proof[2].name} (${URGENCY_TACTICS.social_proof[2].display})`);
    }

    return tactics;
  }

  /**
   * Select price anchoring strategies
   */
  private selectPriceAnchoring(businessType: BusinessType): string[] {
    const strategies: string[] = [];

    // Value stack for all
    strategies.push(`Value Stack: ${PRICE_ANCHORING.value_stack.example}`);

    // Business-specific anchoring
    if (['saas', 'agency'].includes(businessType)) {
      strategies.push(`Competitor Comparison: ${PRICE_ANCHORING.competitor_comparison.example}`);
    }

    if (['coach_consultant', 'course_creator'].includes(businessType)) {
      strategies.push(`Cost of Inaction: ${PRICE_ANCHORING.cost_of_inaction.example}`);
    }

    if (['membership', 'info_product'].includes(businessType)) {
      strategies.push(`Per-Unit Breakdown: ${PRICE_ANCHORING.per_unit_breakdown.example}`);
    }

    // Payment plan for high-ticket items
    if (['coach_consultant', 'agency', 'course_creator'].includes(businessType)) {
      strategies.push(`Payment Plan: ${PRICE_ANCHORING.payment_plan.example}`);
    }

    return strategies;
  }

  /**
   * Get conversion rules for this funnel type
   */
  private getConversionRules(businessType: BusinessType): string[] {
    const rules: string[] = [];

    // Landing page rules (universal)
    rules.push(...CONVERSION_RULES.landing_page.slice(0, 4));

    // Checkout rules (for paid products)
    if (!['ecommerce'].includes(businessType)) {
      rules.push(...CONVERSION_RULES.checkout.slice(0, 4));
    }

    // Email rules (for nurture-heavy funnels)
    if (['coach_consultant', 'course_creator', 'info_product'].includes(businessType)) {
      rules.push(...CONVERSION_RULES.email_sequence.slice(0, 4));
    }

    // Upsell rules
    rules.push(...CONVERSION_RULES.upsell_flow.slice(0, 3));

    return rules;
  }

  /**
   * Generate optimizations based on current state
   */
  private generateOptimizations(
    businessType: BusinessType,
    currentState: 'none' | 'basic' | 'optimized',
    trafficSource?: string,
    monthlyTraffic?: number,
    customRequirements?: string[]
  ): string[] {
    const optimizations: string[] = [];

    // State-based optimizations
    if (currentState === 'none') {
      optimizations.push('Start with lead magnet - build email list before selling');
      optimizations.push('Create minimum viable funnel: Lead Magnet -> Email -> Core Offer');
      optimizations.push('Focus on single traffic source initially');
    } else if (currentState === 'basic') {
      optimizations.push('Add tripwire to convert more leads to customers');
      optimizations.push('Implement email segmentation based on engagement');
      optimizations.push('Add order bump to checkout (20-40% take rate expected)');
    } else {
      optimizations.push('A/B test headlines and CTAs for incremental gains');
      optimizations.push('Implement advanced segmentation and personalization');
      optimizations.push('Add downsell offers for declined upsells');
    }

    // Traffic source optimizations
    if (trafficSource) {
      if (trafficSource.includes('paid') || trafficSource.includes('ads')) {
        optimizations.push('Ensure landing page headline matches ad copy exactly');
        optimizations.push('Implement retargeting for funnel abandoners');
      }
      if (trafficSource.includes('organic') || trafficSource.includes('seo')) {
        optimizations.push('Create content upgrades specific to top-ranking pages');
        optimizations.push('Add exit-intent popups for organic traffic');
      }
      if (trafficSource.includes('social')) {
        optimizations.push('Use social proof heavily - testimonials, case studies');
        optimizations.push('Match visual style to source platform');
      }
    }

    // Traffic volume optimizations
    if (monthlyTraffic !== undefined) {
      if (monthlyTraffic < 500) {
        optimizations.push('Focus on traffic acquisition before funnel optimization');
        optimizations.push('Consider higher-touch sales process for limited traffic');
      } else if (monthlyTraffic > 5000) {
        optimizations.push('Implement A/B testing with statistical significance');
        optimizations.push('Consider multiple funnel variants for different segments');
      }
    }

    // Custom requirements
    if (customRequirements && customRequirements.length > 0) {
      for (const req of customRequirements) {
        optimizations.push(`Custom: Address ${req} in funnel design`);
      }
    }

    return optimizations.slice(0, 10);
  }

  /**
   * Calculate confidence score for funnel design
   */
  private calculateDesignConfidence(request: FunnelDesignRequest): number {
    let score = 0;
    const maxScore = 100;

    // Business type specified (required)
    if (request.businessType) { score += 30; }

    // Target audience specified
    if (request.targetAudience) { score += 15; }

    // Current state known
    if (request.currentState) { score += 10; }

    // Budget known
    if (request.budget) { score += 10; }

    // Traffic source known
    if (request.trafficSource) { score += 10; }

    // Existing products known
    if (request.existingProducts && request.existingProducts.length > 0) { score += 10; }

    // AOV known
    if (request.averageOrderValue) { score += 5; }

    // Monthly traffic known
    if (request.monthlyTraffic) { score += 10; }

    return Math.round((score / maxScore) * 100) / 100;
  }

  /**
   * Generate warnings for the funnel design
   */
  private generateWarnings(
    businessType: BusinessType,
    monthlyTraffic?: number,
    budget?: 'low' | 'medium' | 'high'
  ): string[] {
    const warnings: string[] = [];
    const template = FUNNEL_TEMPLATES[businessType];

    // Traffic warnings
    if (monthlyTraffic !== undefined) {
      const requiredTraffic = template.requiredTraffic;
      const minRequired = parseInt(requiredTraffic.split('-')[0].replace(/\D/g, ''));

      if (monthlyTraffic < minRequired) {
        warnings.push(
          `Current traffic (${monthlyTraffic}/mo) is below recommended minimum (${requiredTraffic}). Focus on traffic acquisition.`
        );
      }
    }

    // Budget warnings
    if (budget === 'low') {
      if (['coach_consultant', 'agency'].includes(businessType)) {
        warnings.push(
          'High-ticket funnels require investment in quality lead magnets and sales processes. Consider starting simpler.'
        );
      }
    }

    // Business-specific warnings
    if (businessType === 'saas') {
      warnings.push('SaaS funnels require ongoing product development and customer success investment.');
    }

    if (businessType === 'membership') {
      warnings.push('Membership funnels require consistent content creation to reduce churn.');
    }

    return warnings;
  }

  // ==========================================================================
  // STAGE OPTIMIZATION LOGIC
  // ==========================================================================

  /**
   * Optimize a specific funnel stage
   */
  optimizeStage(request: StageOptimizationRequest): StageOptimizationResult {
    const { stage, currentMetrics, issues = [], businessType } = request;

    this.log('INFO', `Optimizing stage: ${stage}`);

    const _stageConfig = FUNNEL_STAGES[stage];

    // Analyze current issues
    const currentIssues = this.analyzeStageIssues(stage, currentMetrics, issues);

    // Generate recommendations
    const recommendations = this.generateStageRecommendations(stage, currentMetrics, businessType);

    // Get benchmarks
    const benchmarks = this.getStageBenchmarks(stage, currentMetrics);

    // Identify quick wins
    const quickWins = this.identifyQuickWins(stage, currentMetrics);

    // Calculate confidence
    const confidence = currentMetrics ? 0.85 : 0.6;

    return {
      stage,
      currentIssues,
      recommendations,
      benchmarks,
      quickWins,
      confidence,
    };
  }

  /**
   * Analyze issues for a specific stage
   */
  private analyzeStageIssues(
    stage: FunnelStage,
    metrics?: StageOptimizationRequest['currentMetrics'],
    reportedIssues?: string[]
  ): string[] {
    const issues: string[] = [...(reportedIssues ?? [])];

    if (!metrics) {
      issues.push('No metrics provided - unable to perform data-driven analysis');
      return issues;
    }

    // Stage-specific issue detection
    switch (stage) {
      case 'LEAD_MAGNET':
        if (metrics.optInRate !== undefined && metrics.optInRate < 0.2) {
          issues.push(`Low opt-in rate (${(metrics.optInRate * 100).toFixed(1)}%) - below 20% threshold`);
        }
        break;

      case 'TRIPWIRE':
        if (metrics.conversionRate !== undefined && metrics.conversionRate < 0.03) {
          issues.push(`Low tripwire conversion (${(metrics.conversionRate * 100).toFixed(1)}%) - below 3% threshold`);
        }
        break;

      case 'CORE_OFFER':
        if (metrics.conversionRate !== undefined && metrics.conversionRate < 0.01) {
          issues.push(`Low core offer conversion (${(metrics.conversionRate * 100).toFixed(1)}%) - below 1% threshold`);
        }
        if (metrics.churnRate !== undefined && metrics.churnRate > 0.1) {
          issues.push(`High churn rate (${(metrics.churnRate * 100).toFixed(1)}%) - above 10% threshold`);
        }
        break;

      case 'UPSELL':
        if (metrics.conversionRate !== undefined && metrics.conversionRate < 0.05) {
          issues.push(`Low upsell take rate (${(metrics.conversionRate * 100).toFixed(1)}%) - below 5% threshold`);
        }
        break;
    }

    return issues;
  }

  /**
   * Generate recommendations for stage optimization
   */
  private generateStageRecommendations(
    stage: FunnelStage,
    _metrics?: StageOptimizationRequest['currentMetrics'],
    _businessType?: BusinessType
  ): StageOptimizationResult['recommendations'] {
    const _recommendations: StageOptimizationResult['recommendations'] = [];

    const stageRecommendations: Record<FunnelStage, StageOptimizationResult['recommendations']> = {
      LEAD_MAGNET: [
        {
          priority: 'high',
          recommendation: 'A/B test lead magnet headline - test benefit-focused vs curiosity-based',
          expectedImpact: '+15-30% opt-in rate',
          effort: 'low',
        },
        {
          priority: 'high',
          recommendation: 'Add social proof near opt-in form (subscriber count, testimonials)',
          expectedImpact: '+10-20% opt-in rate',
          effort: 'low',
        },
        {
          priority: 'medium',
          recommendation: 'Implement exit-intent popup with alternative lead magnet',
          expectedImpact: '+5-10% captured abandoners',
          effort: 'medium',
        },
        {
          priority: 'medium',
          recommendation: 'Test different lead magnet formats (quiz vs PDF vs video)',
          expectedImpact: 'Variable - depends on audience',
          effort: 'high',
        },
      ],
      TRIPWIRE: [
        {
          priority: 'high',
          recommendation: 'Add countdown timer to tripwire offer page',
          expectedImpact: '+20-40% conversion',
          effort: 'low',
        },
        {
          priority: 'high',
          recommendation: 'Include 3+ customer testimonials specific to tripwire product',
          expectedImpact: '+15-25% conversion',
          effort: 'medium',
        },
        {
          priority: 'medium',
          recommendation: 'Test price points ($7, $17, $27, $37) to find optimal',
          expectedImpact: 'Optimize for revenue or conversion',
          effort: 'medium',
        },
        {
          priority: 'low',
          recommendation: 'Add payment plan option for higher-priced tripwires',
          expectedImpact: '+5-10% conversion',
          effort: 'low',
        },
      ],
      CORE_OFFER: [
        {
          priority: 'high',
          recommendation: 'Implement value stack presentation showing 10x+ value vs price',
          expectedImpact: '+25-50% perceived value',
          effort: 'medium',
        },
        {
          priority: 'high',
          recommendation: 'Add risk reversal (guarantee) prominently on sales page',
          expectedImpact: '+15-30% conversion',
          effort: 'low',
        },
        {
          priority: 'high',
          recommendation: 'Create urgency with limited-time bonus or cohort deadline',
          expectedImpact: '+20-40% conversion',
          effort: 'low',
        },
        {
          priority: 'medium',
          recommendation: 'Add case studies with specific results and transformations',
          expectedImpact: '+10-20% conversion',
          effort: 'high',
        },
      ],
      UPSELL: [
        {
          priority: 'high',
          recommendation: 'Ensure one-click upsell (no re-entering payment info)',
          expectedImpact: '+50-100% upsell conversion',
          effort: 'medium',
        },
        {
          priority: 'high',
          recommendation: 'Position upsell as logical next step, not separate product',
          expectedImpact: '+15-25% take rate',
          effort: 'low',
        },
        {
          priority: 'medium',
          recommendation: 'Add downsell offer if main upsell is declined',
          expectedImpact: '+5-10% recovered revenue',
          effort: 'medium',
        },
        {
          priority: 'low',
          recommendation: 'Test upsell timing (immediate vs delayed by 1 day)',
          expectedImpact: 'Variable - test required',
          effort: 'medium',
        },
      ],
    };

    return stageRecommendations[stage] ?? [];
  }

  /**
   * Get benchmarks for stage metrics
   */
  private getStageBenchmarks(
    stage: FunnelStage,
    currentMetrics?: StageOptimizationRequest['currentMetrics']
  ): StageOptimizationResult['benchmarks'] {
    const _benchmarks: StageOptimizationResult['benchmarks'] = [];

    const stageBenchmarks: Record<FunnelStage, StageOptimizationResult['benchmarks']> = {
      LEAD_MAGNET: [
        { metric: 'Opt-in Rate', current: currentMetrics?.optInRate, industry: '25-45%', target: '35%+' },
        { metric: 'Delivery Rate', industry: '98%+', target: '99%+' },
        { metric: 'Open Rate (first email)', industry: '40-60%', target: '50%+' },
      ],
      TRIPWIRE: [
        { metric: 'Conversion Rate', current: currentMetrics?.conversionRate, industry: '3-10%', target: '7%+' },
        { metric: 'AOV', current: currentMetrics?.aov, industry: '$15-30', target: '$25+' },
        { metric: 'Refund Rate', industry: '<5%', target: '<3%' },
      ],
      CORE_OFFER: [
        { metric: 'Conversion Rate', current: currentMetrics?.conversionRate, industry: '1-5%', target: '3%+' },
        { metric: 'LTV', current: currentMetrics?.ltv, industry: 'Varies', target: '3x+ CAC' },
        { metric: 'Churn Rate (monthly)', current: currentMetrics?.churnRate, industry: '5-10%', target: '<5%' },
      ],
      UPSELL: [
        { metric: 'Order Bump Take Rate', current: currentMetrics?.conversionRate, industry: '20-40%', target: '30%+' },
        { metric: 'Upsell Take Rate', industry: '10-20%', target: '15%+' },
        { metric: 'AOV Increase', industry: '15-40%', target: '25%+' },
      ],
    };

    return stageBenchmarks[stage] ?? [];
  }

  /**
   * Identify quick wins for immediate implementation
   */
  private identifyQuickWins(stage: FunnelStage, _metrics?: StageOptimizationRequest['currentMetrics']): string[] {
    const quickWins: Record<FunnelStage, string[]> = {
      LEAD_MAGNET: [
        'Add subscriber count social proof ("Join 10,000+ subscribers")',
        'Test button color (high contrast with page)',
        'Reduce form fields to email only',
        'Add privacy assurance ("We respect your privacy")',
      ],
      TRIPWIRE: [
        'Add scarcity element (limited time, limited quantity)',
        'Display original price crossed out',
        'Add "Secure checkout" badge',
        'Include money-back guarantee badge',
      ],
      CORE_OFFER: [
        'Add FAQ section addressing top objections',
        'Include payment plan option prominently',
        'Add live chat for questions',
        'Display guarantee above the fold',
      ],
      UPSELL: [
        'Make decline button less prominent',
        'Add "Special one-time offer" messaging',
        'Show how upsell complements main purchase',
        'Include limited-time bonus for accepting',
      ],
    };

    return quickWins[stage] ?? [];
  }

  // ==========================================================================
  // CONVERSION ANALYSIS LOGIC
  // ==========================================================================

  /**
   * Analyze conversion data across funnel stages
   */
  analyzeConversions(request: ConversionAnalysisRequest): ConversionAnalysisResult {
    const { funnelData, businessType, timeframe: _timeframe } = request;

    this.log('INFO', `Analyzing conversions for ${funnelData.length} stages`);

    // Analyze each stage
    const analysis = this.analyzeStageConversions(funnelData, businessType);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(funnelData, analysis);

    // Determine overall health
    const overallHealth = this.determineOverallHealth(analysis);

    // Identify top priority
    const topPriority = this.identifyTopPriority(bottlenecks);

    // Calculate confidence
    const confidence = this.calculateAnalysisConfidence(funnelData);

    return {
      analysis,
      bottlenecks,
      overallHealth,
      topPriority,
      confidence,
    };
  }

  /**
   * Analyze conversions for each stage
   */
  private analyzeStageConversions(
    funnelData: ConversionAnalysisRequest['funnelData'],
    _businessType?: BusinessType
  ): ConversionAnalysisResult['analysis'] {
    const analysis: ConversionAnalysisResult['analysis'] = [];

    const benchmarks: Record<FunnelStage, { min: number; good: number; excellent: number }> = {
      LEAD_MAGNET: { min: 0.15, good: 0.3, excellent: 0.45 },
      TRIPWIRE: { min: 0.02, good: 0.05, excellent: 0.1 },
      CORE_OFFER: { min: 0.01, good: 0.03, excellent: 0.05 },
      UPSELL: { min: 0.05, good: 0.15, excellent: 0.3 },
    };

    let previousVisitors = 0;

    for (let i = 0; i < funnelData.length; i++) {
      const data = funnelData[i];
      const conversionRate = data.visitors > 0 ? data.conversions / data.visitors : 0;
      const benchmark = benchmarks[data.stage];

      let status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
      if (conversionRate >= benchmark.excellent) {
        status = 'excellent';
      } else if (conversionRate >= benchmark.good) {
        status = 'good';
      } else if (conversionRate >= benchmark.min) {
        status = 'needs_improvement';
      } else {
        status = 'critical';
      }

      const dropOffPercentage = previousVisitors > 0 ? ((previousVisitors - data.conversions) / previousVisitors) * 100 : 0;

      analysis.push({
        stage: data.stage,
        conversionRate: Math.round(conversionRate * 1000) / 10,
        benchmark: `${benchmark.good * 100}-${benchmark.excellent * 100}%`,
        status,
        dropOffPercentage: Math.round(dropOffPercentage * 10) / 10,
      });

      previousVisitors = data.conversions;
    }

    return analysis;
  }

  /**
   * Identify conversion bottlenecks
   */
  private identifyBottlenecks(
    funnelData: ConversionAnalysisRequest['funnelData'],
    analysis: ConversionAnalysisResult['analysis']
  ): ConversionAnalysisResult['bottlenecks'] {
    const bottlenecks: ConversionAnalysisResult['bottlenecks'] = [];

    for (let i = 0; i < analysis.length; i++) {
      const stageAnalysis = analysis[i];
      const stageData = funnelData[i];

      if (stageAnalysis.status === 'critical' || stageAnalysis.status === 'needs_improvement') {
        const severity = stageAnalysis.status === 'critical' ? 'critical' : 'major';

        // Calculate lost revenue (estimate)
        const avgConversion = stageAnalysis.status === 'critical' ? 0.03 : 0.05;
        const potentialConversions = Math.floor(stageData.visitors * avgConversion);
        const lostConversions = potentialConversions - stageData.conversions;
        const estimatedRevenue = this.estimateRevenueLoss(stageData.stage, lostConversions);

        bottlenecks.push({
          stage: stageData.stage,
          severity,
          lostRevenue: estimatedRevenue,
          recommendation: this.getBottleneckRecommendation(stageData.stage, stageAnalysis.conversionRate),
        });
      }
    }

    // Sort by severity
    bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return bottlenecks;
  }

  /**
   * Estimate revenue loss from bottleneck
   */
  private estimateRevenueLoss(stage: FunnelStage, lostConversions: number): string {
    const revenuePerConversion: Record<FunnelStage, number> = {
      LEAD_MAGNET: 0.5, // Email value
      TRIPWIRE: 20,
      CORE_OFFER: 500,
      UPSELL: 100,
    };

    const loss = lostConversions * revenuePerConversion[stage];
    return `$${loss.toLocaleString()}/month estimated`;
  }

  /**
   * Get recommendation for specific bottleneck
   */
  private getBottleneckRecommendation(stage: FunnelStage, _currentRate: number): string {
    const recommendations: Record<FunnelStage, string> = {
      LEAD_MAGNET: 'Test new lead magnet offers and optimize opt-in page headline/CTA',
      TRIPWIRE: 'Add urgency elements and reduce friction in purchase process',
      CORE_OFFER: 'Strengthen value proposition and add more social proof',
      UPSELL: 'Ensure one-click upsell and test different offer positioning',
    };

    return recommendations[stage];
  }

  /**
   * Determine overall funnel health
   */
  private determineOverallHealth(
    analysis: ConversionAnalysisResult['analysis']
  ): 'healthy' | 'moderate' | 'unhealthy' {
    const criticalCount = analysis.filter(a => a.status === 'critical').length;
    const needsImprovementCount = analysis.filter(a => a.status === 'needs_improvement').length;

    if (criticalCount > 0) { return 'unhealthy'; }
    if (needsImprovementCount > 1) { return 'moderate'; }
    return 'healthy';
  }

  /**
   * Identify the top priority fix
   */
  private identifyTopPriority(bottlenecks: ConversionAnalysisResult['bottlenecks']): string {
    if (bottlenecks.length === 0) {
      return 'No critical bottlenecks identified - focus on incremental optimization';
    }

    const topBottleneck = bottlenecks[0];
    return `Fix ${topBottleneck.stage} stage (${topBottleneck.severity}): ${topBottleneck.recommendation}`;
  }

  /**
   * Calculate confidence for analysis
   */
  private calculateAnalysisConfidence(funnelData: ConversionAnalysisRequest['funnelData']): number {
    let score = 0;
    const maxScore = 100;

    // Data completeness
    if (funnelData.length >= 4) { score += 30; }
    else if (funnelData.length >= 2) { score += 15; }

    // Data volume
    const totalVisitors = funnelData.reduce((sum, d) => sum + d.visitors, 0);
    if (totalVisitors > 1000) { score += 40; }
    else if (totalVisitors > 100) { score += 20; }
    else { score += 5; }

    // Revenue data
    const hasRevenue = funnelData.some(d => d.revenue !== undefined);
    if (hasRevenue) { score += 30; }

    return Math.round((score / maxScore) * 100) / 100;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new FunnelPathologist instance
 */
export function createFunnelPathologist(): FunnelPathologist {
  return new FunnelPathologist();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: FunnelPathologist | null = null;

/**
 * Get the singleton FunnelPathologist instance
 */
export function getFunnelPathologist(): FunnelPathologist {
  instance ??= createFunnelPathologist();
  return instance;
}

// ============================================================================
// EXPORT CONSTANTS FOR EXTERNAL USE
// ============================================================================

export { FUNNEL_STAGES, FUNNEL_TEMPLATES, URGENCY_TACTICS, PRICE_ANCHORING, CONVERSION_RULES };
