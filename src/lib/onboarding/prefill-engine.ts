/**
 * Onboarding Prefill Engine
 * 
 * SOVEREIGN CORPORATE BRAIN - EXCEPTION-BASED VALIDATION
 * 
 * This service implements "Exception-Based Validation" by leveraging the
 * Discovery Engine's 30-day cache to auto-prefill business information
 * during onboarding, creating a magical first-time user experience.
 * 
 * CONFIDENCE THRESHOLD LOGIC:
 * - Confidence > 0.9: Auto-fill with high certainty
 * - Confidence 0.7-0.9: Show suggestions, ask for confirmation
 * - Confidence < 0.7: Show as hints, user must manually enter
 * 
 * SIGNAL BUS INTEGRATION:
 * - Emits onboarding.started when prefill begins
 * - Emits onboarding.prefilled when data is auto-filled
 * - Feeds analytics for conversion optimization
 */

import { logger } from '@/lib/logger/logger';
import { discoverCompany, type DiscoveredCompany } from '@/lib/services/discovery-engine';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type { OnboardingFormData, PrefillResult, FieldConfidence } from './types';
import { CONFIDENCE_THRESHOLDS } from './constants';

/**
 * Company size mappings (employees)
 */
const COMPANY_SIZE_MAPPINGS: Record<string, string> = {
  '1-10': 'Micro (1-10 employees)',
  '10-50': 'Small (10-50 employees)',
  '50-200': 'Medium (50-200 employees)',
  '200-1000': 'Large (200-1000 employees)',
  '1000+': 'Enterprise (1000+ employees)',
  'Enterprise': 'Enterprise (1000+ employees)',
};

// ============================================================================
// MAIN PREFILL FUNCTION
// ============================================================================

/**
 * Prefill onboarding form data from website URL
 *
 * This is the main entry point for the Onboarding Prefill Engine.
 * It uses the Discovery Engine to scrape and analyze the website,
 * then maps the discovered data to onboarding form fields.
 *
 * @param websiteUrl - User's website URL
 * @returns Prefilled form data with confidence scores
 *
 * @example
 * ```typescript
 * const result = await prefillOnboardingData('https://stripe.com', 'org_123');
 * if (result.overallConfidence > 0.9) {
 *   console.log('High confidence prefill!');
 *   console.log(`Business Name: ${result.formData.businessName}`);
 * }
 * ```
 */
export async function prefillOnboardingData(
  websiteUrl: string
): Promise<PrefillResult> {
  try {
    logger.info('Starting onboarding prefill', {
      websiteUrl,
      source: 'prefill-engine',
    });

    // Emit onboarding.started signal
    await emitOnboardingStartedSignal(websiteUrl);

    // Step 1: Use Discovery Engine to scrape website (checks 30-day cache first)
    const discoveryResult = await discoverCompany(websiteUrl);
    const company = discoveryResult.company;

    logger.info('Discovery complete for onboarding prefill', {
      websiteUrl,
      fromCache: discoveryResult.fromCache,
      discoveryConfidence: company.metadata.confidence,
    });

    // Step 2: Map discovered data to onboarding form fields
    const prefillResult = mapCompanyToFormData(company);

    // Step 3: Calculate overall confidence score
    const overallConfidence = calculateOverallConfidence(prefillResult.fieldConfidences);

    const result: PrefillResult = {
      ...prefillResult,
      overallConfidence,
      discoveryMetadata: {
        scrapedAt: company.metadata.scrapedAt,
        fromCache: discoveryResult.fromCache,
        scrapeId: discoveryResult.scrapeId,
      },
    };

    // Step 4: Emit onboarding.prefilled signal
    await emitOnboardingPrefilledSignal(
      websiteUrl,
      overallConfidence,
      discoveryResult.fromCache
    );

    logger.info('Onboarding prefill complete', {
      websiteUrl,
      overallConfidence,
      highConfidenceFields: Object.values(prefillResult.fieldConfidences).filter(
        fc => fc.confidence >= CONFIDENCE_THRESHOLDS.HIGH
      ).length,
      mediumConfidenceFields: Object.values(prefillResult.fieldConfidences).filter(
        fc => fc.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM && fc.confidence < CONFIDENCE_THRESHOLDS.HIGH
      ).length,
    });

    return result;
  } catch (error) {
    logger.error('Failed to prefill onboarding data', error instanceof Error ? error : new Error(String(error)), {
      websiteUrl,
    });

    // Return empty prefill on error (don't block onboarding)
    return {
      formData: {},
      fieldConfidences: {},
      overallConfidence: 0,
      discoveryMetadata: {
        scrapedAt: new Date(),
        fromCache: false,
        scrapeId: '',
      },
    };
  }
}

// ============================================================================
// DATA MAPPING
// ============================================================================

/**
 * Map DiscoveredCompany to OnboardingFormData
 * 
 * This function intelligently maps the rich data from Discovery Engine
 * to the specific fields in the onboarding form. Each field gets a
 * confidence score based on data quality and completeness.
 */
function mapCompanyToFormData(company: DiscoveredCompany): {
  formData: Partial<OnboardingFormData>;
  fieldConfidences: Record<string, FieldConfidence>;
} {
  const formData: Partial<OnboardingFormData> = {};
  const fieldConfidences: Record<string, FieldConfidence> = {};

  // Step 1: Business Basics
  
  // Company Name
  if (company.companyName) {
    formData.businessName = company.companyName;
    fieldConfidences.businessName = {
      fieldName: 'businessName',
      confidence: 0.95, // High confidence - directly from discovery
      value: company.companyName,
      source: 'discovery-engine',
      suggestedAction: 'auto-fill',
    };
  }

  // Industry
  if (company.industry) {
    formData.industry = company.industry;
    fieldConfidences.industry = {
      fieldName: 'industry',
      confidence: 0.85, // Medium-high confidence - LLM-inferred
      value: company.industry,
      source: 'discovery-engine',
      suggestedAction: 'confirm',
    };
  }

  // Website
  formData.website = company.domain;
  fieldConfidences.website = {
    fieldName: 'website',
    confidence: 1.0, // Perfect confidence - user provided this
    value: company.domain,
    source: 'user-input',
    suggestedAction: 'auto-fill',
  };

  // Company Size
  if (company.size) {
    const mappedSize = COMPANY_SIZE_MAPPINGS[company.size] || company.size;
    formData.companySize = mappedSize;
    fieldConfidences.companySize = {
      fieldName: 'companySize',
      confidence: 0.75, // Medium confidence - estimated from signals
      value: mappedSize,
      source: 'discovery-engine',
      suggestedAction: 'confirm',
    };
  }

  // Location
  if (company.location) {
    formData.businessLocation = company.location;
    fieldConfidences.businessLocation = {
      fieldName: 'businessLocation',
      confidence: 0.9, // High confidence - usually visible on website
      value: company.location,
      source: 'discovery-engine',
      suggestedAction: 'auto-fill',
    };
  }

  // Contact Info
  if (company.contactInfo.email) {
    formData.contactEmail = company.contactInfo.email;
    fieldConfidences.contactEmail = {
      fieldName: 'contactEmail',
      confidence: 0.9,
      value: company.contactInfo.email,
      source: 'discovery-engine',
      suggestedAction: 'auto-fill',
    };
  }

  if (company.contactInfo.phone) {
    formData.contactPhone = company.contactInfo.phone;
    fieldConfidences.contactPhone = {
      fieldName: 'contactPhone',
      confidence: 0.85,
      value: company.contactInfo.phone,
      source: 'discovery-engine',
      suggestedAction: 'confirm',
    };
  }

  // Step 2: Business Understanding
  
  // Description → Problem Solved
  if (company.description) {
    // Transform description into "problem solved" format
    const problemSolved = inferProblemSolved(company.description, company.industry);
    formData.problemSolved = problemSolved;
    fieldConfidences.problemSolved = {
      fieldName: 'problemSolved',
      confidence: 0.7, // Medium confidence - inferred from description
      value: problemSolved,
      source: 'discovery-engine',
      suggestedAction: 'confirm',
    };
  }

  // Unique Value → inferred from description + tech stack
  if (company.description || company.techStack.length > 0) {
    const uniqueValue = inferUniqueValue(company);
    formData.uniqueValue = uniqueValue;
    fieldConfidences.uniqueValue = {
      fieldName: 'uniqueValue',
      confidence: 0.65, // Lower confidence - requires interpretation
      value: uniqueValue,
      source: 'discovery-engine',
      suggestedAction: 'hint',
    };
  }

  // Step 3: Target Customer (from signals and size)
  if (company.size || company.industry) {
    const targetCustomer = inferTargetCustomer(company);
    formData.targetCustomer = targetCustomer;
    fieldConfidences.targetCustomer = {
      fieldName: 'targetCustomer',
      confidence: 0.6, // Lower confidence - educated guess
      value: targetCustomer,
      source: 'discovery-engine',
      suggestedAction: 'hint',
    };
  }

  // Step 4: Growth Indicators → Why Buy / Why Not Buy
  if (company.signals.growthIndicators.length > 0) {
    const whyBuy = company.signals.growthIndicators.slice(0, 3).join(', ');
    formData.whyBuy = whyBuy;
    fieldConfidences.whyBuy = {
      fieldName: 'whyBuy',
      confidence: 0.7,
      value: whyBuy,
      source: 'discovery-engine',
      suggestedAction: 'hint',
    };
  }

  // Tech Stack → Technical Capabilities
  if (company.techStack.length > 0) {
    const techCapabilities = company.techStack
      .slice(0, 5)
      .map(t => t.name)
      .join(', ');
    formData.technicalCapabilities = techCapabilities;
    fieldConfidences.technicalCapabilities = {
      fieldName: 'technicalCapabilities',
      confidence: 0.85, // High confidence for detected tech
      value: techCapabilities,
      source: 'discovery-engine',
      suggestedAction: 'confirm',
    };
  }

  return { formData, fieldConfidences };
}

// ============================================================================
// INFERENCE HELPERS
// ============================================================================

/**
 * Infer "problem solved" from company description and industry
 */
function inferProblemSolved(description: string, industry?: string): string {
  // Simple heuristic: extract the first sentence or main value prop
  const sentences = description.split(/[.!?]/);
  const mainSentence = sentences[0]?.trim() || description;
  
  if (industry?.toLowerCase().includes('saas') || industry?.toLowerCase().includes('software')) {
    return `Helps ${industry.toLowerCase()} businesses ${mainSentence.toLowerCase()}`;
  }
  
  return mainSentence;
}

/**
 * Infer unique value proposition from company data
 */
function inferUniqueValue(company: DiscoveredCompany): string {
  const elements: string[] = [];
  
  // Add key differentiators
  if (company.techStack.length > 3) {
    elements.push(`Advanced tech stack (${company.techStack.length} technologies)`);
  }
  
  if (company.teamMembers.length > 0) {
    elements.push(`Team of ${company.teamMembers.length} professionals`);
  }
  
  if (company.signals.isHiring && company.signals.jobCount > 5) {
    elements.push(`Rapidly growing (${company.signals.jobCount} open positions)`);
  }
  
  if (company.pressmentions.length > 0) {
    elements.push(`Featured in ${company.pressmentions.length} press mentions`);
  }
  
  return elements.length > 0 
    ? elements.join('. ') 
    :(company.description !== '' && company.description != null) ? company.description : 'Innovative solutions for modern businesses';
}

/**
 * Infer target customer from company profile
 */
function inferTargetCustomer(company: DiscoveredCompany): string {
  const industry = company.industry?.toLowerCase() ?? '';
  const size = company.size?.toLowerCase() ?? '';
  
  // Industry-based target customer inference
  if (industry.includes('saas') || industry.includes('b2b')) {
    if (size.includes('enterprise') || size.includes('1000+')) {
      return 'Enterprise businesses (1000+ employees)';
    } else if (size.includes('200')) {
      return 'Mid-market businesses (200-1000 employees)';
    } else {
      return 'Small to medium businesses (10-200 employees)';
    }
  }
  
  if (industry.includes('ecommerce') || industry.includes('retail')) {
    return 'Online shoppers and retail customers';
  }
  
  if (industry.includes('healthcare')) {
    return 'Healthcare providers and patients';
  }
  
  if (industry.includes('fintech') || industry.includes('finance')) {
    return 'Financial services customers and businesses';
  }
  
  // Default fallback
  return `Businesses and professionals in ${  industry || 'various industries'}`;
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate overall confidence score from field confidences
 * 
 * Uses weighted average:
 * - Critical fields (name, industry, website): 2x weight
 * - Important fields (size, location, contact): 1.5x weight
 * - Nice-to-have fields: 1x weight
 */
function calculateOverallConfidence(
  fieldConfidences: Record<string, FieldConfidence>
): number {
  const criticalFields = ['businessName', 'industry', 'website'];
  const importantFields = ['companySize', 'businessLocation', 'contactEmail'];
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const [fieldName, fc] of Object.entries(fieldConfidences)) {
    let weight = 1;
    
    if (criticalFields.includes(fieldName)) {
      weight = 2;
    } else if (importantFields.includes(fieldName)) {
      weight = 1.5;
    }
    
    weightedSum += fc.confidence * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Get suggested action for a field based on confidence threshold
 */
export function getSuggestedAction(confidence: number): 'auto-fill' | 'confirm' | 'hint' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'auto-fill';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'confirm';
  } else {
    return 'hint';
  }
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit onboarding.started signal
 */
async function emitOnboardingStartedSignal(
  websiteUrl: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'onboarding.started',
      confidence: 1.0,
      priority: 'Medium',
      metadata: {
        source: 'prefill-engine',
        websiteUrl,
        startedAt: new Date().toISOString(),
      },
    });

    logger.info('Emitted onboarding.started signal', {
      websiteUrl,
    });
  } catch (error) {
    // Don't fail prefill if signal emission fails
    logger.error('Failed to emit onboarding.started signal', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Emit onboarding.prefilled signal
 */
async function emitOnboardingPrefilledSignal(
  websiteUrl: string,
  overallConfidence: number,
  fromCache: boolean
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'onboarding.prefilled',
      confidence: overallConfidence,
      priority: overallConfidence >= CONFIDENCE_THRESHOLDS.HIGH ? 'High' : 'Medium',
      metadata: {
        source: 'prefill-engine',
        websiteUrl,
        overallConfidence,
        fromCache,
        prefilledAt: new Date().toISOString(),
        confidenceLevel: overallConfidence >= CONFIDENCE_THRESHOLDS.HIGH
          ? 'high'
          : overallConfidence >= CONFIDENCE_THRESHOLDS.MEDIUM
            ? 'medium'
            : 'low',
      },
    });

    logger.info('Emitted onboarding.prefilled signal', {
      websiteUrl,
      overallConfidence,
      fromCache,
    });
  } catch (error) {
    // Don't fail prefill if signal emission fails
    logger.error('Failed to emit onboarding.prefilled signal', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Emit onboarding.completed signal
 * 
 * This should be called by the onboarding page when user completes setup.
 */
export async function emitOnboardingCompletedSignal(
  completedData: {
    websiteUrl: string;
    usedPrefill: boolean;
    stepsCompleted: number;
    totalSteps: number;
  }
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'onboarding.completed',
      confidence: 1.0,
      priority: 'High',
      metadata: {
        source: 'onboarding-flow',
        ...completedData,
        completedAt: new Date().toISOString(),
      },
    });

    logger.info('Emitted onboarding.completed signal', {
      ...completedData,
    });
  } catch (error) {
    // Don't fail onboarding completion if signal emission fails
    logger.error('Failed to emit onboarding.completed signal', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Emit onboarding.abandoned signal
 * 
 * This should be called if user leaves onboarding without completing.
 */
export async function emitOnboardingAbandonedSignal(
  abandonedData: {
    websiteUrl?: string;
    lastStepCompleted: number;
    totalSteps: number;
    timeSpentMs: number;
  }
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    await coordinator.emitSignal({
      type: 'onboarding.abandoned',
      confidence: 1.0,
      priority: 'Low',
      metadata: {
        source: 'onboarding-flow',
        ...abandonedData,
        abandonedAt: new Date().toISOString(),
      },
    });
    
    logger.info('Emitted onboarding.abandoned signal', {
      ...abandonedData,
    });
  } catch (error) {
    // Don't fail on signal emission
    logger.error('Failed to emit onboarding.abandoned signal', error instanceof Error ? error : new Error(String(error)), {
      file: 'prefill-engine.ts',
    });
  }
}
