/**
 * Onboarding Processor Service
 * Orchestrates the complete flow: onboarding → persona → knowledge → Base Model
 * NOTE: Creates Base Model (editable), NOT Golden Master!
 * Client will save Golden Master manually after training.
 * 
 * IMPORTANT: This service runs SERVER-SIDE ONLY and uses Admin SDK to bypass security rules
 */

import type { OnboardingData, BaseModel, KnowledgeBase, AgentPersona } from '@/types/agent-memory';
import { buildPersonaFromOnboarding } from './persona-builder';
import { processKnowledgeBase, KnowledgeProcessorOptions } from './knowledge-processor';
import { buildBaseModel, saveBaseModel } from './base-model-builder';
import { COLLECTIONS } from '@/lib/db/firestore-service';

// Dynamic import of AdminFirestoreService to prevent client-side bundling

export interface OnboardingProcessorOptions {
  onboardingData: OnboardingData;
  organizationId: string;
  userId: string;
  workspaceId?: string;
}

export interface OnboardingProcessResult {
  success: boolean;
  persona?: AgentPersona;
  knowledgeBase?: KnowledgeBase;
  baseModel?: BaseModel; // Changed from goldenMaster - this is the editable version
  error?: string;
}

/**
 * Process onboarding and create persona, knowledge base, and Base Model
 * Creates EDITABLE Base Model - NOT Golden Master!
 * Client will save Golden Master after training.
 */
export async function processOnboarding(
  options: OnboardingProcessorOptions
): Promise<OnboardingProcessResult> {
  try {
    const { onboardingData, organizationId, userId, workspaceId } = options;
    
    // Step 1: Build persona from onboarding data
    const persona = buildPersonaFromOnboarding(onboardingData);
    
    // Step 2: Process knowledge base
    const knowledgeOptions: KnowledgeProcessorOptions = {
      organizationId,
      uploadedFiles: onboardingData.uploadedDocs || [],
      urls: onboardingData.urls || [],
      faqPageUrl: onboardingData.faqPageUrl,
      socialMediaUrls: onboardingData.socialMediaUrls || [],
      faqs: onboardingData.faqs,
      websiteUrl: onboardingData.website,
    };
    
    const knowledgeBase = await processKnowledgeBase(knowledgeOptions);
    
    // Step 3: Build Base Model (NOT Golden Master yet!)
    const baseModel = await buildBaseModel({
      onboardingData,
      knowledgeBase,
      organizationId,
      userId,
      workspaceId,
    });
    
    // Step 4: Save everything to Firestore using Admin SDK (bypasses security rules)
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    
    // Save persona
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/agentPersona`,
      'current',
      {
        ...persona,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );
    
    // Save knowledge base
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeBase`,
      'current',
      {
        ...knowledgeBase,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );
    
    // Index knowledge base (generate embeddings for vector search)
    try {
      const { indexKnowledgeBase } = await import('@/lib/agent/vector-search');
      await indexKnowledgeBase(organizationId);
    } catch (error) {
      // Continue even if indexing fails - not critical for onboarding
    }
    
    // Save Base Model (NOT Golden Master - that comes after training!)
    await saveBaseModel(baseModel);
    
    return {
      success: true,
      persona,
      knowledgeBase,
      baseModel, // Changed from goldenMaster
    };
  } catch (error: any) {
    console.error('[Onboarding Processor] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process onboarding',
    };
  }
}

/**
 * Get processing status for an organization
 */
export async function getProcessingStatus(organizationId: string): Promise<{
  hasPersona: boolean;
  hasKnowledgeBase: boolean;
  hasBaseModel: boolean;
  baseModelStatus?: 'draft' | 'training' | 'ready_for_golden_master';
  hasGoldenMaster: boolean;
  goldenMasterVersion?: string;
}> {
  try {
    const persona = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/agentPersona`,
      'current'
    );
    
    const knowledgeBase = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeBase`,
      'current'
    );
    
    // Check for Base Model
    const { orderBy, limit, where } = await import('firebase/firestore');
    const baseModels = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.BASE_MODELS}`,
      [orderBy('createdAt', 'desc'), limit(1)]
    );
    
    // Check for Golden Master
    const goldenMasters = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
      [where('isActive', '==', true)]
    );
    
    return {
      hasPersona: !!persona,
      hasKnowledgeBase: !!knowledgeBase,
      hasBaseModel: baseModels.length > 0,
      baseModelStatus: baseModels.length > 0 ? baseModels[0].status : undefined,
      hasGoldenMaster: goldenMasters.length > 0,
      goldenMasterVersion: goldenMasters.length > 0 ? goldenMasters[0].version : undefined,
    };
  } catch (error) {
    return {
      hasPersona: false,
      hasKnowledgeBase: false,
      hasBaseModel: false,
      hasGoldenMaster: false,
    };
  }
}

