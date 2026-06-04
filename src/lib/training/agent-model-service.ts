/**
 * Agent Model Service
 *
 * Operator-facing layer for viewing and changing the LLM model each agent
 * uses. A model change does NOT overwrite in place — it creates a new
 * versioned Golden Master (same prompt + Brand DNA, only the model differs)
 * and deploys it, so a model swap that hurts behavior can be rolled back to
 * the previous version. See createIndustryGMVersionFromModelChange /
 * createManagerGMVersionFromModelChange.
 */
import { AGENT_REGISTRY } from '@/lib/agents/agent-registry';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';
import {
  getActiveSpecialistGMByIndustry,
  createIndustryGMVersionFromModelChange,
  deployIndustryGMVersion,
  listIndustryGMVersions,
} from '@/lib/training/specialist-golden-master-service';
import {
  isManagerId,
  getActiveManagerGMByIndustry,
  createManagerGMVersionFromModelChange,
  deployManagerGMVersion,
  listManagerGMVersions,
} from '@/lib/training/manager-golden-master-service';

/** Penthouse single-tenant industry key (agents are GM'd per industry). */
export const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

const FALLBACK_MODEL = 'claude-sonnet-4.6';

/** Models an operator can select for an agent (current, non-deprecated). */
export const AVAILABLE_MODELS: ModelName[] = [
  'claude-opus-4.6',
  'claude-opus-4.5',
  'claude-sonnet-4.6',
  'claude-sonnet-4.5',
  'claude-haiku-4.5',
];

export interface AgentModelInfo {
  id: string;
  name: string;
  tier: string;
  kind: 'manager' | 'specialist';
  currentModel: string;
  version: number | null;
  hasGoldenMaster: boolean;
}

export interface AgentModelVersion {
  version: number;
  model: string;
  isActive: boolean;
  createdAt: string;
  notes?: string;
}

function modelOf(config: Record<string, unknown> | undefined): string {
  const m = config?.model;
  return typeof m === 'string' ? m : FALLBACK_MODEL;
}

function kindOf(agentId: string, tier: string): 'manager' | 'specialist' {
  return isManagerId(agentId) || tier === 'L2' ? 'manager' : 'specialist';
}

/** List every agent with its current model + active version. */
export async function listAgentModels(
  industryKey: string = DEFAULT_INDUSTRY_KEY,
): Promise<AgentModelInfo[]> {
  const out: AgentModelInfo[] = [];
  for (const agent of AGENT_REGISTRY) {
    const kind = kindOf(agent.id, agent.tier);
    try {
      const gm = kind === 'manager'
        ? await getActiveManagerGMByIndustry(agent.id, industryKey)
        : await getActiveSpecialistGMByIndustry(agent.id, industryKey);
      out.push({
        id: agent.id,
        name: agent.name,
        tier: agent.tier,
        kind,
        currentModel: modelOf(gm?.config),
        version: gm?.version ?? null,
        hasGoldenMaster: gm !== null,
      });
    } catch (err) {
      logger.warn('[AgentModelService] Failed reading GM', {
        agentId: agent.id,
        error: err instanceof Error ? err.message : String(err),
      });
      out.push({
        id: agent.id,
        name: agent.name,
        tier: agent.tier,
        kind,
        currentModel: FALLBACK_MODEL,
        version: null,
        hasGoldenMaster: false,
      });
    }
  }
  return out;
}

/** Change one agent's model: creates a new versioned GM and deploys it. */
export async function changeAgentModel(
  agentId: string,
  newModel: string,
  createdBy: string,
  industryKey: string = DEFAULT_INDUSTRY_KEY,
): Promise<{ success: boolean; version?: number; error?: string }> {
  if (isManagerId(agentId)) {
    const gm = await createManagerGMVersionFromModelChange(agentId, industryKey, newModel, createdBy);
    if (!gm) { return { success: false, error: 'No active Golden Master for this agent' }; }
    const deployed = await deployManagerGMVersion(agentId, industryKey, gm.version);
    return deployed.success ? { success: true, version: gm.version } : { success: false, error: deployed.error };
  }
  const gm = await createIndustryGMVersionFromModelChange(agentId, industryKey, newModel, createdBy);
  if (!gm) { return { success: false, error: 'No active Golden Master for this agent' }; }
  const deployed = await deployIndustryGMVersion(agentId, industryKey, gm.version);
  return deployed.success ? { success: true, version: gm.version } : { success: false, error: deployed.error };
}

/** Roll an agent back to a previous version (undo a bad model swap). */
export async function rollbackAgentToVersion(
  agentId: string,
  version: number,
  industryKey: string = DEFAULT_INDUSTRY_KEY,
): Promise<{ success: boolean; error?: string }> {
  return isManagerId(agentId)
    ? deployManagerGMVersion(agentId, industryKey, version)
    : deployIndustryGMVersion(agentId, industryKey, version);
}

/** Version history for an agent (model per version) — backs the rollback UI. */
export async function listAgentModelVersions(
  agentId: string,
  industryKey: string = DEFAULT_INDUSTRY_KEY,
): Promise<AgentModelVersion[]> {
  const versions = isManagerId(agentId)
    ? await listManagerGMVersions(agentId, industryKey)
    : await listIndustryGMVersions(agentId, industryKey);
  return versions.map((v) => ({
    version: v.version,
    model: modelOf(v.config),
    isActive: v.isActive,
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : String(v.createdAt),
    notes: typeof v.notes === 'string' ? v.notes : undefined,
  }));
}
