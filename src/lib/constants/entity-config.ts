/**
 * Entity Configuration Constants
 *
 * Static definitions for CRM entity toggles.
 * Controls which data types are visible — separate from feature modules (sidebar sections).
 */

import type { EntityMetadata, EntityConfig } from '@/types/entity-config';

// =============================================================================
// ALWAYS-ON ENTITIES — Cannot be toggled off
// =============================================================================

export const ALWAYS_ON_ENTITIES = [
  'leads',
  'contacts',
  'companies',
  'deals',
  'tasks',
] as const;

export type AlwaysOnEntityId = (typeof ALWAYS_ON_ENTITIES)[number];

// =============================================================================
// TOGGLEABLE ENTITY METADATA
// =============================================================================

export const ENTITY_METADATA: EntityMetadata[] = [
  // --- CRM Extended (5) ---
  {
    id: 'products',
    tier: 'crm_extended',
    label: 'Product',
    pluralLabel: 'Products',
    icon: '📦',
    description: 'Track product catalog, pricing, and inventory',
  },
  {
    id: 'quotes',
    tier: 'crm_extended',
    label: 'Quote',
    pluralLabel: 'Quotes',
    icon: '📄',
    description: 'Create and manage sales quotes for prospects',
  },
  {
    id: 'invoices',
    tier: 'crm_extended',
    label: 'Invoice',
    pluralLabel: 'Invoices',
    icon: '🧾',
    description: 'Generate and track invoices for completed deals',
  },
  {
    id: 'payments',
    tier: 'crm_extended',
    label: 'Payment',
    pluralLabel: 'Payments',
    icon: '💳',
    description: 'Record and reconcile payment transactions',
  },
  {
    id: 'orders',
    tier: 'crm_extended',
    label: 'Order',
    pluralLabel: 'Orders',
    icon: '📋',
    description: 'Manage purchase orders and fulfillment',
  },

  // --- Industry-Specific: Transportation & Compliance (3) ---
  {
    id: 'drivers',
    tier: 'industry_specific',
    label: 'Driver',
    pluralLabel: 'Drivers',
    icon: '🚛',
    description: 'Manage drivers, licenses, and CDL status',
  },
  {
    id: 'vehicles',
    tier: 'industry_specific',
    label: 'Vehicle',
    pluralLabel: 'Vehicles',
    icon: '🚚',
    description: 'Track fleet vehicles, VINs, and inspections',
  },
  {
    id: 'compliance_documents',
    tier: 'industry_specific',
    label: 'Compliance Document',
    pluralLabel: 'Compliance Documents',
    icon: '📑',
    description: 'Track regulatory documents, expirations, and renewals',
  },

  // --- Industry-Specific: Service Business (2) ---
  {
    id: 'projects',
    tier: 'industry_specific',
    label: 'Project',
    pluralLabel: 'Projects',
    icon: '📐',
    description: 'Manage client projects, timelines, and budgets',
  },
  {
    id: 'time_entries',
    tier: 'industry_specific',
    label: 'Time Entry',
    pluralLabel: 'Time Entries',
    icon: '⏱️',
    description: 'Log billable and non-billable time against projects',
  },

  // --- Industry-Specific: E-Commerce (2) ---
  {
    id: 'customers',
    tier: 'industry_specific',
    label: 'Customer',
    pluralLabel: 'Customers',
    icon: '🛒',
    description: 'E-commerce customer profiles and lifetime value',
  },
  {
    id: 'inventory',
    tier: 'industry_specific',
    label: 'Inventory Item',
    pluralLabel: 'Inventory',
    icon: '📊',
    description: 'Track stock levels, reorder points, and locations',
  },

  // --- Industry-Specific: Real Estate (2) ---
  {
    id: 'properties',
    tier: 'industry_specific',
    label: 'Property',
    pluralLabel: 'Properties',
    icon: '🏠',
    description: 'Manage property listings, pricing, and status',
  },
  {
    id: 'showings',
    tier: 'industry_specific',
    label: 'Showing',
    pluralLabel: 'Showings',
    icon: '🔑',
    description: 'Schedule and track property showings with clients',
  },

  // --- Industry-Specific: Legal Services (2) ---
  {
    id: 'cases',
    tier: 'industry_specific',
    label: 'Case',
    pluralLabel: 'Cases',
    icon: '⚖️',
    description: 'Manage legal cases, filings, and court dates',
  },
  {
    id: 'billing_entries',
    tier: 'industry_specific',
    label: 'Billing Entry',
    pluralLabel: 'Billing Entries',
    icon: '💰',
    description: 'Track billable hours and rates for legal cases',
  },

  // --- Industry-Specific: Healthcare / Wellness (2) ---
  {
    id: 'patients',
    tier: 'industry_specific',
    label: 'Patient',
    pluralLabel: 'Patients',
    icon: '🏥',
    description: 'Manage patient records, insurance, and status',
  },
  {
    id: 'appointments',
    tier: 'industry_specific',
    label: 'Appointment',
    pluralLabel: 'Appointments',
    icon: '📅',
    description: 'Schedule and track patient appointments',
  },
];

// =============================================================================
// DEFAULT CONFIG — CRM Extended ON, Industry OFF
// =============================================================================

const crmExtendedIds = ENTITY_METADATA
  .filter((e) => e.tier === 'crm_extended')
  .map((e) => e.id);

const industryIds = ENTITY_METADATA
  .filter((e) => e.tier === 'industry_specific')
  .map((e) => e.id);

const defaultEntities: Record<string, boolean> = {};
for (const id of crmExtendedIds) {
  defaultEntities[id] = true;
}
for (const id of industryIds) {
  defaultEntities[id] = false;
}

export const DEFAULT_ENTITY_CONFIG: EntityConfig = {
  entities: defaultEntities,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

// =============================================================================
// CATEGORY → ENTITY DEFAULTS (15 onboarding categories)
// =============================================================================

/**
 * Maps each onboarding category to the industry-specific entity IDs
 * that should be enabled by default when that category is selected.
 * CRM Extended entities are always ON by default regardless of category.
 */
export const CATEGORY_ENTITY_DEFAULTS: Record<string, string[]> = {
  real_estate: ['properties', 'showings'],
  design_construction: ['projects', 'time_entries'],
  healthcare_medical: ['patients', 'appointments'],
  fitness_wellness: ['patients', 'appointments'],
  home_services: ['projects', 'time_entries'],
  technology_saas: ['projects', 'time_entries', 'customers'],
  ecommerce_retail: ['customers', 'inventory'],
  marketing_agencies: ['projects', 'time_entries'],
  legal_services: ['cases', 'billing_entries'],
  financial_services: ['projects', 'time_entries'],
  business_services: ['projects', 'time_entries'],
  hospitality_food: ['customers', 'inventory'],
  nonprofit: [],
  automotive: ['drivers', 'vehicles', 'compliance_documents'],
  social_media: [],
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Look up metadata for a single entity by ID.
 */
export function getEntityMetadata(entityId: string): EntityMetadata | undefined {
  return ENTITY_METADATA.find((e) => e.id === entityId);
}

/**
 * Check if an entity ID is in the always-on tier.
 */
export function isAlwaysOnEntity(entityId: string): boolean {
  return (ALWAYS_ON_ENTITIES as readonly string[]).includes(entityId);
}

/**
 * Build entity config for a given onboarding category.
 * CRM Extended entities are ON; industry entities are ON only if
 * they appear in the category's default list.
 */
export function buildEntityConfigForCategory(categoryId: string): Record<string, boolean> {
  const categoryDefaults = CATEGORY_ENTITY_DEFAULTS[categoryId] ?? [];
  const entities: Record<string, boolean> = {};

  for (const id of crmExtendedIds) {
    entities[id] = true;
  }
  for (const id of industryIds) {
    entities[id] = categoryDefaults.includes(id);
  }

  return entities;
}
