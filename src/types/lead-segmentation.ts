/**
 * Lead Segmentation Types
 *
 * Rule-based engine that automatically tags, assigns, and routes
 * leads based on their metadata at creation time.
 */

import { z } from 'zod';
import type { FirestoreDate } from './crm-entities';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export type SegmentationActionType =
  | 'add_tag'
  | 'set_owner'
  | 'assign_campaign'
  | 'trigger_workflow';

export interface SegmentationCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | string[];
}

export interface SegmentationAction {
  type: SegmentationActionType;
  config: Record<string, string>;
}

export interface SegmentationRule {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  conditions: SegmentationCondition[];
  conditionLogic: 'AND' | 'OR';
  actions: SegmentationAction[];
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
  createdBy: string;
}

export type CreateSegmentationRuleInput = Omit<SegmentationRule, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSegmentationRuleInput = Partial<Omit<SegmentationRule, 'id' | 'createdAt' | 'createdBy'>>;

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const SegmentationConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'equals', 'not_equals', 'contains', 'not_contains',
    'greater_than', 'less_than', 'in', 'not_in',
    'exists', 'not_exists',
  ]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const SegmentationActionSchema = z.object({
  type: z.enum(['add_tag', 'set_owner', 'assign_campaign', 'trigger_workflow']),
  config: z.record(z.string()),
});

export const SegmentationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(100),
  conditions: z.array(SegmentationConditionSchema).min(1),
  conditionLogic: z.enum(['AND', 'OR']).default('AND'),
  actions: z.array(SegmentationActionSchema).min(1),
});

export type SegmentationRuleFormData = z.infer<typeof SegmentationRuleSchema>;
