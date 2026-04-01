/**
 * Agent Rep Profiles
 *
 * Creates synthetic "rep profiles" for AI agents so the coaching engine
 * can analyze them using the same RepPerformanceMetrics pipeline as human reps.
 *
 * Each customer-facing agent type gets an AgentRepProfile stored in Firestore.
 * A corresponding synthetic user doc is created so that the coaching engine's
 * `getCollection('USERS').doc(repId).get()` works without modification.
 *
 * Agent IDs use prefix `agent_` to avoid collision with human user IDs.
 *
 * @module agents/agent-rep-profiles
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection, COLLECTIONS } from '@/lib/firebase/collections';
import type { AgentDomain } from '@/types/training';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentRepProfile {
  agentId: string;
  agentType: AgentDomain;
  agentName: string;
  isAI: true;
  goldenMasterId?: string;
  performanceThresholds: {
    flagForTrainingBelow: number;
    excellentAbove: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

const AGENT_REP_COLLECTION = 'agentRepProfiles';

function getAgentRepCollectionPath(): string {
  return getSubCollection(AGENT_REP_COLLECTION);
}

/**
 * Get an agent rep profile by agent ID.
 */
export async function getAgentRepProfile(agentId: string): Promise<AgentRepProfile | null> {
  if (!adminDb) {
    logger.warn('[AgentRepProfiles] adminDb not available');
    return null;
  }

  const doc = await adminDb
    .collection(getAgentRepCollectionPath())
    .doc(agentId)
    .get();

  if (!doc.exists) { return null; }

  return { agentId: doc.id, ...doc.data() } as AgentRepProfile;
}

/**
 * Create an agent rep profile and a corresponding synthetic user doc.
 */
export async function createAgentRepProfile(
  agentType: AgentDomain,
  goldenMasterId?: string
): Promise<AgentRepProfile> {
  if (!adminDb) {
    throw new Error('[AgentRepProfiles] adminDb not available');
  }

  const agentId = generateAgentId(agentType);
  const agentName = getAgentDisplayName(agentType);
  const now = new Date().toISOString();

  const profile: AgentRepProfile = {
    agentId,
    agentType,
    agentName,
    isAI: true,
    goldenMasterId,
    performanceThresholds: {
      flagForTrainingBelow: getDefaultFlagThreshold(agentType),
      excellentAbove: getDefaultExcellentThreshold(agentType),
    },
    createdAt: now,
    updatedAt: now,
  };

  // Write the profile
  await adminDb
    .collection(getAgentRepCollectionPath())
    .doc(agentId)
    .set(profile);

  // Create a synthetic user doc so the coaching engine can find this "rep"
  await createSyntheticUserDoc(profile);

  logger.info(`[AgentRepProfiles] Created agent rep profile: ${agentId} (${agentType})`);

  return profile;
}

/**
 * List all agent rep profiles, optionally filtered by agent type.
 */
export async function listAgentRepProfiles(
  agentType?: AgentDomain
): Promise<AgentRepProfile[]> {
  if (!adminDb) { return []; }

  let query = adminDb.collection(getAgentRepCollectionPath()) as FirebaseFirestore.Query;

  if (agentType) {
    query = query.where('agentType', '==', agentType);
  }

  const snap = await query.get();

  return snap.docs.map(doc => ({
    agentId: doc.id,
    ...doc.data(),
  })) as AgentRepProfile[];
}

/**
 * Update an agent rep profile (e.g., link a new Golden Master).
 */
export async function updateAgentRepProfile(
  agentId: string,
  updates: Partial<Pick<AgentRepProfile, 'goldenMasterId' | 'performanceThresholds'>>
): Promise<void> {
  if (!adminDb) { return; }

  await adminDb
    .collection(getAgentRepCollectionPath())
    .doc(agentId)
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
}

// ============================================================================
// SYNTHETIC USER DOC
// ============================================================================

/**
 * Creates a minimal user doc in the `users` collection so the coaching engine
 * can look up this agent ID as if it were a human rep.
 */
async function createSyntheticUserDoc(profile: AgentRepProfile): Promise<void> {
  if (!adminDb) { return; }

  const userDoc = {
    uid: profile.agentId,
    email: `${profile.agentId}@ai-agent.salesvelocity.ai`,
    displayName: profile.agentName,
    role: 'user',
    isAI: true,
    agentType: profile.agentType,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  await adminDb
    .collection(COLLECTIONS.USERS)
    .doc(profile.agentId)
    .set(userDoc, { merge: true });

  logger.info(`[AgentRepProfiles] Created synthetic user doc for ${profile.agentId}`);
}

// ============================================================================
// HELPERS
// ============================================================================

function generateAgentId(agentType: AgentDomain): string {
  const timestamp = Date.now().toString(36);
  return `agent_${agentType}_${timestamp}`;
}

function getAgentDisplayName(agentType: AgentDomain): string {
  const names: Record<AgentDomain, string> = {
    chat: 'Sales Chat Agent',
    voice: 'Voice Agent',
    email: 'Email Agent',
    social: 'Social Media Agent',
    seo: 'SEO Content Agent',
    video: 'Video Screenwriter Agent',
    orchestrator: 'Jasper (Orchestrator)',
    sales_chat: 'Alex (Sales Chat)',
  };
  return names[agentType];
}

function getDefaultFlagThreshold(agentType: AgentDomain): number {
  const thresholds: Record<AgentDomain, number> = {
    chat: 65,
    voice: 60,
    email: 60,
    social: 60,
    seo: 55,
    video: 60,
    orchestrator: 60,
    sales_chat: 65,
  };
  return thresholds[agentType];
}

function getDefaultExcellentThreshold(agentType: AgentDomain): number {
  const thresholds: Record<AgentDomain, number> = {
    chat: 90,
    voice: 88,
    email: 85,
    social: 85,
    seo: 85,
    video: 85,
    orchestrator: 88,
    sales_chat: 90,
  };
  return thresholds[agentType];
}
