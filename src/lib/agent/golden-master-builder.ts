/**
 * Golden Master Builder Service
 * Automatically creates Golden Master from onboarding data + persona + knowledge base
 */

import type { 
  GoldenMaster, 
  AgentPersona, 
  OnboardingData, 
  KnowledgeBase,
  BehaviorConfig 
} from '@/types/agent-memory';
import { buildPersonaFromOnboarding, buildBusinessContextFromOnboarding, buildBehaviorConfigFromOnboarding } from './persona-builder';
import { compileSystemPrompt } from './prompt-compiler';

export interface GoldenMasterBuilderOptions {
  onboardingData: OnboardingData;
  knowledgeBase: KnowledgeBase;
  organizationId: string;
  userId: string;
  workspaceId?: string;
}

/**
 * Build initial Golden Master from onboarding data
 */
export async function buildGoldenMaster(
  options: GoldenMasterBuilderOptions
): Promise<GoldenMaster> {
  const { onboardingData, knowledgeBase, organizationId, userId, workspaceId } = options;
  
  // Build persona from onboarding
  const agentPersona = buildPersonaFromOnboarding(onboardingData);
  
  // Build business context from onboarding
  const businessContext = buildBusinessContextFromOnboarding(onboardingData);
  
  // Build behavior config from onboarding
  const behaviorConfig = buildBehaviorConfigFromOnboarding(onboardingData) as BehaviorConfig;
  
  // Compile system prompt
  const systemPrompt = await compileSystemPrompt({
    businessContext,
    agentPersona,
    behaviorConfig,
    knowledgeBase,
  });
  
  // Create Golden Master
  const goldenMaster: GoldenMaster = {
    id: `gm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: 'v1',
    orgId: organizationId,
    businessContext: onboardingData,
    agentPersona,
    trainedScenarios: [],
    trainingCompletedAt: new Date().toISOString(),
    trainingScore: 0, // Will be updated after training
    knowledgeBase,
    systemPrompt,
    behaviorConfig,
    isActive: false, // Not active until training is complete
    createdBy: userId,
    createdAt: new Date().toISOString(),
    notes: 'Initial Golden Master created from onboarding',
  };
  
  return goldenMaster;
}

/**
 * Save Golden Master to Firestore
 */
export async function saveGoldenMaster(goldenMaster: GoldenMaster): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${goldenMaster.orgId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    goldenMaster.id,
    {
      ...goldenMaster,
      // Convert dates to ISO strings for Firestore
      createdAt: goldenMaster.createdAt,
      trainingCompletedAt: goldenMaster.trainingCompletedAt,
      deployedAt: goldenMaster.deployedAt,
    },
    false
  );
}

/**
 * Get active Golden Master for organization
 */
export async function getActiveGoldenMaster(organizationId: string): Promise<GoldenMaster | null> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  // Query for active Golden Master
  const { where } = await import('firebase/firestore');
  const goldenMasters = await FirestoreService.getAll<GoldenMaster>(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    [where('isActive', '==', true)]
  );
  
  if (goldenMasters.length > 0) {
    return goldenMasters[0];
  }
  
  // If no active, get the latest one
  const { orderBy, limit } = await import('firebase/firestore');
  const latest = await FirestoreService.getAll<GoldenMaster>(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    [orderBy('createdAt', 'desc'), limit(1)]
  );
  
  return latest.length > 0 ? latest[0] : null;
}

