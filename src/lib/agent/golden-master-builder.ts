/**
 * Golden Master Builder Service
 * Creates Golden Master from trained Base Model
 * Golden Master is a versioned snapshot that client manually saves when satisfied
 */

import type { 
  GoldenMaster,
  BaseModel,
  AgentPersona, 
  OnboardingData, 
  KnowledgeBase,
  BehaviorConfig 
} from '@/types/agent-memory';
import { buildPersonaFromOnboarding, buildBusinessContextFromOnboarding, buildBehaviorConfigFromOnboarding } from './persona-builder';
import { compileSystemPrompt } from './prompt-compiler';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export interface GoldenMasterBuilderOptions {
  onboardingData: OnboardingData;
  knowledgeBase: KnowledgeBase;
  organizationId: string;
  userId: string;
  workspaceId?: string;
}

export interface CreateGoldenMasterFromBaseOptions {
  baseModel: BaseModel;
  userId: string;
  trainingScore: number;
  trainedScenarios: string[];
  notes?: string;
}

/**
 * Create Golden Master from trained Base Model
 * This is the CORRECT way to create Golden Master - from a trained Base Model
 */
export async function createGoldenMasterFromBase(
  options: CreateGoldenMasterFromBaseOptions
): Promise<GoldenMaster> {
  const { baseModel, userId, trainingScore, trainedScenarios, notes } = options;
  
  console.log('[Golden Master Builder] Creating Golden Master from Base Model:', baseModel.id);
  
  // Get next version number
  const nextVersion = await getNextGoldenMasterVersion(baseModel.orgId);
  
  console.log('[Golden Master Builder] Next version:', nextVersion);
  
  // Get previous version for changelog
  const { orderBy, limit } = await import('firebase/firestore');
  const previousGMs = await FirestoreService.getAll<GoldenMaster>(
    `${COLLECTIONS.ORGANIZATIONS}/${baseModel.orgId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    [orderBy('createdAt', 'desc'), limit(1)]
  );
  const previousVersion = previousGMs.length > 0 ? previousGMs[0].version : undefined;
  
  // Create Golden Master as snapshot of Base Model
  const goldenMaster: GoldenMaster = {
    id: `gm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: nextVersion,
    orgId: baseModel.orgId,
    baseModelId: baseModel.id,
    
    // Snapshot all configuration from Base Model
    businessContext: baseModel.businessContext,
    agentPersona: baseModel.agentPersona,
    behaviorConfig: baseModel.behaviorConfig,
    knowledgeBase: baseModel.knowledgeBase,
    systemPrompt: baseModel.systemPrompt,
    
    // Training results
    trainedScenarios,
    trainingCompletedAt: new Date().toISOString(),
    trainingScore,
    
    // Not deployed yet - client must explicitly deploy
    isActive: false,
    
    // Metadata
    createdBy: userId,
    createdAt: new Date().toISOString(),
    notes: notes || `Golden Master ${nextVersion} created from trained Base Model`,
    
    // Versioning
    previousVersion,
    changesSummary: notes,
  };
  
  console.log('[Golden Master Builder] Golden Master created:', goldenMaster.id, goldenMaster.version);
  
  return goldenMaster;
}

/**
 * Get next Golden Master version number
 */
async function getNextGoldenMasterVersion(organizationId: string): Promise<string> {
  const { orderBy, limit } = await import('firebase/firestore');
  
  const goldenMasters = await FirestoreService.getAll<GoldenMaster>(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    [orderBy('createdAt', 'desc'), limit(1)]
  );
  
  if (goldenMasters.length === 0) {
    return 'v1';
  }
  
  const lastVersion = goldenMasters[0].version;
  const versionNumber = parseInt(lastVersion.replace('v', ''));
  return `v${versionNumber + 1}`;
}

/**
 * Build initial Golden Master from onboarding data
 * @deprecated Use createGoldenMasterFromBase instead!
 * This function is kept for backwards compatibility but should NOT be used.
 * Golden Masters should only be created from trained Base Models.
 */
export async function buildGoldenMaster(
  options: GoldenMasterBuilderOptions
): Promise<GoldenMaster> {
  console.warn('[Golden Master Builder] WARNING: buildGoldenMaster() is deprecated!');
  console.warn('[Golden Master Builder] Use createGoldenMasterFromBase() instead.');
  console.warn('[Golden Master Builder] Golden Masters should only be created from trained Base Models.');
  
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
  
  // Get next version
  const nextVersion = await getNextGoldenMasterVersion(organizationId);
  
  // Create Golden Master
  const goldenMaster: GoldenMaster = {
    id: `gm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: nextVersion,
    orgId: organizationId,
    baseModelId: 'legacy', // No base model for legacy creation
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
    notes: '[DEPRECATED] Initial Golden Master created from onboarding',
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
 * Create Golden Master from Base Model (simplified version for UI)
 */
export async function createGoldenMaster(
  orgId: string,
  baseModelId: string,
  userId: string,
  notes?: string
): Promise<GoldenMaster> {
  // Get Base Model
  const { getBaseModel } = await import('./base-model-builder');
  const baseModel = await getBaseModel(orgId);
  
  if (!baseModel) {
    throw new Error('Base Model not found');
  }
  
  if (baseModel.id !== baseModelId) {
    throw new Error('Base Model ID mismatch');
  }
  
  // Create Golden Master from Base Model
  const goldenMaster = await createGoldenMasterFromBase({
    baseModel,
    userId,
    trainingScore: baseModel.trainingScore,
    trainedScenarios: baseModel.trainingScenarios,
    notes,
  });
  
  // Save to Firestore
  await saveGoldenMaster(goldenMaster);
  
  console.log('[Golden Master Builder] Golden Master created and saved:', goldenMaster.version);
  
  return goldenMaster;
}

/**
 * Get all Golden Masters for organization
 */
export async function getAllGoldenMasters(organizationId: string): Promise<GoldenMaster[]> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const { orderBy } = await import('firebase/firestore');
  
  const goldenMasters = await FirestoreService.getAll<GoldenMaster>(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    [orderBy('createdAt', 'desc')]
  );
  
  return goldenMasters;
}

/**
 * Deploy Golden Master (make it active)
 */
export async function deployGoldenMaster(organizationId: string, goldenMasterId: string): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const { getDocs, collection, query, where, writeBatch, doc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase/config');
  
  // Get all Golden Masters
  const allGMs = await getAllGoldenMasters(organizationId);
  
  // Find the one to deploy
  const gmToActivate = allGMs.find(gm => gm.id === goldenMasterId);
  
  if (!gmToActivate) {
    throw new Error('Golden Master not found');
  }
  
  // Use batch to update all GMs atomically
  const batch = writeBatch(db);
  
  // Deactivate all Golden Masters
  for (const gm of allGMs) {
    const gmRef = doc(db, `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}/${gm.id}`);
    batch.update(gmRef, { isActive: false });
  }
  
  // Activate the selected one
  const activeGMRef = doc(db, `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}/${goldenMasterId}`);
  batch.update(activeGMRef, { 
    isActive: true,
    deployedAt: new Date().toISOString(),
  });
  
  // Commit batch
  await batch.commit();
  
  console.log('[Golden Master Builder] Golden Master deployed:', goldenMasterId);
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

