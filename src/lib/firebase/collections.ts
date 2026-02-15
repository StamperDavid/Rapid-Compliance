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

import { PLATFORM_ID } from '@/lib/constants/platform';

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

  // ========================================
  // ADDITIONAL SUBCOLLECTION KEYS
  // (previously in firestore-service.ts COLLECTIONS)
  // ========================================
  GOLDEN_MASTERS: `${PREFIX}goldenMasters`,
  CUSTOMER_MEMORIES: `${PREFIX}customerMemories`,
  EMAIL_CAMPAIGNS: `${PREFIX}emailCampaigns`,
  NURTURE_SEQUENCES: `${PREFIX}nurtureSequences`,
  LEAD_ENRICHMENTS: `${PREFIX}leadEnrichments`,
  LEAD_ACTIVITIES: `${PREFIX}leadActivities`,
  LEAD_SEGMENTS: `${PREFIX}leadSegments`,
  THEMES: `${PREFIX}themes`,
  SUBSCRIPTION_PLANS: `${PREFIX}subscriptionPlans`,
  CUSTOMER_SUBSCRIPTIONS: `${PREFIX}customerSubscriptions`,
  GOLDEN_PLAYBOOKS: `${PREFIX}goldenPlaybooks`,
  SOCIAL_CORRECTIONS: `${PREFIX}socialCorrections`,
  RECORDS: `${PREFIX}records`,
} as const;

/**
 * Type-safe collection getter
 */
export const getCollection = (name: keyof typeof COLLECTIONS): string => {
  return COLLECTIONS[name];
};

/**
 * Helper for platform sub-collections
 * Usage: getSubCollection('records')
 * Returns: 'organizations/rapid-compliance-root/records' (or 'test_organizations/rapid-compliance-root/test_records' in test mode)
 */
export const getSubCollection = (
  subCollection: string
): string => {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${PREFIX}${subCollection}`;
};

/** @deprecated Use getSubCollection instead */
export const getOrgSubCollection = getSubCollection;

// ============================================================================
// Convenience Collection Getters — single source of truth for every path
// ============================================================================

export const getLeadsCollection = (): string => getSubCollection('leads');
export const getDealsCollection = (): string => getSubCollection('deals');
export const getContactsCollection = (): string => getSubCollection('contacts');
export const getActivitiesCollection = (): string => getSubCollection('activities');
export const getWorkflowsCollection = (): string => getSubCollection('workflows');
export const getWorkflowExecutionsCollection = (): string => getSubCollection('workflowExecutions');
export const getProductsCollection = (): string => getSubCollection('products');
export const getSchemasCollection = (): string => getSubCollection('schemas');
export const getFormsCollection = (): string => getSubCollection('forms');
export const getOrdersCollection = (): string => getSubCollection('orders');
export const getCartsCollection = (): string => getSubCollection('carts');
export const getEmailCampaignsCollection = (): string => getSubCollection('emailCampaigns');
export const getNurtureSequencesCollection = (): string => getSubCollection('nurtureSequences');
export const getLeadEnrichmentsCollection = (): string => getSubCollection('leadEnrichments');
export const getThemesCollection = (): string => getSubCollection('themes');
export const getIntegrationsCollection = (): string => getSubCollection('integrations');

/**
 * Helper for schema sub-collections
 * Usage: getSchemaSubCollection('schema456', 'fields')
 * Returns: 'organizations/rapid-compliance-root/schemas/schema456/fields'
 */
export const getSchemaSubCollection = (
  schemaId: string,
  subCollection: string
): string => {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${PREFIX}schemas/${schemaId}/${PREFIX}${subCollection}`;
};

/**
 * Helper for merchant coupons sub-collection
 * Usage: getMerchantCouponsCollection()
 * Returns: 'organizations/rapid-compliance-root/merchant_coupons'
 */
export const getMerchantCouponsCollection = (): string => {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${PREFIX}merchant_coupons`;
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
