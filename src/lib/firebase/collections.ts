/**
 * Centralized Collection Names
 * Supports environment-aware prefixes for test data isolation
 * 
 * CRITICAL: This file prevents test data pollution by automatically prefixing
 * collection names based on the environment.
 */

const ENV = process.env.NODE_ENV || 'development';
const IS_TEST = ENV === 'test' || !!process.env.JEST_WORKER_ID;
const IS_DEV = ENV === 'development';

// Prefix for test collections
// In test mode, all collections are prefixed with 'test_'
const TEST_PREFIX = IS_TEST ? 'test_' : '';

// Prefix for dev collections (optional - set USE_PROD_DB=true to disable)
// In dev mode, collections are prefixed with 'dev_' unless explicitly using prod
const DEV_PREFIX = IS_DEV && !process.env.USE_PROD_DB ? 'dev_' : '';

// Final prefix - test takes priority over dev
const PREFIX = TEST_PREFIX || DEV_PREFIX;

/**
 * Centralized Collection Registry
 * All collection names in the app should reference these constants
 */
export const COLLECTIONS = {
  // ========================================
  // CORE COLLECTIONS
  // ========================================
  ORGANIZATIONS: `${PREFIX}organizations`,
  USERS: `${PREFIX}users`,
  
  // ========================================
  // CRM COLLECTIONS
  // ========================================
  LEADS: `${PREFIX}leads`,
  CONTACTS: `${PREFIX}contacts`,
  DEALS: `${PREFIX}deals`,
  
  // ========================================
  // AUTOMATION COLLECTIONS
  // ========================================
  SEQUENCES: `${PREFIX}sequences`,
  SEQUENCE_ENROLLMENTS: `${PREFIX}sequenceEnrollments`,
  CAMPAIGNS: `${PREFIX}campaigns`,
  WORKFLOWS: `${PREFIX}workflows`,
  
  // ========================================
  // E-COMMERCE COLLECTIONS
  // ========================================
  PRODUCTS: `${PREFIX}products`,
  ORDERS: `${PREFIX}orders`,
  CARTS: `${PREFIX}carts`,
  
  // ========================================
  // AI & TRAINING COLLECTIONS
  // ========================================
  CONVERSATIONS: `${PREFIX}conversations`,
  TRAINING_DATA: `${PREFIX}trainingData`,
  FINE_TUNING_JOBS: `${PREFIX}fineTuningJobs`,
  AB_TESTS: `${PREFIX}abTests`,
  BASE_MODELS: `${PREFIX}baseModels`,
  
  // ========================================
  // SYSTEM COLLECTIONS
  // ========================================
  SCHEMAS: `${PREFIX}schemas`,
  API_KEYS: `${PREFIX}apiKeys`,
  AUDIT_LOGS: `${PREFIX}auditLogs`,
  INTEGRATIONS: `${PREFIX}integrations`,
  
  // ========================================
  // WEBSITE BUILDER COLLECTIONS
  // ========================================
  PAGES: `${PREFIX}pages`,
  BLOG_POSTS: `${PREFIX}blogPosts`,
  DOMAINS: `${PREFIX}domains`,
  
  // ========================================
  // ANALYTICS COLLECTIONS
  // ========================================
  ANALYTICS_EVENTS: `${PREFIX}analyticsEvents`,
  REPORTS: `${PREFIX}reports`,
} as const;

/**
 * Type-safe collection getter
 */
export const getCollection = (name: keyof typeof COLLECTIONS): string => {
  return COLLECTIONS[name];
};

/**
 * Helper for organization sub-collections
 * Usage: getOrgSubCollection('org123', 'records')
 * Returns: 'organizations/org123/records' (or 'test_organizations/org123/test_records' in test mode)
 */
export const getOrgSubCollection = (
  orgId: string,
  subCollection: string
): string => {
  return `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${PREFIX}${subCollection}`;
};

/**
 * Helper for workspace sub-collections
 * Usage: getWorkspaceSubCollection('org123', 'workspace456', 'schemas')
 * Returns: 'organizations/org123/workspaces/workspace456/schemas'
 */
export const getWorkspaceSubCollection = (
  orgId: string,
  workspaceId: string,
  subCollection: string
): string => {
  return `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${PREFIX}workspaces/${workspaceId}/${PREFIX}${subCollection}`;
};

/**
 * Helper for schema sub-collections
 * Usage: getSchemaSubCollection('org123', 'schema456', 'fields')
 * Returns: 'organizations/org123/schemas/schema456/fields'
 */
export const getSchemaSubCollection = (
  orgId: string,
  schemaId: string,
  subCollection: string
): string => {
  return `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${PREFIX}schemas/${schemaId}/${PREFIX}${subCollection}`;
};

/**
 * Get the current environment prefix
 */
export const getPrefix = (): string => {
  return PREFIX;
};

/**
 * Check if we're in test mode
 */
export const isTestMode = (): boolean => {
  return IS_TEST;
};

/**
 * Check if we're in dev mode
 */
export const isDevMode = (): boolean => {
  return IS_DEV;
};

/**
 * Log current collection configuration (for debugging)
 */
export const logCollectionConfig = () => {
  console.log('📦 Collection Configuration:');
  console.log(`   Environment: ${ENV}`);
  console.log(`   Test Mode: ${IS_TEST}`);
  console.log(`   Dev Mode: ${IS_DEV}`);
  console.log(`   Prefix: "${PREFIX}" ${PREFIX ? '✅ Isolated' : '⚠️ Production'}`);
  console.log(`   Sample: organizations → ${COLLECTIONS.ORGANIZATIONS}`);
};

// Log on import (server-side only)
if (typeof window === 'undefined') {
  logCollectionConfig();
}
