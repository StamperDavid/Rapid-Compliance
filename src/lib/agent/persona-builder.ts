/**
 * Persona Builder Service
 * Automatically builds AgentPersona from onboarding questionnaire data
 */

import type { AgentPersona, OnboardingData } from '@/types/agent-memory';

export interface PersonaBuilderOptions {
  onboardingData: OnboardingData;
  organizationId: string;
  userId: string;
}

/**
 * Build AgentPersona from onboarding data
 */
export function buildPersonaFromOnboarding(
  onboardingData: OnboardingData
): AgentPersona {
  // Extract persona data from onboarding
  const agentName = onboardingData.agentName || onboardingData.businessName || 'AI Assistant';
  const tone = (onboardingData as any).tone || 'professional';
  const greeting = (onboardingData as any).greeting || buildDefaultGreeting(onboardingData);
  const closingMessage = (onboardingData as any).closingMessage || buildDefaultClosing(onboardingData);
  
  // Build objectives from onboarding
  const objectives = buildObjectives(onboardingData);
  
  // Build escalation rules from onboarding
  const escalationRules = buildEscalationRules(onboardingData);
  
  return {
    name: agentName,
    tone,
    greeting,
    closingMessage,
    objectives,
    escalationRules,
  };
}

/**
 * Build default greeting from onboarding data
 */
function buildDefaultGreeting(onboardingData: OnboardingData): string {
  const businessName = onboardingData.businessName || 'our company';
  const tone = (onboardingData as any).tone || 'professional';
  
  if (tone === 'friendly') {
    return `Hi! Welcome to ${businessName}! I'm here to help you find exactly what you need. What can I help you with today?`;
  } else if (tone === 'enthusiastic') {
    return `Hey there! Welcome to ${businessName}! I'm excited to help you discover our amazing products and services. What brings you here today?`;
  } else if (tone === 'empathetic') {
    return `Hello! Welcome to ${businessName}. I'm here to listen and help you find the perfect solution. How can I assist you today?`;
  } else {
    return `Hello! Welcome to ${businessName}. I'm here to help you with any questions about our products and services. How can I assist you today?`;
  }
}

/**
 * Build default closing message from onboarding data
 */
function buildDefaultClosing(onboardingData: OnboardingData): string {
  const tone = (onboardingData as any).tone || 'professional';
  
  if (tone === 'friendly') {
    return `Thanks for chatting! Feel free to reach out anytime if you have more questions. Have a great day!`;
  } else if (tone === 'enthusiastic') {
    return `Awesome chatting with you! Can't wait to help you again soon. Have an amazing day!`;
  } else if (tone === 'empathetic') {
    return `Thank you for your time. I'm here whenever you need support. Take care!`;
  } else {
    return `Thank you for your interest. Please don't hesitate to reach out if you have any further questions.`;
  }
}

/**
 * Build objectives array from onboarding data
 */
function buildObjectives(onboardingData: OnboardingData): string[] {
  const objectives: string[] = [];
  const data = onboardingData as any;
  
  // Primary objective
  const primaryObjective = data.primaryObjective || 'sales';
  if (primaryObjective === 'sales') {
    objectives.push('Help customers find the right products/services for their needs');
    objectives.push('Qualify leads and identify buying signals');
    objectives.push('Close sales and process orders');
  } else if (primaryObjective === 'support') {
    objectives.push('Answer customer questions and resolve issues');
    objectives.push('Provide technical support and troubleshooting');
    objectives.push('Ensure customer satisfaction');
  } else if (primaryObjective === 'service') {
    objectives.push('Schedule appointments and manage bookings');
    objectives.push('Provide service recommendations');
    objectives.push('Handle service inquiries');
  }
  
  // Secondary objectives
  if (data.secondaryObjectives && Array.isArray(data.secondaryObjectives)) {
    data.secondaryObjectives.forEach((obj: string) => {
      if (obj === 'lead_generation') {
        objectives.push('Capture lead information and qualify prospects');
      } else if (obj === 'customer_education') {
        objectives.push('Educate customers about products and services');
      } else if (obj === 'upselling') {
        objectives.push('Identify upsell and cross-sell opportunities');
      } else if (obj === 'retention') {
        objectives.push('Build long-term customer relationships');
      }
    });
  }
  
  // Add success metrics as objectives if provided
  if (data.successMetrics) {
    objectives.push(`Track and achieve: ${data.successMetrics}`);
  }
  
  // Default objectives if none specified
  if (objectives.length === 0) {
    objectives.push('Provide excellent customer service');
    objectives.push('Help customers make informed decisions');
    objectives.push('Build positive customer relationships');
  }
  
  return objectives;
}

/**
 * Build escalation rules from onboarding data
 */
function buildEscalationRules(onboardingData: OnboardingData): string[] {
  const rules: string[] = [];
  const data = onboardingData as any;
  
  // Add custom escalation rules if provided
  if (data.escalationRules) {
    if (typeof data.escalationRules === 'string') {
      rules.push(data.escalationRules);
    } else if (Array.isArray(data.escalationRules)) {
      rules.push(...data.escalationRules);
    }
  }
  
  // Add default escalation rules
  rules.push('Escalate to human agent if customer requests to speak with a person');
  rules.push('Escalate if customer expresses frustration or dissatisfaction');
  rules.push('Escalate if technical issue cannot be resolved');
  rules.push('Escalate if customer needs custom pricing or special arrangements');
  
  // Add max messages rule if specified
  const maxMessages = data.maxMessagesBeforeEscalation;
  if (maxMessages && maxMessages > 0) {
    rules.push(`Escalate if conversation exceeds ${maxMessages} messages without resolution`);
  }
  
  return rules;
}

/**
 * Build business context object from onboarding data
 * This is used in the Golden Master system prompt
 */
export function buildBusinessContextFromOnboarding(
  onboardingData: OnboardingData
): Record<string, any> {
  const data = onboardingData as any;
  return {
    businessName: data.businessName || 'the company',
    industry: data.industry || 'general',
    website: data.website ?? '',
    companySize: data.companySize ?? '',
    
    // Business understanding
    problemSolved: data.problemSolved ?? '',
    uniqueValue: data.uniqueValue ?? '',
    whyBuy: data.whyBuy ?? '',
    whyNotBuy: data.whyNotBuy ?? '',
    
    // Products/Services
    primaryOffering: data.primaryOffering ?? '',
    topProducts: data.topProducts ?? '',
    productComparison: data.productComparison ?? '',
    seasonalOfferings: data.seasonalOfferings ?? '',
    whoShouldNotBuy: data.whoShouldNotBuy ?? '',
    
    // Pricing
    pricingStrategy: data.pricingStrategy ?? '',
    discountPolicy: data.discountPolicy ?? '',
    volumeDiscounts: data.volumeDiscounts ?? '',
    firstTimeBuyerIncentive: data.firstTimeBuyerIncentive ?? '',
    financingOptions: data.financingOptions ?? '',
    
    // Operations
    geographicCoverage: data.geographicCoverage ?? '',
    deliveryTimeframes: data.deliveryTimeframes ?? '',
    inventoryConstraints: data.inventoryConstraints ?? '',
    capacityLimitations: data.capacityLimitations ?? '',
    
    // Policies
    returnPolicy: data.returnPolicy ?? '',
    warrantyTerms: data.warrantyTerms ?? '',
    cancellationPolicy: data.cancellationPolicy ?? '',
    satisfactionGuarantee: data.satisfactionGuarantee ?? '',
    
    // Sales process
    typicalSalesFlow: data.typicalSalesFlow ?? '',
    qualificationCriteria: data.qualificationCriteria ?? '',
    discoveryQuestions: data.discoveryQuestions ?? '',
    closingStrategy: data.closingStrategy ?? '',
    
    // Objection handling
    commonObjections: data.commonObjections ?? '',
    priceObjections: data.priceObjections ?? '',
    timeObjections: data.timeObjections ?? '',
    competitorObjections: data.competitorObjections ?? '',
    
    // Customer service
    supportScope: data.supportScope ?? '',
    technicalSupport: data.technicalSupport ?? '',
    orderTracking: data.orderTracking ?? '',
    complaintResolution: data.complaintResolution ?? '',
    
    // Target customer
    targetCustomer: data.targetCustomer ?? '',
    customerDemographics: data.customerDemographics ?? '',
    priceRange: data.priceRange ?? '',
  };
}

/**
 * Build behavior config from onboarding data
 */
export function buildBehaviorConfigFromOnboarding(
  onboardingData: OnboardingData
): Record<string, any> {
  const data = onboardingData as any;
  return {
    closingAggressiveness: data.closingAggressiveness || 5,
    questionFrequency: data.questionFrequency || 3,
    responseLength: data.responseLength || 'balanced',
    proactiveLevel: data.proactiveLevel || 5,
    maxMessagesBeforeEscalation: data.maxMessagesBeforeEscalation || 20,
    idleTimeoutMinutes: 30,
  };
}






















