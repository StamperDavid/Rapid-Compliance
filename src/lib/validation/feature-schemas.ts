/**
 * Feature Module Zod Schemas
 *
 * Validation for feature configuration and business profile data.
 */

import { z } from 'zod';

// All valid feature module IDs
const featureModuleIds = [
  'crm_pipeline',
  'sales_automation',
  'email_outreach',
  'social_media',
  'ecommerce',
  'website_builder',
  'video_production',
  'forms_surveys',
  'proposals_docs',
  'advanced_analytics',
  'workflows',
  'conversations',
] as const;

/**
 * Schema for the modules toggle map
 */
const modulesSchema = z.object(
  Object.fromEntries(featureModuleIds.map((id) => [id, z.boolean()])) as Record<
    (typeof featureModuleIds)[number],
    z.ZodBoolean
  >,
);

/**
 * Schema for FeatureConfig
 */
export const featureConfigSchema = z.object({
  modules: modulesSchema,
  updatedAt: z.string(),
  updatedBy: z.string().min(1),
});

/**
 * Schema for updating feature config via API (partial — only modules required)
 */
export const updateFeatureConfigSchema = z.object({
  modules: modulesSchema,
});

/**
 * Schema for BusinessProfile
 */
export const businessProfileSchema = z.object({
  businessModel: z.string().min(1, 'Business model is required'),
  teamSize: z.string().min(1, 'Team size is required'),
  primaryGoal: z.string().min(1, 'Primary goal is required'),
  sellsOnline: z.boolean(),
  usesEmail: z.boolean(),
  usesSocialMedia: z.boolean(),
  usesVideo: z.boolean(),
  needsForms: z.boolean(),
  completedAt: z.string().optional(),
});

export type FeatureConfigInput = z.infer<typeof featureConfigSchema>;
export type UpdateFeatureConfigInput = z.infer<typeof updateFeatureConfigSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
