import { BaseModel, OnboardingData, KnowledgeBase } from '@/types/agent-memory'
import { logger } from '@/lib/logger/logger';;

// Check if running on server or client
const isServer = typeof window === 'undefined';

// Prevent firebase-admin from being bundled on client
// (it's only imported dynamically when isServer is true)

/**
 * Build a Base Model from onboarding data
 * This is what gets created AFTER onboarding, NOT a Golden Master
 */
export async function buildBaseModel(params: {
  onboardingData: OnboardingData;
  knowledgeBase: KnowledgeBase;
  organizationId: string;
  userId: string;
  workspaceId?: string;
}): Promise<BaseModel> {
  const { onboardingData, knowledgeBase, organizationId, userId } = params;

  // Generate agent persona from onboarding data
  const agentPersona = {
    name: onboardingData.agentName || '',
    tone: onboardingData.communicationStyle || 'professional',
    greeting: onboardingData.greetingMessage || 'Hi! How can I help you today?',
    closingMessage: onboardingData.closingMessage || 'Thanks for chatting! Feel free to reach out anytime.',
    personality: onboardingData.personalityTraits || [],
    objectives: onboardingData.objectives || [],
    escalationRules: onboardingData.escalationRules || [],
  };

  // Build behavior configuration
  const behaviorConfig = {
    closingAggressiveness: onboardingData.closingStyle || 5,
    questionFrequency: onboardingData.discoveryDepth || 3,
    responseLength: onboardingData.responseLength || 'balanced',
    proactiveLevel: onboardingData.proactivityLevel || 5,
    discountAuthorization: onboardingData.maxDiscount || 0,
    escalationTriggers: onboardingData.escalationRules || [],
    idleTimeoutMinutes: onboardingData.idleTimeoutMinutes || 30,
  };

  // Build system prompt (this is the "initial prompt" before training)
  const systemPrompt = buildSystemPrompt({
    businessContext: onboardingData,
    agentPersona,
    behaviorConfig,
  });

  const baseModel: BaseModel = {
    id: `bm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    orgId: organizationId,
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

    // Metadata
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
  };

  return baseModel;
}

/**
 * Save Base Model to Firestore
 * Uses Admin SDK on server, Client SDK on client
 */
export async function saveBaseModel(baseModel: BaseModel): Promise<void> {
  logger.info('[saveBaseModel] Saving base model', { 
    baseModelId: baseModel.id, 
    orgId: baseModel.orgId,
    file: 'base-model-builder.ts' 
  });
  
  if (isServer) {
    // Server-side: Use Admin SDK (bypasses security rules)
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    await AdminFirestoreService.set('baseModels', baseModel.id, {
      ...baseModel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    logger.info('[saveBaseModel] Successfully saved to baseModels collection', { file: 'base-model-builder.ts' });
  } else {
    // Client-side: Use Client SDK (follows security rules)
    const { db } = await import('@/lib/firebase/config');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const docRef = doc(db, 'baseModels', baseModel.id);
    await setDoc(docRef, {
      ...baseModel,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    logger.info('[saveBaseModel] Successfully saved to baseModels collection (client)', { file: 'base-model-builder.ts' });
  }
}

/**
 * Get Base Model for an organization
 */
export async function getBaseModel(orgId: string): Promise<BaseModel | null> {
  logger.info('[getBaseModel] Looking for base model', { orgId, file: 'base-model-builder.ts' });
  
  if (isServer) {
    // Server-side: Use Admin SDK
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { where } = await import('firebase/firestore');
    const baseModels = await AdminFirestoreService.getAll('baseModels', [
      where('orgId', '==', orgId)
    ]);
    
    logger.info('[getBaseModel] Found base models', { count: baseModels.length, file: 'base-model-builder.ts' });
    return baseModels.length > 0 ? (baseModels[0] as BaseModel) : null;
  } else {
    // Client-side: Use Client SDK
    const { db } = await import('@/lib/firebase/config');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const q = query(
      collection(db, 'baseModels'),
      where('orgId', '==', orgId)
    );
    
    const snapshot = await getDocs(q);
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
  orgId: string,
  baseModelId: string,
  updates: Partial<BaseModel>
): Promise<void> {
  // Rebuild system prompt if config changed
  if (updates.businessContext || updates.agentPersona || updates.behaviorConfig) {
    const current = await getBaseModel(orgId);
    if (!current) {
      throw new Error('Base model not found');
    }
    
    updates.systemPrompt = buildSystemPrompt({
      businessContext: updates.businessContext || current.businessContext,
      agentPersona: updates.agentPersona || current.agentPersona,
      behaviorConfig: updates.behaviorConfig || current.behaviorConfig,
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
    // Client-side: Use Client SDK
    const { db } = await import('@/lib/firebase/config');
    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const docRef = doc(db, 'baseModels', baseModelId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
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
    const current = await AdminFirestoreService.get('baseModels', baseModelId);
    
    if (!current) {
      throw new Error('Base model not found');
    }
    
    const scenarios = [...(current.trainingScenarios || []), scenarioId];
    
    // Calculate new average training score
    const totalScore = (current.trainingScore || 0) * (current.trainingScenarios?.length || 0) + score;
    const newScore = totalScore / scenarios.length;
    
    await AdminFirestoreService.update('baseModels', baseModelId, {
      trainingScenarios: scenarios,
      trainingScore: newScore,
      status: newScore >= 80 ? 'ready' : 'training',
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Client-side: Use Client SDK
    const { db } = await import('@/lib/firebase/config');
    const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const docRef = doc(db, 'baseModels', baseModelId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Base model not found');
    }
    
    const current = docSnap.data() as BaseModel;
    const scenarios = [...current.trainingScenarios, scenarioId];
    
    // Calculate new average training score
    const totalScore = current.trainingScore * current.trainingScenarios.length + score;
    const newScore = totalScore / scenarios.length;
    
    await updateDoc(docRef, {
      trainingScenarios: scenarios,
      trainingScore: newScore,
      status: newScore >= 80 ? 'ready' : 'training',
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Build system prompt from configuration
 */
function buildSystemPrompt(params: {
  businessContext: OnboardingData;
  agentPersona: any;
  behaviorConfig: any;
}): string {
  const { businessContext, agentPersona, behaviorConfig } = params;

  const sections: string[] = [];

  // Role & Identity
  sections.push(`You are ${agentPersona.name || 'an AI sales assistant'} for ${businessContext.businessName}.`);
  sections.push(`Your role is to help potential customers understand our offerings and guide them toward a purchase decision.`);
  sections.push('');

  // Business Context
  sections.push('## About Our Business');
  sections.push(`Industry: ${businessContext.industry}`);
  sections.push(`Website: ${businessContext.website || 'N/A'}`);
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
  sections.push(`Price Range: ${businessContext.priceRange || 'Contact for pricing'}`);
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
  sections.push(`Response Length: ${behaviorConfig.responseLength}`);
  sections.push(`Closing Aggressiveness: ${behaviorConfig.closingAggressiveness}/10`);
  sections.push(`Discovery Questions Before Recommendation: ${behaviorConfig.questionFrequency}`);
  sections.push(`Proactive Level: ${behaviorConfig.proactiveLevel}/10`);
  sections.push('');

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
