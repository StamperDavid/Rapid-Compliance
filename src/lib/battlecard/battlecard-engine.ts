/**
 * Battlecard Engine - Competitive Intelligence System
 * 
 * SOVEREIGN CORPORATE BRAIN - SALES INTELLIGENCE MODULE
 * 
 * This engine provides AI-powered competitive intelligence for sales teams.
 * It scrapes competitor websites, extracts positioning data, and generates
 * actionable battlecards for head-to-head comparisons.
 * 
 * CAPABILITIES:
 * - Competitor discovery via Discovery Engine
 * - Feature extraction and comparison
 * - Pricing intelligence
 * - Positioning analysis
 * - Strengths/weaknesses identification
 * - Objection handling recommendations
 * - Talk tracks generation
 * - Real-time competitor monitoring via Signal Bus
 * 
 * HUNTER-CLOSER COMPLIANCE:
 * - 100% native scraping (no third-party APIs)
 * - 30-day cache via Discovery Engine
 * - LLM-powered analysis for insights
 * - Proprietary competitive moat
 */

import { logger } from '@/lib/logger/logger';
import { discoverCompany, type DiscoveredCompany } from '@/lib/services/discovery-engine';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Competitor Profile
 * 
 * Comprehensive competitive intelligence for a single competitor
 */
export interface CompetitorProfile {
  id: string;
  // Basic Info
  domain: string;
  companyName: string;
  description?: string;
  industry?: string;
  size?: string;
  location?: string;
  
  // Product Intelligence
  productOffering: {
    productName?: string;
    category: string;
    targetMarket: string[]; // e.g., ['SMB', 'Mid-Market', 'Enterprise']
    verticals: string[]; // e.g., ['SaaS', 'E-commerce', 'Healthcare']
    keyFeatures: Array<{
      feature: string;
      description: string;
      category: 'core' | 'premium' | 'enterprise' | 'addon';
    }>;
  };
  
  // Pricing Intelligence
  pricing: {
    model: 'freemium' | 'subscription' | 'usage-based' | 'one-time' | 'custom' | 'unknown';
    tiers: Array<{
      name: string;
      price?: string;
      billingCycle?: 'monthly' | 'annually' | 'one-time';
      features: string[];
      targetSegment?: string;
    }>;
    hasFreeTrial: boolean;
    trialDuration?: string;
    competitivePosition: 'premium' | 'mid-market' | 'budget' | 'unknown';
  };
  
  // Positioning Intelligence
  positioning: {
    tagline?: string;
    valueProposition: string[];
    differentiators: string[];
    targetPersonas: string[];
    useCases: string[];
  };
  
  // Strengths & Weaknesses
  analysis: {
    strengths: Array<{
      strength: string;
      impact: 'high' | 'medium' | 'low';
      evidence: string;
    }>;
    weaknesses: Array<{
      weakness: string;
      impact: 'high' | 'medium' | 'low';
      evidence: string;
      howToExploit: string;
    }>;
  };
  
  // Tech Stack
  techStack: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  
  // Social Proof
  socialProof: {
    customerCount?: string;
    notableCustomers: string[];
    awards: string[];
    pressmentions: Array<{
      title: string;
      date?: string;
      summary?: string;
    }>;
    fundingRaised?: string;
    fundingStage?: string;
  };
  
  // Growth Signals
  growthSignals: {
    isHiring: boolean;
    jobCount: number;
    recentActivity: string[];
    expansionPlans: string[];
  };
  
  // Metadata
  metadata: {
    scrapedAt: Date;
    expiresAt: Date;
    confidence: number;
    source: 'battlecard-engine';
    lastUpdated: Date;
  };
}

/**
 * Battlecard - Head-to-Head Comparison
 * 
 * Generated battlecard comparing our solution vs. competitor
 */
export interface Battlecard {
  id: string;
  // Comparison Context
  ourProduct: string;
  competitorId: string;
  competitorName: string;
  competitorDomain: string;
  
  // Feature Comparison
  featureComparison: Array<{
    category: string;
    features: Array<{
      featureName: string;
      us: 'yes' | 'no' | 'partial' | 'unknown';
      them: 'yes' | 'no' | 'partial' | 'unknown';
      advantage: 'us' | 'them' | 'neutral';
      notes?: string;
    }>;
  }>;
  
  // Pricing Comparison
  pricingComparison: {
    ourPositioning: string;
    theirPositioning: string;
    advantage: 'us' | 'them' | 'neutral';
    keyDifferences: string[];
    valueJustification: string[];
  };
  
  // Battle Tactics
  tactics: {
    // When to win
    idealSituations: Array<{
      situation: string;
      reasoning: string;
      talkTrack: string;
    }>;
    
    // When they might win
    challengingSituations: Array<{
      situation: string;
      reasoning: string;
      mitigation: string;
    }>;
    
    // Common objections
    objectionHandling: Array<{
      objection: string;
      response: string;
      proofPoints: string[];
    }>;
    
    // Competitive traps
    competitiveTraps: Array<{
      trap: string;
      setup: string;
      delivery: string;
    }>;
  };
  
  // Discovery Questions
  discoveryQuestions: {
    // Questions to qualify if we can win
    qualifyingQuestions: string[];
    
    // Questions to expose competitor weaknesses
    landmineQuestions: string[];
  };
  
  // Key Messages
  keyMessages: {
    elevator: string; // 30-second pitch vs. competitor
    executiveSummary: string; // Why we win
    riskMitigation: string[]; // Addressing concerns about switching
  };
  
  // Metadata
  metadata: {
    generatedAt: Date;
    expiresAt: Date;
    confidence: number;
    source: 'battlecard-engine';
    version: number;
  };
}

/**
 * Battlecard Generation Options
 */
export interface BattlecardOptions {
  ourProduct: string;
  ourCompanyInfo?: {
    strengths?: string[];
    features?: string[];
    pricing?: string;
    targetMarket?: string[];
  };
  focusAreas?: ('features' | 'pricing' | 'positioning' | 'objections')[];
  includeAdvanced?: boolean; // Generate competitive traps and landmine questions
}

// ============================================================================
// COMPETITOR DISCOVERY & PROFILING
// ============================================================================

/**
 * Discover and profile a competitor
 *
 * Uses Discovery Engine to scrape competitor website and LLM to extract
 * competitive intelligence.
 *
 * @param domain - Competitor domain (e.g., 'competitor.com')
 * @returns Complete competitor profile with analysis
 *
 * @example
 * ```typescript
 * const profile = await discoverCompetitor('salesforce.com', 'org_123');
 * console.log(`Found ${profile.productOffering.keyFeatures.length} features`);
 * console.log(`Weaknesses: ${profile.analysis.weaknesses.length}`);
 * ```
 */
export async function discoverCompetitor(
  domain: string
): Promise<CompetitorProfile> {
  try {
    logger.info('Starting competitor discovery', {
      domain,
      source: 'battlecard-engine',
    });

    // Step 1: Use Discovery Engine to scrape competitor (leverages 30-day cache)
    const discoveryResult = await discoverCompany(domain);
    const { company, fromCache } = discoveryResult;

    logger.info('Competitor website scraped', {
      domain,
      fromCache,
      teamMembersFound: company.teamMembers.length,
      techStackFound: company.techStack.length,
    });

    // Step 2: Extract competitive intelligence with LLM
    const competitiveIntel = await extractCompetitiveIntelligence(company);

    // Step 3: Combine into CompetitorProfile
    const profile: CompetitorProfile = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      domain: company.domain,
      companyName:company.companyName ?? domain,
      description: company.description,
      industry: company.industry,
      size: company.size,
      location: company.location,
      
      productOffering:competitiveIntel.productOffering ?? {
        category: 'Unknown',
        targetMarket: [],
        verticals: [],
        keyFeatures: [],
      },
      
      pricing:competitiveIntel.pricing ?? {
        model: 'unknown',
        tiers: [],
        hasFreeTrial: false,
        competitivePosition: 'unknown',
      },
      
      positioning:competitiveIntel.positioning ?? {
        valueProposition: [],
        differentiators: [],
        targetPersonas: [],
        useCases: [],
      },
      
      analysis:competitiveIntel.analysis ?? {
        strengths: [],
        weaknesses: [],
      },
      
      techStack: company.techStack,
      
      socialProof: {
        customerCount: competitiveIntel.socialProof?.customerCount,
        notableCustomers: competitiveIntel.socialProof?.notableCustomers ?? [],
        awards: competitiveIntel.socialProof?.awards ?? [],
        pressmentions: company.pressmentions,
        fundingRaised: competitiveIntel.socialProof?.fundingRaised,
        fundingStage: company.signals.fundingStage,
      },
      
      growthSignals: {
        isHiring: company.signals.isHiring,
        jobCount: company.signals.jobCount,
        recentActivity: company.signals.growthIndicators,
        expansionPlans: competitiveIntel.growthSignals?.expansionPlans ?? [],
      },
      
      metadata: {
        scrapedAt: company.metadata.scrapedAt,
        expiresAt: company.metadata.expiresAt,
        confidence: company.metadata.confidence,
        source: 'battlecard-engine',
        lastUpdated: new Date(),
      },
    };

    logger.info('Competitor profile complete', {
      domain,
      featuresFound: profile.productOffering.keyFeatures.length,
      strengthsFound: profile.analysis.strengths.length,
      weaknessesFound: profile.analysis.weaknesses.length,
      confidence: profile.metadata.confidence,
    });

    // Emit Signal Bus signal
    await emitCompetitorDiscoverySignal(profile, fromCache);

    return profile;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to discover competitor', err, {
      domain,
    });

    const errorMessage = err.message;
    throw new Error(`Failed to discover competitor ${domain}: ${errorMessage}`);
  }
}

// ============================================================================
// LLM COMPETITIVE INTELLIGENCE EXTRACTION
// ============================================================================

/**
 * Extract competitive intelligence from discovered company data
 * 
 * Uses LLM to analyze scraped data and extract:
 * - Product features and positioning
 * - Pricing model and tiers
 * - Strengths and weaknesses
 * - Competitive differentiators
 */
async function extractCompetitiveIntelligence(
  company: DiscoveredCompany
): Promise<Partial<CompetitorProfile>> {
  try {
    logger.info('Extracting competitive intelligence with LLM', {
      domain: company.domain,
    });

    const prompt = `You are a competitive intelligence analyst. Analyze this competitor data and extract strategic insights.

COMPETITOR: ${company.companyName} (${company.domain})
INDUSTRY: ${(company.industry !== '' && company.industry != null) ? company.industry : 'Unknown'}
DESCRIPTION: ${(company.description !== '' && company.description != null) ? company.description : 'Not available'}
SIZE: ${(company.size !== '' && company.size != null) ? company.size : 'Unknown'}
TECH STACK: ${company.techStack.map(t => t.name).join(', ') || 'Not detected'}
PRESS MENTIONS: ${company.pressmentions.length} found
HIRING: ${company.signals.isHiring ? `Yes (${company.signals.jobCount} openings)` : 'No'}

Extract the following intelligence in JSON format:

{
  "productOffering": {
    "productName": "string (their main product name)",
    "category": "string (SaaS, E-commerce Platform, CRM, etc.)",
    "targetMarket": ["string array - SMB/Mid-Market/Enterprise"],
    "verticals": ["string array - industries they serve"],
    "keyFeatures": [
      {
        "feature": "string (feature name)",
        "description": "string (what it does)",
        "category": "core|premium|enterprise|addon"
      }
    ]
  },
  "pricing": {
    "model": "freemium|subscription|usage-based|one-time|custom|unknown",
    "tiers": [
      {
        "name": "string (tier name)",
        "price": "string (e.g., '$99/month' or 'Contact Sales')",
        "billingCycle": "monthly|annually|one-time",
        "features": ["string array of included features"],
        "targetSegment": "string (who this tier is for)"
      }
    ],
    "hasFreeTrial": boolean,
    "trialDuration": "string (e.g., '14 days', '30 days')",
    "competitivePosition": "premium|mid-market|budget|unknown"
  },
  "positioning": {
    "tagline": "string (their main tagline/slogan)",
    "valueProposition": ["string array - key value props"],
    "differentiators": ["string array - what makes them unique"],
    "targetPersonas": ["string array - who they sell to (e.g., 'Marketing Directors', 'CTOs')"],
    "useCases": ["string array - specific use cases they highlight"]
  },
  "analysis": {
    "strengths": [
      {
        "strength": "string (what they do well)",
        "impact": "high|medium|low",
        "evidence": "string (proof from website/data)"
      }
    ],
    "weaknesses": [
      {
        "weakness": "string (gap or weakness)",
        "impact": "high|medium|low",
        "evidence": "string (proof from website/data)",
        "howToExploit": "string (how a competitor could exploit this)"
      }
    ]
  },
  "socialProof": {
    "customerCount": "string (e.g., '10,000+ customers', 'Unknown')",
    "notableCustomers": ["string array - recognizable brand names"],
    "awards": ["string array - awards/certifications"],
    "fundingRaised": "string (e.g., '$50M Series B', 'Unknown')"
  },
  "growthSignals": {
    "expansionPlans": ["string array - geographic/product expansion signals"]
  }
}

IMPORTANT:
- Be objective and fact-based
- Extract only information present in the data
- If data is not available, use null or empty arrays
- For weaknesses, think like a competitor - what gaps can be exploited?
- For strengths, acknowledge where they excel
- Return ONLY valid JSON, no markdown, no explanations`;

    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a competitive intelligence expert specializing in SaaS and B2B markets. You extract actionable insights from competitor data.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 3000,
    });

    // Parse LLM response
    try {
      const content = response.text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intel = JSON.parse(jsonMatch[0]) as Partial<CompetitorProfile>;
        logger.info('Competitive intelligence extracted', {
          domain: company.domain,
          featuresFound: intel.productOffering?.keyFeatures?.length ?? 0,
          strengthsFound: intel.analysis?.strengths?.length ?? 0,
          weaknessesFound: intel.analysis?.weaknesses?.length ?? 0,
        });
        return intel;
      }
    } catch (parseError) {
      logger.warn('Failed to parse competitive intelligence LLM response', {
        domain: company.domain,
        error: parseError instanceof Error ? parseError.message : 'Unknown',
      });
    }

    return {};
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to extract competitive intelligence', err, {
      domain: company.domain,
    });
    return {};
  }
}

// ============================================================================
// BATTLECARD GENERATION
// ============================================================================

/**
 * Generate battlecard comparing our product vs. competitor
 * 
 * Uses LLM to create actionable sales battlecard with talk tracks,
 * objection handling, and competitive traps.
 * 
 * @param competitorProfile - Competitor intelligence from discoverCompetitor()
 * @param options - Battlecard generation options
 * @returns Complete battlecard with tactics and messaging
 * 
 * @example
 * ```typescript
 * const battlecard = await generateBattlecard(profile, {
 *   ourProduct: 'SalesVelocity',
 *   ourCompanyInfo: {
 *     strengths: ['AI-powered automation', 'Native discovery engine'],
 *     pricing: 'Mid-market positioning'
 *   },
 *   includeAdvanced: true
 * });
 * ```
 */
export async function generateBattlecard(
  competitorProfile: CompetitorProfile,
  options: BattlecardOptions
): Promise<Battlecard> {
  try {
    logger.info('Generating battlecard', {
      competitor: competitorProfile.companyName,
      ourProduct: options.ourProduct,
    });

    // Build LLM prompt for battlecard generation
    const prompt = buildBattlecardPrompt(competitorProfile, options);

    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: buildBattlecardSystemPrompt(options.includeAdvanced),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 4000,
    });

    // Parse battlecard from LLM response
    let battlecardData: Partial<Battlecard>;
    try {
      const content = response.text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        battlecardData = JSON.parse(jsonMatch[0]) as Partial<Battlecard>;
      } else {
        throw new Error('No JSON found in LLM response');
      }
    } catch (parseError) {
      const err = parseError instanceof Error ? parseError : new Error(String(parseError));
      logger.error('Failed to parse battlecard LLM response', err, {
        competitor: competitorProfile.companyName,
      });
      throw new Error('Failed to generate battlecard: Invalid LLM response');
    }

    // Construct final battlecard
    const battlecard: Battlecard = {
      id: `bc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ourProduct: options.ourProduct,
      competitorId: competitorProfile.id,
      competitorName: competitorProfile.companyName,
      competitorDomain: competitorProfile.domain,
      
      featureComparison: battlecardData.featureComparison ?? [],
      pricingComparison:battlecardData.pricingComparison ?? {
        ourPositioning: '',
        theirPositioning: '',
        advantage: 'neutral',
        keyDifferences: [],
        valueJustification: [],
      },
      
      tactics:battlecardData.tactics ?? {
        idealSituations: [],
        challengingSituations: [],
        objectionHandling: [],
        competitiveTraps: [],
      },
      
      discoveryQuestions:battlecardData.discoveryQuestions ?? {
        qualifyingQuestions: [],
        landmineQuestions: [],
      },
      
      keyMessages:battlecardData.keyMessages ?? {
        elevator: '',
        executiveSummary: '',
        riskMitigation: [],
      },
      
      metadata: {
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        confidence: competitorProfile.metadata.confidence,
        source: 'battlecard-engine',
        version: 1,
      },
    };

    logger.info('Battlecard generated successfully', {
      competitor: competitorProfile.companyName,
      featureCategories: battlecard.featureComparison.length,
      objectionHandlers: battlecard.tactics.objectionHandling.length,
      competitiveTraps: battlecard.tactics.competitiveTraps.length,
    });

    // Emit Signal Bus signal
    await emitBattlecardGeneratedSignal(battlecard);

    return battlecard;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to generate battlecard', err, {
      competitor: competitorProfile.companyName,
    });

    const errorMessage = err.message;
    throw new Error(`Failed to generate battlecard: ${errorMessage}`);
  }
}

/**
 * Build system prompt for battlecard generation
 */
function buildBattlecardSystemPrompt(includeAdvanced?: boolean): string {
  const basePrompt = `You are an elite sales enablement strategist specializing in competitive battlecards. You create actionable, field-tested battlecards that help sales reps win deals.

Your battlecards are:
- ACTIONABLE: Every insight has a specific talk track or action
- EVIDENCE-BASED: Backed by competitive intelligence, not assumptions
- TACTICAL: Focus on winning deals, not just feature lists
- HONEST: Acknowledge where competitors are strong
- STRATEGIC: Identify situations where we win vs. where they might win`;

  if (includeAdvanced) {
    return `${basePrompt}

ADVANCED MODE: You also create:
- COMPETITIVE TRAPS: Questions/scenarios that expose competitor weaknesses
- LANDMINE QUESTIONS: Discovery questions that disqualify the competitor
- REPOSITIONING: How to reframe the buying criteria in our favor`;
  }

  return basePrompt;
}

/**
 * Build battlecard generation prompt
 */
function buildBattlecardPrompt(
  competitor: CompetitorProfile,
  options: BattlecardOptions
): string {
  const ourInfo = options.ourCompanyInfo ?? {};
  
  return `Generate a competitive battlecard for a sales scenario.

OUR PRODUCT: ${options.ourProduct}
${ourInfo.strengths ? `OUR STRENGTHS:\n${ourInfo.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : ''}
${ourInfo.features ? `OUR KEY FEATURES:\n${ourInfo.features.map((f, i) => `${i + 1}. ${f}`).join('\n')}` : ''}
${ourInfo.pricing ? `OUR PRICING: ${ourInfo.pricing}` : ''}
${ourInfo.targetMarket ? `OUR TARGET MARKET: ${ourInfo.targetMarket.join(', ')}` : ''}

COMPETITOR: ${competitor.companyName} (${competitor.domain})

COMPETITOR INTELLIGENCE:
- Product: ${competitor.productOffering.category}
- Target Market: ${competitor.productOffering.targetMarket.join(', ')}
- Key Features: ${competitor.productOffering.keyFeatures.map(f => f.feature).join(', ')}
- Pricing Model: ${competitor.pricing.model}
- Pricing Tiers: ${competitor.pricing.tiers.length} tiers (${competitor.pricing.competitivePosition} positioning)
- Value Props: ${competitor.positioning.valueProposition.join(', ')}

COMPETITOR STRENGTHS:
${competitor.analysis.strengths.map((s, i) => `${i + 1}. ${s.strength} (${s.impact} impact) - ${s.evidence}`).join('\n')}

COMPETITOR WEAKNESSES:
${competitor.analysis.weaknesses.map((w, i) => `${i + 1}. ${w.weakness} (${w.impact} impact) - ${w.evidence}\n   How to exploit: ${w.howToExploit}`).join('\n')}

Generate a JSON battlecard with this structure:

{
  "featureComparison": [
    {
      "category": "string (e.g., 'Core Features', 'Analytics', 'Integrations')",
      "features": [
        {
          "featureName": "string",
          "us": "yes|no|partial|unknown",
          "them": "yes|no|partial|unknown",
          "advantage": "us|them|neutral",
          "notes": "string (1-2 sentences on significance)"
        }
      ]
    }
  ],
  "pricingComparison": {
    "ourPositioning": "string (describe our pricing strategy)",
    "theirPositioning": "string (describe their pricing strategy)",
    "advantage": "us|them|neutral",
    "keyDifferences": ["string array - key pricing differences"],
    "valueJustification": ["string array - why our pricing is justified"]
  },
  "tactics": {
    "idealSituations": [
      {
        "situation": "string (when we win)",
        "reasoning": "string (why we win)",
        "talkTrack": "string (what to say to prospect)"
      }
    ],
    "challengingSituations": [
      {
        "situation": "string (when they might win)",
        "reasoning": "string (why they might win)",
        "mitigation": "string (how to counter)"
      }
    ],
    "objectionHandling": [
      {
        "objection": "string (common objection)",
        "response": "string (how to respond)",
        "proofPoints": ["string array - evidence to support response"]
      }
    ],
    "competitiveTraps": [
      {
        "trap": "string (name of trap)",
        "setup": "string (how to set it up in conversation)",
        "delivery": "string (how to execute)"
      }
    ]
  },
  "discoveryQuestions": {
    "qualifyingQuestions": [
      "string array - questions to ask to see if we can win"
    ],
    "landmineQuestions": [
      "string array - questions that expose competitor weaknesses"
    ]
  },
  "keyMessages": {
    "elevator": "string (30-second pitch: why choose us over them)",
    "executiveSummary": "string (2-3 sentences: strategic reasons to choose us)",
    "riskMitigation": [
      "string array - addressing concerns about choosing us over incumbent/competitor"
    ]
  }
}

IMPORTANT:
- Be specific and actionable
- Include 3-5 items per section minimum
- Talk tracks should be conversational, not robotic
- Competitive traps should be ethical but effective
- Landmine questions should feel like natural discovery
- Return ONLY valid JSON, no markdown`;
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit competitor discovery signal
 */
async function emitCompetitorDiscoverySignal(
  profile: CompetitorProfile,
  fromCache: boolean
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'competitor.discovered',
      confidence: profile.metadata.confidence,
      priority: fromCache ? 'Low' : 'Medium',
      metadata: {
        source: 'battlecard-engine',
        competitorId: profile.id,
        competitorName: profile.companyName,
        domain: profile.domain,
        industry: profile.industry,
        size: profile.size,
        productCategory: profile.productOffering.category,
        pricingModel: profile.pricing.model,
        strengthsCount: profile.analysis.strengths.length,
        weaknessesCount: profile.analysis.weaknesses.length,
        fromCache,
        scrapedAt: profile.metadata.scrapedAt.toISOString(),
      },
    });

    logger.info('Competitor discovery signal emitted', {
      competitorName: profile.companyName,
      fromCache,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to emit competitor discovery signal', err, {
      competitorName: profile.companyName,
    });
  }
}

/**
 * Emit battlecard generated signal
 */
async function emitBattlecardGeneratedSignal(
  battlecard: Battlecard
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'battlecard.generated',
      confidence: battlecard.metadata.confidence,
      priority: 'Medium',
      metadata: {
        source: 'battlecard-engine',
        battlecardId: battlecard.id,
        ourProduct: battlecard.ourProduct,
        competitorName: battlecard.competitorName,
        competitorDomain: battlecard.competitorDomain,
        featureCategories: battlecard.featureComparison.length,
        objectionHandlers: battlecard.tactics.objectionHandling.length,
        competitiveTraps: battlecard.tactics.competitiveTraps.length,
        generatedAt: battlecard.metadata.generatedAt.toISOString(),
      },
    });

    logger.info('Battlecard generated signal emitted', {
      battlecardId: battlecard.id,
      competitorName: battlecard.competitorName,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to emit battlecard generated signal', err, {
      battlecardId: battlecard.id,
    });
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Discover multiple competitors in batch
 */
export async function discoverCompetitorsBatch(
  domains: string[],
  options: {
    concurrency?: number;
    delayMs?: number;
  } = {}
): Promise<CompetitorProfile[]> {
  const { concurrency = 2, delayMs = 3000 } = options;

  logger.info('Starting batch competitor discovery', {
    domainsCount: domains.length,
    concurrency,
  });

  const results: CompetitorProfile[] = [];

  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(domain => discoverCompetitor(domain))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error('Batch competitor discovery failed', result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
      }
    }

    if (i + concurrency < domains.length) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), delayMs);
      });
    }
  }

  logger.info('Batch competitor discovery complete', {
    totalDomains: domains.length,
    successCount: results.length,
    failedCount: domains.length - results.length,
  });

  return results;
}
