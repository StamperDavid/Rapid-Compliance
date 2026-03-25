/**
 * Lead Segmentation Service
 *
 * Rule-based engine that evaluates leads against segmentation rules
 * and applies actions (tagging, owner assignment, campaign routing).
 *
 * Uses AdminFirestoreService (server-side only).
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  SegmentationRule,
  SegmentationCondition,
  SegmentationAction,
  CreateSegmentationRuleInput,
  UpdateSegmentationRuleInput,
} from '@/types/lead-segmentation';
import type { Lead } from '@/types/crm-entities';

const COLLECTION = 'segmentation-rules';

function getCollection(): string {
  return getSubCollection(COLLECTION);
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function createSegmentationRule(input: CreateSegmentationRuleInput): Promise<SegmentationRule> {
  const id = `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  const rule: SegmentationRule = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await AdminFirestoreService.set(getCollection(), id, rule as unknown as Record<string, unknown>, false);
  logger.info('Segmentation rule created', { id, name: input.name });
  return rule;
}

export async function getSegmentationRule(id: string): Promise<SegmentationRule | null> {
  const doc = await AdminFirestoreService.get(getCollection(), id);
  return doc as SegmentationRule | null;
}

export async function listSegmentationRules(): Promise<SegmentationRule[]> {
  const { orderBy } = await import('firebase/firestore');
  const docs = await AdminFirestoreService.getAll(getCollection(), [
    orderBy('priority', 'asc'),
  ]);
  return docs as unknown as SegmentationRule[];
}

export async function updateSegmentationRule(id: string, updates: UpdateSegmentationRuleInput): Promise<SegmentationRule> {
  const existing = await getSegmentationRule(id);
  if (!existing) {throw new Error(`Segmentation rule not found: ${id}`);}

  const data = { ...updates, updatedAt: new Date().toISOString() };
  await AdminFirestoreService.update(getCollection(), id, data as unknown as Record<string, unknown>);

  const updated = await getSegmentationRule(id);
  if (!updated) {throw new Error('Rule not found after update');}
  return updated;
}

export async function deleteSegmentationRule(id: string): Promise<void> {
  await AdminFirestoreService.delete(getCollection(), id);
  logger.info('Segmentation rule deleted', { id });
}

// ── Rule Evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluate all active segmentation rules against a lead.
 * Returns the actions from all matching rules, sorted by priority.
 */
export async function evaluateSegmentation(lead: Lead): Promise<SegmentationAction[]> {
  const rules = await listSegmentationRules();
  const activeRules = rules.filter(r => r.isActive);
  const matchingActions: SegmentationAction[] = [];

  for (const rule of activeRules) {
    if (evaluateConditions(lead, rule.conditions, rule.conditionLogic)) {
      matchingActions.push(...rule.actions);
    }
  }

  return matchingActions;
}

function evaluateConditions(
  lead: Lead,
  conditions: SegmentationCondition[],
  logic: 'AND' | 'OR'
): boolean {
  if (conditions.length === 0) {return false;}

  const results = conditions.map(c => evaluateCondition(lead, c));
  return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

function evaluateCondition(lead: Lead, condition: SegmentationCondition): boolean {
  const fieldValue = getNestedField(lead, condition.field);

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condition.value);

    case 'not_equals':
      return String(fieldValue) !== String(condition.value);

    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());

    case 'not_contains':
      return typeof fieldValue === 'string' && !fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());

    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > Number(condition.value);

    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < Number(condition.value);

    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.includes(String(fieldValue));
      }
      return false;

    case 'not_in':
      if (Array.isArray(condition.value)) {
        return !condition.value.includes(String(fieldValue));
      }
      return true;

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';

    case 'not_exists':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';

    default:
      return false;
  }
}

function getNestedField(obj: object, path: string): unknown {
  const record = obj as Record<string, unknown>;
  const parts = path.split('.');
  let current: unknown = record;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Apply segmentation actions to a lead.
 * Called after lead creation in lead-service.ts.
 */
export async function applySegmentationActions(
  leadId: string,
  actions: SegmentationAction[]
): Promise<void> {
  if (actions.length === 0) {return;}

  const { updateLead } = await import('@/lib/crm/lead-service');
  const updates: Record<string, unknown> = {};
  const tagsToAdd: string[] = [];

  for (const action of actions) {
    switch (action.type) {
      case 'add_tag':
        if (action.config.tag) {
          tagsToAdd.push(action.config.tag);
        }
        break;

      case 'set_owner':
        if (action.config.ownerId) {
          updates.ownerId = action.config.ownerId;
        }
        break;

      case 'assign_campaign':
        if (action.config.campaignId) {
          updates.campaignId = action.config.campaignId;
        }
        break;

      case 'trigger_workflow':
        if (action.config.workflowId) {
          try {
            const { handleEntityChange } = await import('@/lib/workflows/triggers/firestore-trigger');
            await handleEntityChange(
              'leads',
              'updated',
              leadId,
              { leadId, segmentAction: 'trigger_workflow', workflowId: action.config.workflowId },
              0
            );
            logger.info('Workflow triggered from segmentation action', {
              leadId,
              workflowId: action.config.workflowId,
              file: 'lead-segmentation-service.ts',
            });
          } catch (error) {
            logger.error('Failed to trigger workflow from segmentation', error instanceof Error ? error : new Error(String(error)), {
              leadId,
              workflowId: action.config.workflowId,
              file: 'lead-segmentation-service.ts',
            });
          }
        }
        break;
    }
  }

  // Merge tags with existing
  if (tagsToAdd.length > 0) {
    const { getLead } = await import('@/lib/crm/lead-service');
    const currentLead = await getLead(leadId);
    const existingTags = currentLead?.tags ?? [];
    const mergedTags = [...new Set([...existingTags, ...tagsToAdd])];
    updates.tags = mergedTags;
  }

  if (Object.keys(updates).length > 0) {
    await updateLead(leadId, updates as Partial<Omit<Lead, 'id' | 'createdAt'>>);
    logger.info('Segmentation actions applied', {
      leadId,
      actionsApplied: actions.length,
      updatedFields: Object.keys(updates),
    });
  }
}
