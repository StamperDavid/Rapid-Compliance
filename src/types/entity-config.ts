/**
 * Entity Configuration Types
 *
 * Defines the entity toggle system for SalesVelocity.ai CRM.
 * Controls which data types are visible within the CRM, separate
 * from the feature module system that controls sidebar sections.
 */

/**
 * Entity tier classification.
 * - always_on: Core CRM entities that cannot be disabled
 * - crm_extended: Additional CRM entities, default ON, toggleable
 * - industry_specific: Industry vertical entities, toggled by category defaults
 */
export type EntityTier = 'always_on' | 'crm_extended' | 'industry_specific';

/**
 * Static metadata for a toggleable entity.
 */
export interface EntityMetadata {
  id: string;
  tier: EntityTier;
  label: string;
  pluralLabel: string;
  icon: string;
  description: string;
}

/**
 * Persisted entity configuration in Firestore.
 * Keys are entity IDs, values are enabled/disabled booleans.
 * Only toggleable entities appear here — always-on entities are never stored.
 */
export interface EntityConfig {
  entities: Record<string, boolean>;
  updatedAt: string;
  updatedBy: string;
}
