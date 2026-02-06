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
import { processKnowledgeBase, type KnowledgeProcessorOptions } from './knowledge-processor';
import { buildBaseModel, saveBaseModel } from './base-model-builder';
import { COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

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
    // Type assertion for optional extended fields that may exist on OnboardingData
    interface ExtendedOnboardingFields {
      uploadedDocs?: File[];
      urls?: string[];
      faqs?: string; // Manual FAQ text as string
    }
    const extendedData = onboardingData as OnboardingData & Partial<ExtendedOnboardingFields>;

    const knowledgeOptions: KnowledgeProcessorOptions = {
      organizationId,
      uploadedFiles: extendedData.uploadedDocs ?? [],
      urls: extendedData.urls ?? [],
      faqPageUrl: onboardingData.faqPageUrl, // Now properly typed
      socialMediaUrls: onboardingData.socialMediaUrls ?? [], // Now properly typed
      faqs: extendedData.faqs,
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
      industryTemplateId: onboardingData.industryTemplateId, // Now properly wired!
    });
    
    // Step 4: Save everything to Firestore using Admin SDK (bypasses security rules)
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    
    // Save persona
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/agentPersona`,
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
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/knowledgeBase`,
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
      await indexKnowledgeBase();
    } catch (_error) {
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
  } catch (error: unknown) {
    logger.error('[Onboarding Processor] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'onboarding-processor.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to process onboarding';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/** Base model status type for processing */
type BaseModelStatus = 'draft' | 'training' | 'ready_for_golden_master';

/** Base model record structure */
interface BaseModelRecord {
  createdAt: string;
  status?: BaseModelStatus;
}

/** Golden master record structure */
interface GoldenMasterRecord {
  isActive?: boolean;
  version?: string;
}

/**
 * Get processing status for an organization
 * SERVER-SIDE ONLY - Uses Admin SDK
 */
export async function getProcessingStatus(): Promise<{
  hasPersona: boolean;
  hasKnowledgeBase: boolean;
  hasBaseModel: boolean;
  baseModelStatus?: BaseModelStatus;
  hasGoldenMaster: boolean;
  goldenMasterVersion?: string;
}> {
  try {
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');

    const personaResult: unknown = await AdminFirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/agentPersona`,
      'current'
    );

    const knowledgeBaseResult: unknown = await AdminFirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/knowledgeBase`,
      'current'
    );

    // Check for Base Model
    const baseModelsResult: unknown = await AdminFirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/${COLLECTIONS.BASE_MODELS}`
    );

    // Type guard for base models array
    const baseModels: BaseModelRecord[] = Array.isArray(baseModelsResult)
      ? (baseModelsResult as BaseModelRecord[])
      : [];

    // Sort and get latest base model
    const sortedBaseModels = [...baseModels].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Check for Golden Master
    const goldenMastersResult: unknown = await AdminFirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/${COLLECTIONS.GOLDEN_MASTERS}`
    );

    // Type guard for golden masters array
    const goldenMasters: GoldenMasterRecord[] = Array.isArray(goldenMastersResult)
      ? (goldenMastersResult as GoldenMasterRecord[])
      : [];

    const activeGoldenMaster = goldenMasters.find((gm) => gm.isActive);

    return {
      hasPersona: personaResult != null,
      hasKnowledgeBase: knowledgeBaseResult != null,
      hasBaseModel: sortedBaseModels.length > 0,
      baseModelStatus: sortedBaseModels.length > 0 ? sortedBaseModels[0].status : undefined,
      hasGoldenMaster: activeGoldenMaster != null,
      goldenMasterVersion: activeGoldenMaster?.version,
    };
  } catch (_error) {
    return {
      hasPersona: false,
      hasKnowledgeBase: false,
      hasBaseModel: false,
      hasGoldenMaster: false,
    };
  }
}

