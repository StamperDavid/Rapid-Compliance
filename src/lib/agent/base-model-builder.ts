import type { BaseModel, OnboardingData, KnowledgeBase, AgentPersona } from '@/types/agent-memory'
import { logger } from '@/lib/logger/logger';
import { MutationEngine } from '@/lib/services/mutation-engine';
import { getIndustryTemplate } from '@/lib/persona/industry-templates';
import { getMutationRules } from '@/lib/persona/templates/mutation-rules';
import type { IndustryTemplate } from '@/lib/persona/templates/types';
import type { UpdateData } from 'firebase/firestore';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Check if running on server or client
const isServer = typeof window === 'undefined';

// Prevent firebase-admin from being bundled on client
// (it's only imported dynamically when isServer is true)

/**
 * Build a Base Model from onboarding data
 * 
 * Now supports industry template mutation:
 * 1. Load industry template (genetic blueprint)
 * 2. Apply mutations based on onboarding data (custom adjustments)
 * 3. Use mutated template to build enhanced BaseModel
 * 
 * This is what gets created AFTER onboarding, NOT a Golden Master
 */
export async function buildBaseModel(params: {
  onboardingData: OnboardingData;
  knowledgeBase: KnowledgeBase;
  userId: string;
  industryTemplateId?: string; // NEW: Optional industry template for intelligent defaults
}): Promise<BaseModel> {
  const { onboardingData, knowledgeBase, userId, industryTemplateId } = params;

  // NEW: Load and mutate industry template if provided
  let mutatedTemplate: IndustryTemplate | null = null;
  if (industryTemplateId) {
    try {
      logger.info('[buildBaseModel] Loading industry template', {
        templateId: industryTemplateId,
        businessName: onboardingData.businessName
      });

      const template = await getIndustryTemplate(industryTemplateId);
      if (template) {
        // Attach mutation rules to template
        const mutationRules = getMutationRules(industryTemplateId);
        const templateWithRules = {
          ...template,
          mutationRules
        };

        // Compile template with onboarding data using mutation engine
        const engine = new MutationEngine();
        mutatedTemplate = engine.compile(templateWithRules, onboardingData);

        logger.info('[buildBaseModel] Template mutated successfully', {
          templateId: industryTemplateId,
          hasMutations: mutationRules.length > 0
        });
      } else {
        logger.warn('[buildBaseModel] Industry template not found', {
          templateId: industryTemplateId
        });
      }
    } catch (error) {
      logger.error('[buildBaseModel] Failed to load/mutate template', error instanceof Error ? error : new Error(String(error)), {
        templateId: industryTemplateId
      });
      // Continue without template - fallback to basic onboarding
    }
  }

  // Generate agent persona from onboarding data (enhanced with template if available)
  const agentPersona: AgentPersona = {
    name: onboardingData.agentName ?? mutatedTemplate?.name ?? '',
    tone: mutatedTemplate?.coreIdentity.tone ?? onboardingData.communicationStyle ?? 'professional',
    greeting: onboardingData.greetingMessage ?? 'Hi! How can I help you today?',
    closingMessage: onboardingData.closingMessage ?? 'Thanks for chatting! Feel free to reach out anytime.',
    personalityTraits: onboardingData.personalityTraits ?? [],
    objectives: [],
    escalationRules: onboardingData.escalationRules ?? [],

    // SECURITY: Default to false - agents cannot negotiate unless explicitly granted
    can_negotiate: false,

    // NEW: Include template-derived fields
    ...(mutatedTemplate && {
      cognitiveFramework: mutatedTemplate.cognitiveLogic.framework,
      reasoning: mutatedTemplate.cognitiveLogic.reasoning,
      decisionProcess: mutatedTemplate.cognitiveLogic.decisionProcess,
      primaryAction: mutatedTemplate.tacticalExecution.primaryAction,
      conversionRhythm: mutatedTemplate.tacticalExecution.conversionRhythm
    })
  };

  // Build behavior configuration
  const behaviorConfig = {
    closingAggressiveness: onboardingData.closingStyle ?? 5,
    questionFrequency: onboardingData.discoveryDepth ?? 3,
    responseLength: onboardingData.responseLength ?? 'balanced',
    proactiveLevel: onboardingData.proactivityLevel ?? 5,
    discountAuthorization: onboardingData.maxDiscount ?? 0,
    escalationTriggers: onboardingData.escalationRules ?? [],
    idleTimeoutMinutes: onboardingData.idleTimeoutMinutes ?? 30,
  };

  // Build system prompt (enhanced with template if available)
  const systemPrompt = buildSystemPrompt({
    businessContext: onboardingData,
    agentPersona,
    behaviorConfig,
    template: mutatedTemplate, // NEW: Pass template for enhanced prompt
  });

  const baseModel: BaseModel = {
    id: `bm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'draft', // Not 'deployed' - that's only for Golden Master

    // Configuration (all editable)
    businessContext: onboardingData,
    agentPersona,
    behaviorConfig,
    knowledgeBase,
    systemPrompt,

    // Training progress (starts at 0)
    trainingScenarios: [],
    trainingScore: 0,

    // NEW: Store template reference and research intelligence
    ...(mutatedTemplate && {
      sourceTemplateId: mutatedTemplate.id,
      researchIntelligence: mutatedTemplate.research
    }),

    // Metadata
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
  };

  logger.info('[buildBaseModel] BaseModel created successfully', {
    baseModelId: baseModel.id,
    hasTemplate: !!mutatedTemplate,
    hasResearch: !!baseModel.researchIntelligence
  });

  return baseModel;
}

/**
 * Save Base Model to Firestore
 * Uses Admin SDK on server, Client SDK on client
 */
export async function saveBaseModel(baseModel: BaseModel): Promise<void> {
  logger.info('[saveBaseModel] Saving base model', {
    baseModelId: baseModel.id,
    file: 'base-model-builder.ts'
  });
  
  const dataToSave = {
    ...baseModel,
    orgId: PLATFORM_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isServer) {
    // Server-side: Use Admin SDK (bypasses security rules)
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    await AdminFirestoreService.set('baseModels', baseModel.id, dataToSave);
    logger.info('[saveBaseModel] Successfully saved to baseModels collection', { file: 'base-model-builder.ts' });
  } else {
    // Client-side: Use Client SDK with DAL (follows security rules)
    const { dal } = await import('@/lib/firebase/dal');
    const { serverTimestamp } = await import('firebase/firestore');
    await dal.safeSetDoc('BASE_MODELS', baseModel.id, {
      ...baseModel,
      orgId: PLATFORM_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, {
      audit: true,
      userId: baseModel.createdBy,
    });
    logger.info('[saveBaseModel] Successfully saved to baseModels collection (client)', { file: 'base-model-builder.ts' });
  }
}

/**
 * Get Base Model for an organization
 */
export async function getBaseModel(): Promise<BaseModel | null> {
  logger.info('[getBaseModel] Looking for base model', { file: 'base-model-builder.ts' });

  if (isServer) {
    // Server-side: Use Admin SDK
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { where } = await import('firebase/firestore');
    const baseModels = await AdminFirestoreService.getAll('baseModels', [
      where('orgId', '==', PLATFORM_ID)
    ]);

    logger.info('[getBaseModel] Found base models', { count: baseModels.length, file: 'base-model-builder.ts' });
    return baseModels.length > 0 ? (baseModels[0] as unknown as BaseModel) : null;
  } else {
    // Client-side: Use DAL
    const { dal } = await import('@/lib/firebase/dal');
    const { where } = await import('firebase/firestore');

    const snapshot = await dal.safeGetDocs('BASE_MODELS',
      where('orgId', '==', PLATFORM_ID)
    );

    logger.info('[getBaseModel] Client query found base models', {
      count: snapshot.docs.length,
      file: 'base-model-builder.ts'
    });

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return doc.data() as BaseModel;
  }
}

/**
 * Update Base Model configuration
 */
export async function updateBaseModel(
  baseModelId: string,
  updates: Partial<BaseModel>
): Promise<void> {
  // Rebuild system prompt if config changed
  if (updates.businessContext || updates.agentPersona || updates.behaviorConfig) {
    const current = await getBaseModel();
    if (!current) {
      throw new Error('Base model not found');
    }

    updates.systemPrompt = buildSystemPrompt({
      businessContext: updates.businessContext ?? current.businessContext,
      agentPersona: updates.agentPersona ?? current.agentPersona,
      behaviorConfig: updates.behaviorConfig ?? current.behaviorConfig,
    });
  }

  if (isServer) {
    // Server-side: Use Admin SDK
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    await AdminFirestoreService.update('baseModels', baseModelId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Client-side: Use DAL
    const { dal } = await import('@/lib/firebase/dal');
    const { serverTimestamp } = await import('firebase/firestore');
    await dal.safeUpdateDoc('BASE_MODELS', baseModelId, {
      ...updates,
      updatedAt: serverTimestamp(),
    } as UpdateData<BaseModel>, {
      audit: true,
      userId: 'system-update', // No userId available in this context
    });
  }
}

/**
 * Add training scenario to base model
 */
export async function addTrainingScenario(
  baseModelId: string,
  scenarioId: string,
  score: number
): Promise<void> {
  if (isServer) {
    // Server-side: Use Admin SDK
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const current = await AdminFirestoreService.get('baseModels', baseModelId) as BaseModel | null;
    
    if (!current) {
      throw new Error('Base model not found');
    }
    
    const scenarios = [...(current.trainingScenarios ?? []), scenarioId];
    
    // Calculate new average training score
    const totalScore = (current.trainingScore ?? 0) * (current.trainingScenarios?.length ?? 0) + score;
    const newScore = totalScore / scenarios.length;
    
    await AdminFirestoreService.update('baseModels', baseModelId, {
      trainingScenarios: scenarios,
      trainingScore: newScore,
      status: newScore >= 80 ? 'ready' : 'training',
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Client-side: Use DAL
    const { dal } = await import('@/lib/firebase/dal');
    const { serverTimestamp } = await import('firebase/firestore');
    const docSnap = await dal.safeGetDoc('BASE_MODELS', baseModelId);
    
    if (!docSnap.exists()) {
      throw new Error('Base model not found');
    }
    
    const current = docSnap.data() as BaseModel;
    const scenarios = [...current.trainingScenarios, scenarioId];
    
    // Calculate new average training score
    const totalScore = current.trainingScore * current.trainingScenarios.length + score;
    const newScore = totalScore / scenarios.length;
    
    await dal.safeUpdateDoc('BASE_MODELS', baseModelId, {
      trainingScenarios: scenarios,
      trainingScore: newScore,
      status: newScore >= 80 ? 'ready' : 'training',
      updatedAt: serverTimestamp(),
    }, {
      audit: true,
      userId: 'system-training', // No userId available in this context
    });
  }
}

/**
 * Build system prompt from configuration (enhanced with template support)
 */
function buildSystemPrompt(params: {
  businessContext: OnboardingData;
  agentPersona: AgentPersona;
  behaviorConfig: {
    closingAggressiveness: number;
    questionFrequency: number;
    responseLength: string;
    proactiveLevel: number;
    discountAuthorization?: number;
    escalationTriggers?: string[];
    idleTimeoutMinutes: number;
  };
  template?: IndustryTemplate | null; // NEW: Optional template for enhancement
}): string {
  const { businessContext, agentPersona, behaviorConfig, template } = params;

  const sections: string[] = [];

  // Role & Identity
  sections.push(`You are ${agentPersona.name ?? 'an AI sales assistant'} for ${businessContext.businessName}.`);
  sections.push(`Your role is to help potential customers understand our offerings and guide them toward a purchase decision.`);
  sections.push('');

  // Business Context
  sections.push('## About Our Business');
  sections.push(`Industry: ${businessContext.industry}`);
  sections.push(`Website: ${businessContext.website ?? 'N/A'}`);
  sections.push('');
  sections.push(`Problem We Solve: ${businessContext.problemSolved}`);
  sections.push(`Our Unique Value: ${businessContext.uniqueValue}`);
  sections.push('');

  // Products
  if (businessContext.topProducts) {
    sections.push('## Our Products & Services');
    sections.push(businessContext.topProducts);
    sections.push('');
  }

  // Target Customer
  if (businessContext.targetCustomer) {
    sections.push('## Target Customer');
    sections.push(businessContext.targetCustomer);
    sections.push('');
  }

  // Pricing
  sections.push('## Pricing');
  sections.push(`Price Range: ${businessContext.priceRange ?? 'Contact for pricing'}`);
  if (businessContext.discountPolicy) {
    sections.push(`Discount Policy: ${businessContext.discountPolicy}`);
  }
  sections.push('');

  // Sales Process
  if (businessContext.typicalSalesFlow) {
    sections.push('## Sales Process');
    sections.push(businessContext.typicalSalesFlow);
    sections.push('');
  }

  // Discovery Questions
  if (businessContext.discoveryQuestions) {
    sections.push('## Discovery Questions to Ask');
    sections.push(businessContext.discoveryQuestions);
    sections.push('');
  }

  // Objection Handling
  if (businessContext.commonObjections || businessContext.priceObjections) {
    sections.push('## Objection Handling');
    if (businessContext.commonObjections) {
      sections.push('Common Objections:');
      sections.push(businessContext.commonObjections);
    }
    if (businessContext.priceObjections) {
      sections.push('Price Objections:');
      sections.push(businessContext.priceObjections);
    }
    sections.push('');
  }

  // Policies
  if (businessContext.returnPolicy || businessContext.warrantyTerms) {
    sections.push('## Policies & Guarantees');
    if (businessContext.returnPolicy) {
      sections.push(`Return Policy: ${businessContext.returnPolicy}`);
    }
    if (businessContext.warrantyTerms) {
      sections.push(`Warranty: ${businessContext.warrantyTerms}`);
    }
    if (businessContext.satisfactionGuarantee) {
      sections.push(`Guarantee: ${businessContext.satisfactionGuarantee}`);
    }
    sections.push('');
  }

  // Behavioral Instructions
  sections.push('## Your Behavior & Style');
  sections.push(`Tone: ${agentPersona.tone}`);
  sections.push(`Response Length: ${String(behaviorConfig.responseLength)}`);
  sections.push(`Closing Aggressiveness: ${behaviorConfig.closingAggressiveness}/10`);
  sections.push(`Discovery Questions Before Recommendation: ${behaviorConfig.questionFrequency}`);
  sections.push(`Proactive Level: ${behaviorConfig.proactiveLevel}/10`);
  sections.push('');

  // NEW: Industry Template Enhancement
  if (template) {
    sections.push('## Industry-Specific Strategy');
    sections.push(`Industry Framework: ${template.cognitiveLogic.framework}`);
    sections.push(`Reasoning Approach: ${template.cognitiveLogic.reasoning}`);
    sections.push(`Primary Action: ${template.tacticalExecution.primaryAction}`);
    sections.push(`Conversion Rhythm: ${template.tacticalExecution.conversionRhythm}`);
    sections.push('');

    if (template.tacticalExecution.secondaryActions.length > 0) {
      sections.push('Secondary Actions:');
      template.tacticalExecution.secondaryActions.forEach(action => {
        sections.push(`- ${action}`);
      });
      sections.push('');
    }
  }

  // Compliance
  if (businessContext.requiredDisclosures) {
    sections.push('## Required Disclosures');
    sections.push(businessContext.requiredDisclosures);
    sections.push('');
  }

  if (businessContext.prohibitedTopics) {
    sections.push('## Prohibited Topics');
    sections.push('DO NOT discuss or provide advice on:');
    sections.push(businessContext.prohibitedTopics);
    sections.push('Escalate these topics to a human immediately.');
    sections.push('');
  }

  // Guidelines
  sections.push('## General Guidelines');
  sections.push('- Always be helpful, honest, and professional');
  sections.push('- Ask discovery questions to understand customer needs');
  sections.push('- Recommend products that truly fit the customer');
  sections.push('- Handle objections with empathy and value-focused responses');
  sections.push('- Know when to escalate to a human (complex questions, pricing negotiations beyond your authority)');
  sections.push('- Use customer data and conversation history to personalize responses');

  return sections.join('\n');
}
