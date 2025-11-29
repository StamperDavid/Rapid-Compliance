/**
 * Onboarding Processor Service
 * Orchestrates the complete flow: onboarding → persona → knowledge → Golden Master
 */

import type { OnboardingData, GoldenMaster, KnowledgeBase, AgentPersona } from '@/types/agent-memory';
import { buildPersonaFromOnboarding } from './persona-builder';
import { processKnowledgeBase, KnowledgeProcessorOptions } from './knowledge-processor';
import { buildGoldenMaster, saveGoldenMaster } from './golden-master-builder';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

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
  goldenMaster?: GoldenMaster;
  error?: string;
}

/**
 * Process onboarding and create persona, knowledge base, and Golden Master
 */
export async function processOnboarding(
  options: OnboardingProcessorOptions
): Promise<OnboardingProcessResult> {
  try {
    const { onboardingData, organizationId, userId, workspaceId } = options;
    
    console.log('[Onboarding Processor] Starting processing...');
    
    // Step 1: Build persona from onboarding data
    console.log('[Onboarding Processor] Step 1: Building persona...');
    const persona = buildPersonaFromOnboarding(onboardingData);
    console.log('[Onboarding Processor] Persona built:', persona.name);
    
    // Step 2: Process knowledge base
    console.log('[Onboarding Processor] Step 2: Processing knowledge base...');
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
    console.log('[Onboarding Processor] Knowledge base processed:', {
      documents: knowledgeBase.documents.length,
      urls: knowledgeBase.urls.length,
      faqs: knowledgeBase.faqs.length,
    });
    
    // Step 3: Build Golden Master
    console.log('[Onboarding Processor] Step 3: Building Golden Master...');
    const goldenMaster = await buildGoldenMaster({
      onboardingData,
      knowledgeBase,
      organizationId,
      userId,
      workspaceId,
    });
    console.log('[Onboarding Processor] Golden Master built:', goldenMaster.id);
    
    // Step 4: Save everything to Firestore
    console.log('[Onboarding Processor] Step 4: Saving to Firestore...');
    
    // Save persona
    await FirestoreService.set(
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
    await FirestoreService.set(
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
    console.log('[Onboarding Processor] Step 5: Indexing knowledge base...');
    try {
      const { indexKnowledgeBase } = await import('@/lib/agent/vector-search');
      await indexKnowledgeBase(organizationId);
      console.log('[Onboarding Processor] Knowledge base indexed');
    } catch (error) {
      console.warn('[Onboarding Processor] Failed to index knowledge base:', error);
      // Continue even if indexing fails
    }
    
    // Save Golden Master
    await saveGoldenMaster(goldenMaster);
    
    console.log('[Onboarding Processor] ✅ Processing complete!');
    
    return {
      success: true,
      persona,
      knowledgeBase,
      goldenMaster,
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
    
    const { where } = await import('firebase/firestore');
    const goldenMasters = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
      [where('isActive', '==', true)]
    );
    
    return {
      hasPersona: !!persona,
      hasKnowledgeBase: !!knowledgeBase,
      hasGoldenMaster: goldenMasters.length > 0,
      goldenMasterVersion: goldenMasters.length > 0 ? goldenMasters[0].version : undefined,
    };
  } catch (error) {
    console.error('Error getting processing status:', error);
    return {
      hasPersona: false,
      hasKnowledgeBase: false,
      hasGoldenMaster: false,
    };
  }
}

