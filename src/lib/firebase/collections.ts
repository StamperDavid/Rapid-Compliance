/**
 * Centralized Collection Names
 * Supports environment-aware prefixes for test data isolation
 * 
 * CRITICAL: This file prevents test data pollution by automatically prefixing
 * collection names based on the environment.
 * 
 * ENVIRONMENT ISOLATION STRATEGY:
 * - Production (NEXT_PUBLIC_APP_ENV === 'production'): No prefix
 * - All other environments (dev, staging, test): 'test_' prefix
 * 
 * This prevents the "ticking time bomb" of test data polluting production.
 */

// Check NEXT_PUBLIC_APP_ENV first, fallback to NODE_ENV
const APP_ENV = (process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV) || 'development';
const IS_PRODUCTION = APP_ENV === 'production';
const IS_TEST = APP_ENV === 'test' || process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
const IS_DEV = APP_ENV === 'development';

// CRITICAL: Only production has no prefix
// All other environments (dev, staging, test) get test_ prefix
const PREFIX = IS_PRODUCTION ? '' : 'test_';

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
  
  // ========================================
  // TEMPLATE MANAGEMENT COLLECTIONS
  // ========================================
  GLOBAL_TEMPLATES: `${PREFIX}globalTemplates`,

  // ========================================
  // PRICING & COUPON ENGINE COLLECTIONS
  // ========================================
  PLATFORM_PRICING: `${PREFIX}platform_pricing`,
  PLATFORM_COUPONS: `${PREFIX}platform_coupons`,
  COUPON_REDEMPTIONS: `${PREFIX}coupon_redemptions`,
  AI_DISCOUNT_REQUESTS: `${PREFIX}ai_discount_requests`,
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
 * Helper for merchant coupons sub-collection
 * Usage: getMerchantCouponsCollection('org123')
 * Returns: 'organizations/org123/merchant_coupons'
 */
export const getMerchantCouponsCollection = (orgId: string): string => {
  return `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${PREFIX}merchant_coupons`;
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
  // Using logger for proper structured logging instead of console
  // This is a diagnostic function, so we'll import logger if needed
  if (typeof window === 'undefined') {
    // Server-side only logging
    const logData = {
      appEnvironment: APP_ENV,
      productionMode: IS_PRODUCTION,
      testMode: IS_TEST,
      devMode: IS_DEV,
      prefix: PREFIX,
      isolated: PREFIX ? 'Isolated (test_ prefix)' : 'Production (no prefix)',
      sample: `organizations → ${COLLECTIONS.ORGANIZATIONS}`,
      file: 'collections.ts'
    };
    // eslint-disable-next-line no-console
    console.log('📦 Collection Configuration:', logData);
  }
};

// Log on import (server-side only)
if (typeof window === 'undefined') {
  logCollectionConfig();
}
