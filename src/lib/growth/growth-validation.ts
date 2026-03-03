/**
 * Growth Command Center — Zod Validation Schemas
 *
 * All API input schemas for the Growth Command Center.
 * Every POST/PUT body and query parameter is validated here.
 */

import { z } from 'zod';

// ============================================================================
// COMPETITOR SCHEMAS
// ============================================================================

export const AddCompetitorSchema = z.object({
  domain: z.string().min(1, 'Domain is required').max(253),
  name: z.string().min(1, 'Name is required').max(200),
  niche: z.string().min(1, 'Niche is required').max(200),
});

export const DiscoverCompetitorsSchema = z.object({
  niche: z.string().min(1, 'Niche is required').max(200),
  location: z.string().min(1, 'Location is required').max(200),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export const CompetitorListQuerySchema = z.object({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ============================================================================
// KEYWORD SCHEMAS
// ============================================================================

export const AddKeywordSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(500),
  tags: z.array(z.string().max(100)).max(20).optional().default([]),
});

export const BulkAddKeywordsSchema = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z.string().min(1).max(500),
        tags: z.array(z.string().max(100)).max(20).optional().default([]),
      })
    )
    .min(1, 'At least one keyword required')
    .max(50, 'Maximum 50 keywords per batch'),
});

export const KeywordListQuerySchema = z.object({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  tag: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// ============================================================================
// STRATEGY SCHEMAS
// ============================================================================

export const GenerateStrategySchema = z.object({
  maxMonthlyBudget: z.coerce.number().positive('Budget must be positive'),
  minMonthlyBudget: z.coerce.number().nonnegative().optional().default(0),
  preferredChannels: z
    .array(z.enum(['seo', 'paid', 'content', 'social', 'email', 'partnerships']))
    .optional()
    .default([]),
  primaryGoal: z.enum(['growth', 'retention', 'awareness', 'revenue']),
  industry: z.string().min(1, 'Industry is required').max(200),
});

export const ApproveStrategySchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID is required'),
  tier: z.enum(['aggressive', 'competitive', 'scrappy']),
  notes: z.string().max(2000).optional().default(''),
});

export const RejectStrategySchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(2000),
});

// ============================================================================
// AI VISIBILITY SCHEMAS
// ============================================================================

export const RunVisibilityCheckSchema = z.object({
  queries: z
    .array(z.string().min(1).max(500))
    .min(1, 'At least one query required')
    .max(20, 'Maximum 20 queries per check'),
  targetDomain: z.string().min(1, 'Target domain is required').max(253),
});

// ============================================================================
// ACTIVITY SCHEMAS
// ============================================================================

export const ActivityListQuerySchema = z.object({
  type: z
    .enum([
      'competitor_added',
      'competitor_analyzed',
      'competitor_removed',
      'keyword_added',
      'keyword_ranking_changed',
      'keyword_removed',
      'strategy_generated',
      'strategy_approved',
      'strategy_rejected',
      'ai_visibility_checked',
      'competitor_discovered',
      'cron_keyword_check',
      'cron_competitor_scan',
      'cron_ai_visibility',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type AddCompetitorInput = z.infer<typeof AddCompetitorSchema>;
export type DiscoverCompetitorsInput = z.infer<typeof DiscoverCompetitorsSchema>;
export type AddKeywordInput = z.infer<typeof AddKeywordSchema>;
export type BulkAddKeywordsInput = z.infer<typeof BulkAddKeywordsSchema>;
export type GenerateStrategyInput = z.infer<typeof GenerateStrategySchema>;
export type ApproveStrategyInput = z.infer<typeof ApproveStrategySchema>;
export type RejectStrategyInput = z.infer<typeof RejectStrategySchema>;
export type RunVisibilityCheckInput = z.infer<typeof RunVisibilityCheckSchema>;
