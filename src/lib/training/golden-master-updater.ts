/**
 * Golden Master Update Pipeline
 * Applies training improvements to the Golden Master
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { compileSystemPrompt } from '@/lib/agent/prompt-compiler';
import type { GoldenMaster } from '@/types/agent-memory';
import type {
  GoldenMasterUpdateRequest,
  ImprovementSuggestion,
  ProposedChange,
  ImpactAnalysis,
} from '@/types/training';

/**
 * Create an update request from training suggestions
 */
export async function createUpdateRequest(
  organizationId: string,
  goldenMasterId: string,
  improvements: ImprovementSuggestion[],
  sourceSessionIds: string[]
): Promise<GoldenMasterUpdateRequest> {
  console.log(`[GM Updater] Creating update request for Golden Master ${goldenMasterId}`);
  
  // Get current Golden Master
  const goldenMaster = await getGoldenMaster(organizationId, goldenMasterId);
  if (!goldenMaster) {
    throw new Error('Golden Master not found');
  }
  
  // Generate proposed changes
  const proposedChanges = await generateProposedChanges(goldenMaster, improvements);
  
  // Analyze impact
  const impactAnalysis = analyzeImpact(improvements, proposedChanges);
  
  // Create update request
  const updateRequest: GoldenMasterUpdateRequest = {
    id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    organizationId,
    goldenMasterId,
    sourceSessionIds,
    improvements,
    proposedChanges,
    impactAnalysis,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
  };
  
  // Save to Firestore
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/goldenMasterUpdates`,
    updateRequest.id,
    updateRequest,
    false
  );
  
  console.log(`[GM Updater] Update request created: ${updateRequest.id}`);
  
  return updateRequest;
}

/**
 * Generate proposed changes from improvement suggestions
 */
async function generateProposedChanges(
  goldenMaster: GoldenMaster,
  improvements: ImprovementSuggestion[]
): Promise<ProposedChange[]> {
  const changes: ProposedChange[] = [];
  
  for (const improvement of improvements) {
    if (improvement.type === 'prompt_update' && improvement.implementation) {
      // System prompt update
      const change = await createPromptUpdateChange(
        goldenMaster,
        improvement
      );
      if (change) {
        changes.push(change);
      }
    } else if (improvement.type === 'behavior_change') {
      // Behavior config update
      const change = createBehaviorChange(goldenMaster, improvement);
      if (change) {
        changes.push(change);
      }
    }
  }
  
  return changes;
}

/**
 * Create a prompt update change
 */
async function createPromptUpdateChange(
  goldenMaster: GoldenMaster,
  improvement: ImprovementSuggestion
): Promise<ProposedChange | null> {
  if (!improvement.implementation) return null;
  
  const { section, additions, removals, modifications } = improvement.implementation;
  
  // Get current system prompt
  let currentPrompt = goldenMaster.systemPrompt;
  
  // Apply changes to create proposed prompt
  let proposedPrompt = currentPrompt;
  
  // Add new content
  if (additions && additions.length > 0) {
    const additionsText = additions.map(a => `- ${a}`).join('\n');
    proposedPrompt += `\n\n# ${section.toUpperCase()} (Updated)\n${additionsText}`;
  }
  
  // Remove content
  if (removals && removals.length > 0) {
    for (const removal of removals) {
      proposedPrompt = proposedPrompt.replace(removal, '');
    }
  }
  
  // Modify content
  if (modifications && modifications.length > 0) {
    for (const mod of modifications) {
      proposedPrompt = proposedPrompt.replace(mod.from, mod.to);
    }
  }
  
  return {
    id: `change_${improvement.id}`,
    type: 'system_prompt',
    path: `systemPrompt.${section}`,
    currentValue: currentPrompt,
    proposedValue: proposedPrompt,
    reason: `${improvement.area}: ${improvement.suggestedBehavior}`,
    evidence: [], // Would include session IDs
    confidence: improvement.confidence,
  };
}

/**
 * Create a behavior config change
 */
function createBehaviorChange(
  goldenMaster: GoldenMaster,
  improvement: ImprovementSuggestion
): ProposedChange | null {
  // Map improvement area to behavior config property
  const configMapping: Record<string, string> = {
    'closing_aggressiveness': 'closingAggressiveness',
    'question_frequency': 'questionFrequency',
    'response_length': 'responseLength',
    'proactive_level': 'proactiveLevel',
  };
  
  const configKey = configMapping[improvement.area];
  if (!configKey) return null;
  
  const currentValue = (goldenMaster.behaviorConfig as any)[configKey];
  
  // Determine proposed value based on suggestion
  let proposedValue = currentValue;
  
  if (improvement.suggestedBehavior.toLowerCase().includes('more')) {
    if (typeof currentValue === 'number') {
      proposedValue = Math.min(10, currentValue + 1);
    }
  } else if (improvement.suggestedBehavior.toLowerCase().includes('less')) {
    if (typeof currentValue === 'number') {
      proposedValue = Math.max(1, currentValue - 1);
    }
  }
  
  if (proposedValue === currentValue) return null;
  
  return {
    id: `change_${improvement.id}`,
    type: 'behavior_config',
    path: `behaviorConfig.${configKey}`,
    currentValue,
    proposedValue,
    reason: improvement.suggestedBehavior,
    evidence: [],
    confidence: improvement.confidence,
  };
}

/**
 * Analyze the impact of proposed changes
 */
function analyzeImpact(
  improvements: ImprovementSuggestion[],
  changes: ProposedChange[]
): ImpactAnalysis {
  // Calculate expected improvement
  const avgImpact = improvements.reduce((sum, i) => sum + i.estimatedImpact, 0) / improvements.length;
  const expectedScoreImprovement = Math.round(avgImpact * 1.5); // Rough estimate
  
  // Identify areas that will improve
  const areasImproved = [...new Set(improvements.map(i => i.area))];
  
  // Identify potential risks
  const risks: string[] = [];
  
  if (changes.some(c => c.type === 'system_prompt')) {
    risks.push('System prompt changes may affect unrelated behaviors');
  }
  
  if (changes.some(c => c.confidence < 0.7)) {
    risks.push('Some changes have low confidence');
  }
  
  if (changes.length > 5) {
    risks.push('Large number of changes may have unexpected interactions');
  }
  
  // Calculate overall confidence
  const avgConfidence = improvements.reduce((sum, i) => sum + i.confidence, 0) / improvements.length;
  
  return {
    expectedScoreImprovement,
    areasImproved,
    risks,
    recommendedTestDuration: expectedScoreImprovement > 10 ? 14 : 7, // days
    confidence: avgConfidence,
  };
}

/**
 * Apply an approved update request to the Golden Master
 */
export async function applyUpdateRequest(
  updateRequest: GoldenMasterUpdateRequest
): Promise<GoldenMaster> {
  console.log(`[GM Updater] Applying update request ${updateRequest.id}`);
  
  const { organizationId, goldenMasterId, proposedChanges } = updateRequest;
  
  // Get current Golden Master
  const currentGM = await getGoldenMaster(organizationId, goldenMasterId);
  if (!currentGM) {
    throw new Error('Golden Master not found');
  }
  
  // Create new version
  const currentVersion = parseInt(currentGM.version.replace('v', ''));
  const newVersion = `v${currentVersion + 1}`;
  
  // Apply changes
  const updatedGM: GoldenMaster = {
    ...currentGM,
    id: `${goldenMasterId}_${newVersion}`,
    version: newVersion,
    isActive: false, // New version not active yet (needs A/B testing)
    createdAt: new Date().toISOString(),
    notes: `Updated based on training feedback. ${updateRequest.improvements.length} improvements applied.`,
  };
  
  // Apply each proposed change
  for (const change of proposedChanges) {
    applyChange(updatedGM, change);
  }
  
  // Recompile system prompt
  updatedGM.systemPrompt = await compileSystemPrompt({
    businessContext: updatedGM.businessContext,
    agentPersona: updatedGM.agentPersona,
    behaviorConfig: updatedGM.behaviorConfig,
    knowledgeBase: updatedGM.knowledgeBase,
  });
  
  // Save new version
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    updatedGM.id,
    updatedGM,
    false
  );
  
  // Update the update request status
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/goldenMasterUpdates`,
    updateRequest.id,
    {
      ...updateRequest,
      status: 'applied',
      appliedAt: new Date().toISOString(),
    },
    false
  );
  
  console.log(`[GM Updater] New Golden Master version created: ${newVersion}`);
  
  return updatedGM;
}

/**
 * Apply a single change to the Golden Master
 */
function applyChange(goldenMaster: GoldenMaster, change: ProposedChange): void {
  const pathParts = change.path.split('.');
  
  if (change.type === 'system_prompt') {
    goldenMaster.systemPrompt = change.proposedValue;
  } else if (change.type === 'behavior_config') {
    const key = pathParts[1];
    (goldenMaster.behaviorConfig as any)[key] = change.proposedValue;
  }
}

/**
 * Get a Golden Master by ID
 */
async function getGoldenMaster(
  organizationId: string,
  goldenMasterId: string
): Promise<GoldenMaster | null> {
  try {
    const gm = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
      goldenMasterId
    );
    return gm as GoldenMaster;
  } catch (error) {
    console.error('[GM Updater] Error fetching Golden Master:', error);
    return null;
  }
}

/**
 * Deploy a Golden Master version to production
 */
export async function deployGoldenMaster(
  organizationId: string,
  goldenMasterId: string
): Promise<void> {
  console.log(`[GM Updater] Deploying Golden Master ${goldenMasterId}`);
  
  // Get the Golden Master to deploy
  const newGM = await getGoldenMaster(organizationId, goldenMasterId);
  if (!newGM) {
    throw new Error('Golden Master not found');
  }
  
  // Get all Golden Masters for this org
  const allGMs = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    []
  );
  
  // Deactivate all other versions
  for (const gm of allGMs) {
    if (gm.id !== goldenMasterId && (gm as any).isActive) {
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
        gm.id,
        {
          ...gm,
          isActive: false,
        },
        false
      );
    }
  }
  
  // Activate the new version
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.GOLDEN_MASTERS}`,
    goldenMasterId,
    {
      ...newGM,
      isActive: true,
      deployedAt: new Date().toISOString(),
    },
    false
  );
  
  console.log(`[GM Updater] Golden Master ${goldenMasterId} deployed to production`);
}

