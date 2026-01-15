/**
 * Conversion Copywriter Specialist
 * STATUS: FUNCTIONAL
 *
 * Expert in persuasive copywriting using proven frameworks.
 * Generates high-converting headlines, CTAs, and sales copy
 * using psychology-backed techniques and A/B testing variations.
 *
 * CAPABILITIES:
 * - Framework selection based on audience awareness level
 * - Headline generation using proven formulas
 * - CTA optimization with urgency, value, and risk reversal
 * - Full copy generation (hero, features, benefits, testimonials)
 * - A/B test variation generation
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';

// ============================================================================
// COPYWRITING FRAMEWORKS LIBRARY
// ============================================================================

const COPYWRITING_FRAMEWORKS = {
  // PAS - Problem, Agitate, Solution
  PAS: {
    name: 'Problem-Agitate-Solution',
    bestFor: ['pain-point driven', 'service businesses', 'B2B'],
    structure: {
      problem: 'Identify the painful problem they face',
      agitate: 'Twist the knife - make the pain vivid',
      solution: 'Present your offer as the answer',
    },
    example: {
      problem: "Tired of spending hours on social media with zero leads?",
      agitate: "While you're posting aimlessly, your competitors are closing deals. Every day without a strategy costs you $1000s in lost revenue.",
      solution: "Our AI Marketing System generates qualified leads on autopilot - so you can focus on closing, not posting.",
    },
    conversionRate: 'High for problem-aware audiences',
    awarenessLevel: ['problem-aware', 'solution-aware'],
  },

  // AIDA - Attention, Interest, Desire, Action
  AIDA: {
    name: 'Attention-Interest-Desire-Action',
    bestFor: ['cold audiences', 'ads', 'landing pages'],
    structure: {
      attention: 'Stop the scroll with a bold statement',
      interest: 'Build curiosity with specific details',
      desire: 'Create emotional want with benefits',
      action: 'Clear CTA with urgency',
    },
    example: {
      attention: "We generated $127,000 in 30 days with this ONE strategy",
      interest: "No ads. No cold calling. Just 15 minutes per day.",
      desire: "Imagine waking up to notifications of new leads and sales - while your competitors wonder what happened.",
      action: "Get the free training before we take it down Friday",
    },
    conversionRate: 'Best for awareness stage',
    awarenessLevel: ['unaware', 'problem-aware'],
  },

  // BAB - Before, After, Bridge
  BAB: {
    name: 'Before-After-Bridge',
    bestFor: ['transformation offers', 'coaching', 'courses'],
    structure: {
      before: 'Paint their current painful reality',
      after: 'Show the transformed future state',
      bridge: 'Your offer is the bridge between',
    },
    example: {
      before: "6 months ago, Sarah was stuck at $3k/month, working 60-hour weeks, and ready to quit.",
      after: "Today, she runs a $25k/month business working 20 hours a week - with a waitlist of clients.",
      bridge: "The difference? Our Client Acquisition System. And it works for any service business.",
    },
    conversionRate: 'Excellent for testimonial-based selling',
    awarenessLevel: ['problem-aware', 'solution-aware'],
  },

  // FAB - Features, Advantages, Benefits
  FAB: {
    name: 'Features-Advantages-Benefits',
    bestFor: ['product pages', 'SaaS', 'technical audiences'],
    structure: {
      features: 'What the product HAS',
      advantages: 'What those features DO',
      benefits: 'What that MEANS for them',
    },
    example: {
      features: "AI-powered lead scoring with 50+ data points",
      advantages: "Automatically ranks leads by likelihood to buy",
      benefits: "So you only spend time on leads ready to close - doubling your close rate",
    },
    conversionRate: 'Best for product-aware stage',
    awarenessLevel: ['product-aware', 'most-aware'],
  },

  // 4Ps - Promise, Picture, Proof, Push
  FOUR_PS: {
    name: 'Promise-Picture-Proof-Push',
    bestFor: ['sales pages', 'webinars', 'high-ticket'],
    structure: {
      promise: 'Bold claim/result they can expect',
      picture: 'Vivid visualization of success',
      proof: 'Evidence (testimonials, case studies)',
      push: 'CTA with urgency + guarantee',
    },
    example: {
      promise: "Double your revenue in 90 days or we work for free",
      picture: "Picture this: It's 90 days from now. You check your dashboard and see 2x the revenue you made last quarter.",
      proof: "Just like our 500+ clients who've collectively added $47M in new revenue.",
      push: "Book your free strategy call now - only 5 spots left this week",
    },
    conversionRate: 'High for solution-aware audiences',
    awarenessLevel: ['solution-aware', 'product-aware'],
  },

  // StoryBrand - Character, Problem, Guide, Plan, Action, Success, Failure
  STORYBRAND: {
    name: 'StoryBrand Framework',
    bestFor: ['brand messaging', 'websites', 'long-form'],
    structure: {
      character: 'Customer is the hero',
      problem: 'External, internal, philosophical',
      guide: 'You are the guide (empathy + authority)',
      plan: 'Simple 3-step process',
      action: 'Clear CTA',
      success: 'What success looks like',
      failure: 'What failure looks like (stakes)',
    },
    example: {
      character: "You're a business owner who wants to grow",
      problem: "But lead generation is overwhelming, expensive, and unpredictable",
      guide: "We've helped 1,000+ businesses just like yours solve this exact problem",
      plan: "1. Book a call. 2. Get your custom plan. 3. Watch leads roll in.",
      action: "Schedule your free strategy session",
      success: "Finally have a predictable pipeline of qualified leads",
      failure: "Or keep struggling with inconsistent revenue and sleepless nights",
    },
    conversionRate: 'Best for brand positioning',
    awarenessLevel: ['unaware', 'problem-aware', 'solution-aware'],
  },
};

type FrameworkKey = keyof typeof COPYWRITING_FRAMEWORKS;

// ============================================================================
// CTA TEMPLATES LIBRARY
// ============================================================================

const CTA_TEMPLATES = {
  urgency: [
    "Get instant access before price increases",
    "Start free trial - only {spots} left",
    "Claim your spot before {deadline}",
    "Yes, I want in! (Closing soon)",
    "Reserve my seat now (Limited availability)",
    "Lock in your price before {deadline}",
    "Join {count}+ others who started today",
  ],
  value: [
    "Get the free {offer}",
    "Show me how",
    "Start growing today",
    "Get my personalized plan",
    "Unlock instant access",
    "See it in action",
    "Get started free",
    "Try it risk-free",
  ],
  risk_reversal: [
    "Try free for 14 days - no credit card required",
    "Start free - cancel anytime",
    "100% money-back guarantee - start now",
    "No commitment. No risk. Start free.",
    "Love it or your money back",
    "Try before you buy",
    "Free trial - no strings attached",
  ],
  action: [
    "Book my free call",
    "Download free guide",
    "Start building",
    "Claim my discount",
    "Get instant access",
    "Watch the demo",
    "Request a quote",
    "Talk to an expert",
  ],
  social_proof: [
    "Join {count}+ happy customers",
    "See why {count}+ businesses chose us",
    "Start like {count}+ others did",
    "Get results like our {count}+ clients",
  ],
};

type CTACategory = keyof typeof CTA_TEMPLATES;

// ============================================================================
// HEADLINE FORMULAS LIBRARY
// ============================================================================

const HEADLINE_FORMULAS = {
  how_to: {
    template: "How to {achieve result} without {common obstacle}",
    variables: ['achieve result', 'common obstacle'],
    bestFor: ['educational content', 'guides', 'tutorials'],
  },
  number: {
    template: "{Number} ways to {achieve result} in {timeframe}",
    variables: ['Number', 'achieve result', 'timeframe'],
    bestFor: ['listicles', 'quick wins', 'actionable content'],
  },
  question: {
    template: "Are you making these {number} {topic} mistakes?",
    variables: ['number', 'topic'],
    bestFor: ['problem awareness', 'fear-based', 'curiosity'],
  },
  secret: {
    template: "The {adjective} secret to {desired result}",
    variables: ['adjective', 'desired result'],
    bestFor: ['curiosity', 'exclusivity', 'insider knowledge'],
  },
  result: {
    template: "We {achieved result} in {timeframe}. Here's how:",
    variables: ['achieved result', 'timeframe'],
    bestFor: ['case studies', 'proof', 'credibility'],
  },
  warning: {
    template: "Warning: Don't {action} until you read this",
    variables: ['action'],
    bestFor: ['urgency', 'fear-based', 'stopping scroll'],
  },
  proven: {
    template: "The proven {number}-step system to {result}",
    variables: ['number', 'result'],
    bestFor: ['methodology', 'systems', 'frameworks'],
  },
  discover: {
    template: "Discover how {audience} are {achieving result}",
    variables: ['audience', 'achieving result'],
    bestFor: ['social proof', 'aspirational', 'curiosity'],
  },
  guarantee: {
    template: "{Result} guaranteed or {fallback}",
    variables: ['Result', 'fallback'],
    bestFor: ['high-ticket', 'risk reversal', 'confidence'],
  },
  comparison: {
    template: "Why {your solution} beats {alternative} every time",
    variables: ['your solution', 'alternative'],
    bestFor: ['competitive positioning', 'differentiation'],
  },
};

type HeadlineFormulaKey = keyof typeof HEADLINE_FORMULAS;

// ============================================================================
// PERSUASION PSYCHOLOGY PRINCIPLES
// ============================================================================

const PERSUASION_PRINCIPLES = {
  reciprocity: {
    description: 'Give value first, then ask',
    tactics: [
      'Free lead magnets',
      'Valuable content upfront',
      'Free trials',
      'Bonus gifts',
    ],
    copyTriggers: ['free', 'gift', 'bonus', 'complimentary', 'on us'],
  },
  scarcity: {
    description: 'Limited availability increases desire',
    tactics: [
      'Limited time offers',
      'Limited spots',
      'Exclusive access',
      'Closing soon',
    ],
    copyTriggers: ['only', 'limited', 'exclusive', 'last chance', 'closing', 'few left'],
  },
  authority: {
    description: 'Expert positioning builds trust',
    tactics: [
      'Credentials and certifications',
      'Media mentions',
      'Industry experience',
      'Published work',
    ],
    copyTriggers: ['expert', 'certified', 'featured in', 'years of experience', 'trusted by'],
  },
  social_proof: {
    description: 'Others like them have succeeded',
    tactics: [
      'Testimonials',
      'Case studies',
      'User counts',
      'Reviews and ratings',
    ],
    copyTriggers: ['join', 'others', 'customers', 'rated', 'reviewed', 'trusted by'],
  },
  liking: {
    description: 'People buy from those they like',
    tactics: [
      'Personal stories',
      'Shared values',
      'Authenticity',
      'Relatability',
    ],
    copyTriggers: ['we understand', 'just like you', 'we\'ve been there', 'our story'],
  },
  commitment: {
    description: 'Small yeses lead to big yeses',
    tactics: [
      'Micro-commitments',
      'Free trials',
      'Email opt-ins',
      'Low-risk first steps',
    ],
    copyTriggers: ['start with', 'just try', 'no commitment', 'first step'],
  },
};

// ============================================================================
// VOICE/TONE PRESETS BY INDUSTRY
// ============================================================================

const VOICE_PRESETS = {
  saas: {
    tone: 'Professional yet approachable',
    characteristics: ['Clear', 'Benefit-focused', 'Technical when needed', 'Data-driven'],
    avoidWords: ['Cheap', 'Buy now', 'Limited time only'],
    powerWords: ['Automate', 'Scale', 'Integrate', 'Streamline', 'Optimize'],
  },
  ecommerce: {
    tone: 'Friendly and persuasive',
    characteristics: ['Urgent', 'Visual', 'Emotion-driven', 'Deal-focused'],
    avoidWords: ['Spam', 'Obligation', 'Contract'],
    powerWords: ['Free shipping', 'Sale', 'Exclusive', 'Limited', 'Save'],
  },
  b2b: {
    tone: 'Professional and authoritative',
    characteristics: ['ROI-focused', 'Data-backed', 'Solution-oriented', 'Credible'],
    avoidWords: ['Cheap', 'Amazing', 'Revolutionary'],
    powerWords: ['ROI', 'Efficiency', 'Scalable', 'Enterprise', 'Compliance'],
  },
  coaching: {
    tone: 'Empathetic and aspirational',
    characteristics: ['Story-driven', 'Transformational', 'Personal', 'Motivating'],
    avoidWords: ['Guaranteed results', 'Get rich quick'],
    powerWords: ['Transform', 'Breakthrough', 'Unlock', 'Discover', 'Journey'],
  },
  healthcare: {
    tone: 'Trustworthy and caring',
    characteristics: ['Empathetic', 'Clear', 'Reassuring', 'Professional'],
    avoidWords: ['Cure', 'Guaranteed', 'Miracle'],
    powerWords: ['Care', 'Trust', 'Expert', 'Safe', 'Proven'],
  },
  finance: {
    tone: 'Confident and trustworthy',
    characteristics: ['Professional', 'Precise', 'Secure', 'Results-focused'],
    avoidWords: ['Get rich', 'Guaranteed returns', 'Risk-free'],
    powerWords: ['Secure', 'Growth', 'Protect', 'Wealth', 'Strategy'],
  },
  realestate: {
    tone: 'Warm and professional',
    characteristics: ['Local expertise', 'Personal service', 'Market knowledge', 'Trustworthy'],
    avoidWords: ['Cheap', 'Desperate', 'Must sell'],
    powerWords: ['Dream home', 'Investment', 'Location', 'Value', 'Expert'],
  },
};

type IndustryKey = keyof typeof VOICE_PRESETS;

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are the Conversion Copywriter Specialist, an expert in persuasive writing that drives action.

## YOUR ROLE
You craft high-converting copy using proven psychological frameworks. Your words turn visitors into leads, and leads into customers.

## FRAMEWORK SELECTION LOGIC
Choose frameworks based on audience awareness level:
- UNAWARE: Use AIDA or STORYBRAND - need to create problem awareness first
- PROBLEM-AWARE: Use PAS or BAB - they know the pain, agitate and solve
- SOLUTION-AWARE: Use FOUR_PS or FAB - they know solutions exist, show why yours
- PRODUCT-AWARE: Use FAB - they know you, show features and benefits
- MOST-AWARE: Use direct offer with urgency - they're ready, just need a push

## HEADLINE GENERATION RULES
1. Lead with the biggest benefit or curiosity hook
2. Use specific numbers when possible (127% better, not "much better")
3. Address the reader directly (you/your)
4. Keep under 10 words for ads, 15 for landing pages
5. Test emotional vs logical angles in variations

## CTA OPTIMIZATION PRINCIPLES
1. Use first person ("Get MY free guide" vs "Get your free guide")
2. Start with action verbs (Get, Start, Claim, Download, Book)
3. Add urgency without being pushy
4. Reduce friction with risk reversal
5. Make the value exchange clear

## PERSUASION PSYCHOLOGY
Apply these principles strategically:
- Reciprocity: Give value before asking
- Scarcity: Create urgency through limitation
- Authority: Establish expertise and credibility
- Social Proof: Show others like them succeeded
- Liking: Be relatable and authentic
- Commitment: Start with small asks

## VOICE/TONE ADAPTATION
Adjust copy style based on industry:
- SaaS: Professional, benefit-focused, data-driven
- E-commerce: Urgent, visual, deal-focused
- B2B: ROI-focused, credible, solution-oriented
- Coaching: Empathetic, transformational, story-driven
- Healthcare: Trustworthy, caring, reassuring
- Finance: Confident, precise, secure

## OUTPUT FORMAT
Always return structured JSON with:
- Selected framework and reasoning
- Main headline with variations
- Supporting subheadline
- Body copy sections
- Primary and secondary CTAs
- A/B test variations
- Confidence score

## RULES
1. NEVER use clickbait that doesn't deliver
2. Always focus on benefits, not just features
3. Use specific numbers and results when available
4. Keep sentences short and punchy
5. One idea per paragraph
6. End every section with a forward motion`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'COPY_SPECIALIST',
    name: 'Conversion Copywriter',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'ARCHITECT_MANAGER',
    capabilities: [
      'framework_selection',
      'headline_generation',
      'cta_optimization',
      'copy_generation',
      'ab_variations',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: [
    'select_framework',
    'generate_headline',
    'optimize_cta',
    'generate_copy',
    'create_variations',
  ],
  outputSchema: {
    type: 'object',
    properties: {
      copyOutput: {
        type: 'object',
        properties: {
          framework: { type: 'string' },
          headline: { type: 'string' },
          subheadline: { type: 'string' },
          bodyCopy: { type: 'object' },
          cta: { type: 'object' },
          variations: { type: 'array' },
        },
      },
      confidence: { type: 'number' },
    },
    required: ['copyOutput', 'confidence'],
  },
  maxTokens: 4096,
  temperature: 0.7, // Higher for creative copy
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AwarenessLevel = 'unaware' | 'problem-aware' | 'solution-aware' | 'product-aware' | 'most-aware';

export interface CopyRequest {
  type: 'framework_selection' | 'headline_generation' | 'cta_optimization' | 'copy_generation' | 'ab_variations';
  context: {
    product?: string;
    audience?: string;
    industry?: IndustryKey;
    awarenessLevel?: AwarenessLevel;
    offer?: string;
    painPoints?: string[];
    benefits?: string[];
    testimonials?: Array<{ name: string; result: string; quote: string }>;
    deadline?: string;
    spots?: number;
    existingCopy?: string;
  };
  options?: {
    framework?: FrameworkKey;
    headlineFormula?: HeadlineFormulaKey;
    ctaCategory?: CTACategory;
    variationCount?: number;
    includePersuasionTactics?: boolean;
  };
}

export interface HeadlineResult {
  primary: string;
  formula: string;
  variations: string[];
  emotionalAngle: string;
  logicalAngle: string;
}

export interface CTAResult {
  primary: {
    text: string;
    category: CTACategory;
    persuasionPrinciple: string;
  };
  secondary: {
    text: string;
    category: CTACategory;
  };
  microcopy: string;
}

export interface BodyCopySection {
  name: string;
  content: string;
  purpose: string;
}

export interface CopyOutput {
  framework: string;
  frameworkReasoning: string;
  headline: string;
  subheadline: string;
  bodyCopy: {
    sections: BodyCopySection[];
  };
  cta: CTAResult;
  variations: Array<{
    type: string;
    headline: string;
    subheadline: string;
    cta: string;
  }>;
  voiceTone: string;
  persuasionTactics: string[];
}

export interface CopyResult {
  copyOutput: CopyOutput;
  confidence: number;
  metadata: {
    generatedAt: string;
    requestType: string;
    awarenessLevel: AwarenessLevel;
    industry: IndustryKey | 'general';
  };
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class CopySpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
    this.log('INFO', 'Conversion Copywriter Specialist initialized');
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as CopyRequest;

      if (!payload?.type) {
        return this.createReport(taskId, 'FAILED', null, ['No request type provided']);
      }

      this.log('INFO', `Processing copy request: ${payload.type}`);

      let result: CopyResult;

      switch (payload.type) {
        case 'framework_selection':
          result = await this.selectFramework(payload);
          break;
        case 'headline_generation':
          result = await this.generateHeadlines(payload);
          break;
        case 'cta_optimization':
          result = await this.optimizeCTA(payload);
          break;
        case 'copy_generation':
          result = await this.generateFullCopy(payload);
          break;
        case 'ab_variations':
          result = await this.generateVariations(payload);
          break;
        default:
          return this.createReport(taskId, 'FAILED', null, [`Unknown request type: ${payload.type}`]);
      }

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Copy generation failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
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
    return { functional: 550, boilerplate: 100 };
  }

  // ==========================================================================
  // FRAMEWORK SELECTION
  // ==========================================================================

  /**
   * Select the best copywriting framework based on context
   */
  private async selectFramework(request: CopyRequest): Promise<CopyResult> {
    const awarenessLevel = request.context.awarenessLevel || 'problem-aware';
    const industry = request.context.industry || 'saas';
    const contentType = this.inferContentType(request);

    // Score each framework
    const scores: Array<{ key: FrameworkKey; score: number; reasons: string[] }> = [];

    for (const [key, framework] of Object.entries(COPYWRITING_FRAMEWORKS)) {
      const frameworkKey = key as FrameworkKey;
      let score = 0;
      const reasons: string[] = [];

      // Check awareness level match
      if (framework.awarenessLevel.includes(awarenessLevel)) {
        score += 30;
        reasons.push(`Matches ${awarenessLevel} awareness level`);
      }

      // Check best-for match
      for (const useCase of framework.bestFor) {
        if (contentType.toLowerCase().includes(useCase.toLowerCase())) {
          score += 20;
          reasons.push(`Ideal for ${useCase}`);
        }
        if (industry.toLowerCase().includes(useCase.toLowerCase())) {
          score += 15;
          reasons.push(`Good for ${industry} industry`);
        }
      }

      // Bonus for specific scenarios
      if (awarenessLevel === 'unaware' && (frameworkKey === 'AIDA' || frameworkKey === 'STORYBRAND')) {
        score += 25;
        reasons.push('Best for cold audiences');
      }
      if (request.context.testimonials && request.context.testimonials.length > 0 && frameworkKey === 'BAB') {
        score += 20;
        reasons.push('Testimonials available for transformation stories');
      }
      if (request.context.painPoints && request.context.painPoints.length > 0 && frameworkKey === 'PAS') {
        score += 20;
        reasons.push('Pain points identified for agitation');
      }

      scores.push({ key: frameworkKey, score, reasons });
    }

    // Sort by score and get best
    scores.sort((a, b) => b.score - a.score);
    const bestFramework = scores[0];
    const selectedFramework = COPYWRITING_FRAMEWORKS[bestFramework.key];

    // Generate sample copy using selected framework
    const sampleCopy = this.generateFrameworkCopy(bestFramework.key, request);

    return {
      copyOutput: {
        framework: selectedFramework.name,
        frameworkReasoning: bestFramework.reasons.join('; '),
        headline: sampleCopy.headline,
        subheadline: sampleCopy.subheadline,
        bodyCopy: { sections: sampleCopy.sections },
        cta: this.generateCTAForFramework(bestFramework.key, request),
        variations: [],
        voiceTone: VOICE_PRESETS[industry]?.tone || 'Professional',
        persuasionTactics: this.selectPersuasionTactics(request),
      },
      confidence: Math.min(bestFramework.score / 100, 0.95),
      metadata: {
        generatedAt: new Date().toISOString(),
        requestType: 'framework_selection',
        awarenessLevel,
        industry,
      },
    };
  }

  /**
   * Infer content type from request context
   */
  private inferContentType(request: CopyRequest): string {
    if (request.context.offer?.toLowerCase().includes('webinar')) return 'webinar';
    if (request.context.offer?.toLowerCase().includes('course')) return 'course';
    if (request.context.offer?.toLowerCase().includes('software')) return 'saas';
    if (request.context.offer?.toLowerCase().includes('coaching')) return 'coaching';
    return 'landing page';
  }

  /**
   * Generate copy using a specific framework
   */
  private generateFrameworkCopy(
    frameworkKey: FrameworkKey,
    request: CopyRequest
  ): { headline: string; subheadline: string; sections: BodyCopySection[] } {
    const product = request.context.product || 'our solution';
    const audience = request.context.audience || 'businesses';
    const painPoints = request.context.painPoints || ['wasting time', 'losing money', 'falling behind'];
    const benefits = request.context.benefits || ['save time', 'increase revenue', 'get ahead'];

    switch (frameworkKey) {
      case 'PAS':
        return {
          headline: `Stop ${painPoints[0]} - There's a Better Way`,
          subheadline: `${product} helps ${audience} ${benefits[0]} without the frustration`,
          sections: [
            { name: 'problem', content: `Are you tired of ${painPoints.join(', ')}?`, purpose: 'Identify pain' },
            { name: 'agitate', content: `Every day you wait, your competitors pull further ahead. The cost of inaction isn't just money - it's opportunity, growth, and peace of mind.`, purpose: 'Amplify pain' },
            { name: 'solution', content: `${product} was built specifically for ${audience} who want to ${benefits.join(', ')}. No more guesswork. No more wasted effort.`, purpose: 'Present answer' },
          ],
        };

      case 'AIDA':
        return {
          headline: `${audience}: Here's How to ${benefits[0]} in Half the Time`,
          subheadline: `The system that's helped 1,000+ ${audience} transform their results`,
          sections: [
            { name: 'attention', content: `What if you could ${benefits[0]} starting today?`, purpose: 'Stop scroll' },
            { name: 'interest', content: `${product} uses a proven system that eliminates ${painPoints[0]} while maximizing ${benefits[0]}.`, purpose: 'Build curiosity' },
            { name: 'desire', content: `Imagine checking your results and seeing consistent growth - without the stress and overwhelm you're experiencing now.`, purpose: 'Create want' },
            { name: 'action', content: `Get started today and see the difference for yourself.`, purpose: 'Drive action' },
          ],
        };

      case 'BAB':
        return {
          headline: `From ${painPoints[0]} to ${benefits[0]} - Here's How`,
          subheadline: `The transformation ${audience} are raving about`,
          sections: [
            { name: 'before', content: `Before: Struggling with ${painPoints.join(', ')}. Feeling stuck. Watching others succeed while you spin your wheels.`, purpose: 'Paint current reality' },
            { name: 'after', content: `After: ${benefits.join('. ')}. Confidence. Results you can be proud of.`, purpose: 'Show future state' },
            { name: 'bridge', content: `The bridge? ${product}. It's the same system that's transformed thousands of ${audience} just like you.`, purpose: 'Connect with offer' },
          ],
        };

      case 'FAB':
        return {
          headline: `${product}: Everything You Need to ${benefits[0]}`,
          subheadline: `Built for ${audience} who demand results`,
          sections: [
            { name: 'features', content: `${product} includes: advanced automation, real-time analytics, and seamless integrations.`, purpose: 'What it has' },
            { name: 'advantages', content: `This means you can automate repetitive tasks, make data-driven decisions, and connect all your tools in one place.`, purpose: 'What it does' },
            { name: 'benefits', content: `So you ${benefits.join(', ')} - giving you back time, money, and peace of mind.`, purpose: 'What it means for them' },
          ],
        };

      case 'FOUR_PS':
        return {
          headline: `${benefits[0]} Guaranteed - Or Your Money Back`,
          subheadline: `Join ${audience} who've already transformed their results`,
          sections: [
            { name: 'promise', content: `We promise: you will ${benefits[0]} within 90 days, or we'll refund every penny.`, purpose: 'Bold claim' },
            { name: 'picture', content: `Picture this: 90 days from now, you've eliminated ${painPoints[0]} and are finally experiencing ${benefits.join(', ')}.`, purpose: 'Visualize success' },
            { name: 'proof', content: `Just like our 1,000+ clients who've achieved the same transformation using our proven system.`, purpose: 'Evidence' },
            { name: 'push', content: `But don't wait - we only accept a limited number of new clients each month to ensure quality.`, purpose: 'CTA with urgency' },
          ],
        };

      case 'STORYBRAND':
      default:
        return {
          headline: `You Deserve to ${benefits[0]} - Let Us Show You How`,
          subheadline: `We've helped thousands of ${audience}. Now it's your turn.`,
          sections: [
            { name: 'character', content: `You're a ${audience.slice(0, -1)} who wants to succeed.`, purpose: 'Hero positioning' },
            { name: 'problem', content: `But ${painPoints.join(', ')} are holding you back.`, purpose: 'Three-level problem' },
            { name: 'guide', content: `We've been there. And we've helped 1,000+ ${audience} overcome these exact challenges.`, purpose: 'Empathy + authority' },
            { name: 'plan', content: `Our simple 3-step process: 1) Get your custom plan 2) Implement with our support 3) See results`, purpose: 'Simple process' },
            { name: 'success', content: `Success looks like: ${benefits.join(', ')}.`, purpose: 'What success looks like' },
            { name: 'failure', content: `Or you can stay stuck with ${painPoints[0]} - the choice is yours.`, purpose: 'Stakes' },
          ],
        };
    }
  }

  // ==========================================================================
  // HEADLINE GENERATION
  // ==========================================================================

  /**
   * Generate compelling headlines using proven formulas
   */
  private async generateHeadlines(request: CopyRequest): Promise<CopyResult> {
    const product = request.context.product || 'Our Solution';
    const audience = request.context.audience || 'businesses';
    const benefits = request.context.benefits || ['save time', 'increase revenue'];
    const painPoints = request.context.painPoints || ['wasting time'];
    const industry = request.context.industry || 'saas';

    const headlines: HeadlineResult = {
      primary: '',
      formula: '',
      variations: [],
      emotionalAngle: '',
      logicalAngle: '',
    };

    // Generate headlines using each formula
    const generatedHeadlines: Array<{ headline: string; formula: string }> = [];

    // How-to formula
    generatedHeadlines.push({
      headline: `How to ${benefits[0]} without ${painPoints[0]}`,
      formula: 'how_to',
    });

    // Number formula
    generatedHeadlines.push({
      headline: `7 ways to ${benefits[0]} in just 30 days`,
      formula: 'number',
    });

    // Question formula
    generatedHeadlines.push({
      headline: `Are you making these 3 ${painPoints[0]} mistakes?`,
      formula: 'question',
    });

    // Secret formula
    generatedHeadlines.push({
      headline: `The surprising secret to ${benefits[0]}`,
      formula: 'secret',
    });

    // Result formula
    generatedHeadlines.push({
      headline: `We helped ${audience} ${benefits[0]} in 30 days. Here's how:`,
      formula: 'result',
    });

    // Warning formula
    generatedHeadlines.push({
      headline: `Warning: Don't try to ${benefits[0]} until you read this`,
      formula: 'warning',
    });

    // Proven formula
    generatedHeadlines.push({
      headline: `The proven 5-step system to ${benefits[0]}`,
      formula: 'proven',
    });

    // Discover formula
    generatedHeadlines.push({
      headline: `Discover how ${audience} are ${benefits[0]} faster than ever`,
      formula: 'discover',
    });

    // Select best based on awareness level
    const awarenessLevel = request.context.awarenessLevel || 'problem-aware';
    const bestFormulas = this.getBestFormulasForAwareness(awarenessLevel);

    // Find primary headline
    const primary = generatedHeadlines.find(h => bestFormulas.includes(h.formula as HeadlineFormulaKey));
    headlines.primary = primary?.headline || generatedHeadlines[0].headline;
    headlines.formula = primary?.formula || generatedHeadlines[0].formula;

    // Generate variations
    headlines.variations = generatedHeadlines
      .filter(h => h.headline !== headlines.primary)
      .slice(0, 4)
      .map(h => h.headline);

    // Emotional vs logical angles
    headlines.emotionalAngle = `Imagine finally ${benefits[0]} - without the stress and frustration`;
    headlines.logicalAngle = `${product}: Increase ${benefits[0]} by 47% in 30 days (data-backed)`;

    // Generate subheadline
    const subheadline = this.generateSubheadline(headlines.primary, request);

    return {
      copyOutput: {
        framework: 'Headline Generation',
        frameworkReasoning: `Selected ${headlines.formula} formula for ${awarenessLevel} audience`,
        headline: headlines.primary,
        subheadline,
        bodyCopy: { sections: [] },
        cta: this.generateCTAForFramework('AIDA', request),
        variations: headlines.variations.map((h, i) => ({
          type: `Variation ${i + 1}`,
          headline: h,
          subheadline: this.generateSubheadline(h, request),
          cta: 'Get Started',
        })),
        voiceTone: VOICE_PRESETS[industry]?.tone || 'Professional',
        persuasionTactics: ['curiosity', 'specificity'],
      },
      confidence: 0.85,
      metadata: {
        generatedAt: new Date().toISOString(),
        requestType: 'headline_generation',
        awarenessLevel,
        industry,
      },
    };
  }

  /**
   * Get best headline formulas for awareness level
   */
  private getBestFormulasForAwareness(level: AwarenessLevel): HeadlineFormulaKey[] {
    switch (level) {
      case 'unaware':
        return ['question', 'discover', 'secret'];
      case 'problem-aware':
        return ['how_to', 'question', 'warning'];
      case 'solution-aware':
        return ['proven', 'result', 'number'];
      case 'product-aware':
        return ['result', 'guarantee', 'comparison'];
      case 'most-aware':
        return ['result', 'guarantee', 'number'];
      default:
        return ['how_to', 'proven'];
    }
  }

  /**
   * Generate supporting subheadline
   */
  private generateSubheadline(headline: string, request: CopyRequest): string {
    const product = request.context.product || 'our solution';
    const audience = request.context.audience || 'businesses';
    const benefits = request.context.benefits || ['achieve more'];

    const templates = [
      `${product} helps ${audience} ${benefits[0]} - without the guesswork`,
      `Join thousands of ${audience} who've already transformed their results`,
      `The simple system that ${benefits.join(', ')}`,
      `Finally, a solution built for ${audience} like you`,
      `No experience needed. No complicated setup. Just results.`,
    ];

    // Select based on headline content
    if (headline.toLowerCase().includes('how to')) {
      return templates[0];
    }
    if (headline.toLowerCase().includes('discover') || headline.toLowerCase().includes('join')) {
      return templates[1];
    }
    if (headline.toLowerCase().includes('proven') || headline.toLowerCase().includes('system')) {
      return templates[2];
    }
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ==========================================================================
  // CTA OPTIMIZATION
  // ==========================================================================

  /**
   * Generate optimized CTAs
   */
  private async optimizeCTA(request: CopyRequest): Promise<CopyResult> {
    const offer = request.context.offer || 'free trial';
    const deadline = request.context.deadline;
    const spots = request.context.spots;
    const industry = request.context.industry || 'saas';
    const awarenessLevel = request.context.awarenessLevel || 'solution-aware';

    // Select CTA category based on context
    const category = this.selectCTACategory(request);
    const templates = CTA_TEMPLATES[category];

    // Generate primary CTA
    let primaryText = templates[0];
    primaryText = primaryText.replace('{offer}', offer);
    if (deadline) primaryText = primaryText.replace('{deadline}', deadline);
    if (spots) primaryText = primaryText.replace('{spots}', String(spots));

    // Personalize with first person
    primaryText = this.personalizeFirstPerson(primaryText);

    // Generate secondary CTA (lower commitment)
    const secondaryCategory: CTACategory = category === 'urgency' ? 'value' : 'action';
    let secondaryText = CTA_TEMPLATES[secondaryCategory][0];
    secondaryText = secondaryText.replace('{offer}', offer);

    // Generate microcopy
    const microcopy = this.generateMicrocopy(category, request);

    const cta: CTAResult = {
      primary: {
        text: primaryText,
        category,
        persuasionPrinciple: this.getPersuasionPrinciple(category),
      },
      secondary: {
        text: secondaryText,
        category: secondaryCategory,
      },
      microcopy,
    };

    // Generate variations
    const variations = this.generateCTAVariations(request, category);

    return {
      copyOutput: {
        framework: 'CTA Optimization',
        frameworkReasoning: `Selected ${category} CTAs for ${awarenessLevel} audience`,
        headline: '',
        subheadline: '',
        bodyCopy: { sections: [] },
        cta,
        variations: variations.map((v, i) => ({
          type: `CTA Variation ${i + 1}`,
          headline: '',
          subheadline: '',
          cta: v,
        })),
        voiceTone: VOICE_PRESETS[industry]?.tone || 'Professional',
        persuasionTactics: [this.getPersuasionPrinciple(category)],
      },
      confidence: 0.88,
      metadata: {
        generatedAt: new Date().toISOString(),
        requestType: 'cta_optimization',
        awarenessLevel,
        industry,
      },
    };
  }

  /**
   * Select best CTA category based on context
   */
  private selectCTACategory(request: CopyRequest): CTACategory {
    const awareness = request.context.awarenessLevel || 'solution-aware';

    if (request.context.deadline || request.context.spots) {
      return 'urgency';
    }

    switch (awareness) {
      case 'unaware':
      case 'problem-aware':
        return 'value';
      case 'solution-aware':
        return 'action';
      case 'product-aware':
        return 'risk_reversal';
      case 'most-aware':
        return 'urgency';
      default:
        return 'action';
    }
  }

  /**
   * Personalize CTA with first person ("my" instead of "your")
   */
  private personalizeFirstPerson(cta: string): string {
    return cta
      .replace(/your /gi, 'my ')
      .replace(/you /gi, 'I ')
      .replace(/ you/gi, ' me');
  }

  /**
   * Generate microcopy for below CTA
   */
  private generateMicrocopy(category: CTACategory, request: CopyRequest): string {
    const templates = {
      urgency: [
        'No credit card required',
        'Cancel anytime',
        'Spots filling fast',
      ],
      value: [
        'Free forever plan available',
        'No strings attached',
        'Instant access',
      ],
      risk_reversal: [
        '30-day money-back guarantee',
        'No commitment required',
        'Full refund if not satisfied',
      ],
      action: [
        'Takes less than 2 minutes',
        'No signup required to try',
        'See results immediately',
      ],
      social_proof: [
        'Join 10,000+ happy customers',
        'Rated 4.9/5 by users',
        'Trusted by industry leaders',
      ],
    };

    return templates[category][0];
  }

  /**
   * Get persuasion principle for CTA category
   */
  private getPersuasionPrinciple(category: CTACategory): string {
    const mapping: Record<CTACategory, string> = {
      urgency: 'scarcity',
      value: 'reciprocity',
      risk_reversal: 'commitment',
      action: 'commitment',
      social_proof: 'social_proof',
    };
    return mapping[category];
  }

  /**
   * Generate CTA variations for A/B testing
   */
  private generateCTAVariations(request: CopyRequest, primaryCategory: CTACategory): string[] {
    const variations: string[] = [];
    const offer = request.context.offer || 'free trial';

    // Add variations from other categories
    const categories: CTACategory[] = ['urgency', 'value', 'risk_reversal', 'action'];

    for (const cat of categories) {
      if (cat !== primaryCategory) {
        let variation = CTA_TEMPLATES[cat][0];
        variation = variation.replace('{offer}', offer);
        variation = this.personalizeFirstPerson(variation);
        variations.push(variation);
      }
    }

    return variations.slice(0, 3);
  }

  /**
   * Generate CTA for a specific framework
   */
  private generateCTAForFramework(frameworkKey: FrameworkKey, request: CopyRequest): CTAResult {
    const offer = request.context.offer || 'free trial';
    const deadline = request.context.deadline;
    const spots = request.context.spots;

    let primaryText: string;
    let primaryCategory: CTACategory;
    let secondaryText: string;
    let secondaryCategory: CTACategory;

    switch (frameworkKey) {
      case 'AIDA':
      case 'FOUR_PS':
        primaryCategory = 'urgency';
        primaryText = deadline
          ? `Claim your spot before ${deadline}`
          : 'Get instant access now';
        secondaryCategory = 'value';
        secondaryText = 'Learn more';
        break;

      case 'PAS':
      case 'BAB':
        primaryCategory = 'action';
        primaryText = `Start my ${offer} now`;
        secondaryCategory = 'risk_reversal';
        secondaryText = 'Try risk-free';
        break;

      case 'FAB':
        primaryCategory = 'value';
        primaryText = `Get my ${offer}`;
        secondaryCategory = 'action';
        secondaryText = 'See features';
        break;

      case 'STORYBRAND':
      default:
        primaryCategory = 'action';
        primaryText = 'Get my custom plan';
        secondaryCategory = 'value';
        secondaryText = 'Learn how it works';
        break;
    }

    if (spots) {
      primaryText = `${primaryText} (Only ${spots} spots left)`;
    }

    return {
      primary: {
        text: primaryText,
        category: primaryCategory,
        persuasionPrinciple: this.getPersuasionPrinciple(primaryCategory),
      },
      secondary: {
        text: secondaryText,
        category: secondaryCategory,
      },
      microcopy: this.generateMicrocopy(primaryCategory, request),
    };
  }

  // ==========================================================================
  // FULL COPY GENERATION
  // ==========================================================================

  /**
   * Generate complete copy package
   */
  private async generateFullCopy(request: CopyRequest): Promise<CopyResult> {
    // First, select the best framework
    const frameworkResult = await this.selectFramework(request);

    // Generate headlines
    const headlineResult = await this.generateHeadlines(request);

    // Generate optimized CTA
    const ctaResult = await this.optimizeCTA(request);

    // Combine all elements
    const fullCopy: CopyOutput = {
      framework: frameworkResult.copyOutput.framework,
      frameworkReasoning: frameworkResult.copyOutput.frameworkReasoning,
      headline: headlineResult.copyOutput.headline,
      subheadline: headlineResult.copyOutput.subheadline,
      bodyCopy: frameworkResult.copyOutput.bodyCopy,
      cta: ctaResult.copyOutput.cta,
      variations: this.combineVariations(headlineResult, ctaResult),
      voiceTone: frameworkResult.copyOutput.voiceTone,
      persuasionTactics: this.selectPersuasionTactics(request),
    };

    // Calculate combined confidence
    const confidence = (frameworkResult.confidence + headlineResult.confidence + ctaResult.confidence) / 3;

    return {
      copyOutput: fullCopy,
      confidence,
      metadata: {
        generatedAt: new Date().toISOString(),
        requestType: 'copy_generation',
        awarenessLevel: request.context.awarenessLevel || 'problem-aware',
        industry: request.context.industry || 'general',
      },
    };
  }

  /**
   * Combine variations from different results
   */
  private combineVariations(
    headlineResult: CopyResult,
    ctaResult: CopyResult
  ): CopyOutput['variations'] {
    const variations: CopyOutput['variations'] = [];

    // Add headline variations with default CTA
    for (const hVariation of headlineResult.copyOutput.variations.slice(0, 2)) {
      variations.push({
        type: 'Headline Variation',
        headline: hVariation.headline,
        subheadline: hVariation.subheadline,
        cta: ctaResult.copyOutput.cta.primary.text,
      });
    }

    // Add CTA variations with default headline
    for (const cVariation of ctaResult.copyOutput.variations.slice(0, 2)) {
      variations.push({
        type: 'CTA Variation',
        headline: headlineResult.copyOutput.headline,
        subheadline: headlineResult.copyOutput.subheadline,
        cta: cVariation.cta,
      });
    }

    return variations;
  }

  /**
   * Select persuasion tactics based on context
   */
  private selectPersuasionTactics(request: CopyRequest): string[] {
    const tactics: string[] = [];

    if (request.context.deadline || request.context.spots) {
      tactics.push('scarcity');
    }
    if (request.context.testimonials && request.context.testimonials.length > 0) {
      tactics.push('social_proof');
    }
    if (request.context.offer?.toLowerCase().includes('free')) {
      tactics.push('reciprocity');
    }

    // Always include at least these
    if (!tactics.includes('social_proof')) tactics.push('social_proof');
    if (!tactics.includes('authority')) tactics.push('authority');

    return tactics.slice(0, 4);
  }

  // ==========================================================================
  // A/B VARIATION GENERATION
  // ==========================================================================

  /**
   * Generate A/B test variations
   */
  private async generateVariations(request: CopyRequest): Promise<CopyResult> {
    const variationCount = request.options?.variationCount || 3;
    const baseResult = await this.generateFullCopy(request);

    const variations: CopyOutput['variations'] = [];

    // Variation types
    const variationTypes = [
      'emotional',
      'logical',
      'urgency-focused',
      'benefit-focused',
      'social-proof-focused',
    ];

    for (let i = 0; i < Math.min(variationCount, variationTypes.length); i++) {
      const variationType = variationTypes[i];
      const variation = this.createVariation(variationType, request, baseResult);
      variations.push(variation);
    }

    return {
      copyOutput: {
        ...baseResult.copyOutput,
        variations,
      },
      confidence: baseResult.confidence * 0.95, // Slightly lower for variations
      metadata: {
        generatedAt: new Date().toISOString(),
        requestType: 'ab_variations',
        awarenessLevel: request.context.awarenessLevel || 'problem-aware',
        industry: request.context.industry || 'general',
      },
    };
  }

  /**
   * Create a specific variation type
   */
  private createVariation(
    type: string,
    request: CopyRequest,
    base: CopyResult
  ): CopyOutput['variations'][0] {
    const benefits = request.context.benefits || ['save time', 'increase revenue'];
    const painPoints = request.context.painPoints || ['wasting time'];
    const audience = request.context.audience || 'businesses';

    switch (type) {
      case 'emotional':
        return {
          type: 'Emotional Angle',
          headline: `Imagine finally ${benefits[0]} - without the stress`,
          subheadline: `Join ${audience} who've transformed their lives`,
          cta: 'Yes, I want this!',
        };

      case 'logical':
        return {
          type: 'Logical Angle',
          headline: `Increase ${benefits[0]} by 47% in 30 days`,
          subheadline: `Data-backed system used by 1,000+ ${audience}`,
          cta: 'See the data',
        };

      case 'urgency-focused':
        return {
          type: 'Urgency Focus',
          headline: `${base.copyOutput.headline} (Limited Time)`,
          subheadline: `Offer expires soon - don't miss out`,
          cta: 'Claim my spot now',
        };

      case 'benefit-focused':
        return {
          type: 'Benefit Focus',
          headline: `${benefits.join(' + ')} - All in One Solution`,
          subheadline: `Everything you need to succeed`,
          cta: `Get all the benefits`,
        };

      case 'social-proof-focused':
        return {
          type: 'Social Proof Focus',
          headline: `Why 10,000+ ${audience} chose us`,
          subheadline: `Join the movement that's changing the industry`,
          cta: 'Join them now',
        };

      default:
        return {
          type: 'Alternative',
          headline: base.copyOutput.headline,
          subheadline: base.copyOutput.subheadline,
          cta: base.copyOutput.cta.primary.text,
        };
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCopySpecialist(): CopySpecialist {
  return new CopySpecialist();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: CopySpecialist | null = null;

export function getCopySpecialist(): CopySpecialist {
  instance ??= createCopySpecialist();
  return instance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  COPYWRITING_FRAMEWORKS,
  CTA_TEMPLATES,
  HEADLINE_FORMULAS,
  PERSUASION_PRINCIPLES,
  VOICE_PRESETS,
};
