/**
 * Entity Configuration Zod Schemas
 *
 * Validation for entity configuration data.
 * Uses z.record(z.string(), z.boolean()) since entity IDs are dynamic
 * (supports custom schemas in addition to standard ones).
 */

import { z } from 'zod';

/**
 * Schema for the entity toggle map.
 * Keys are entity IDs, values are enabled/disabled booleans.
 */
const entitiesSchema = z.record(z.string(), z.boolean());

/**
 * Schema for the full EntityConfig document.
 */
export const entityConfigSchema = z.object({
  entities: entitiesSchema,
  updatedAt: z.string(),
  updatedBy: z.string().min(1),
});

/**
 * Schema for updating entity config via API (only entities required).
 */
export const updateEntityConfigSchema = z.object({
  entities: entitiesSchema,
});

export type EntityConfigInput = z.infer<typeof entityConfigSchema>;
export type UpdateEntityConfigInput = z.infer<typeof updateEntityConfigSchema>;
