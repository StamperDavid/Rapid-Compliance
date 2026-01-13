/**
 * System Configuration Blueprint
 *
 * Platform-wide default configuration including feature flags,
 * default settings, and operational parameters.
 */

import type { SystemConfigBlueprint } from '../types';

/**
 * Blueprint version - increment when making changes
 */
export const SYSTEM_CONFIG_VERSION = 1;

/**
 * Default system configuration
 *
 * This is the Golden Master blueprint for platform-wide settings.
 * These defaults are applied when no custom configuration exists.
 */
export const SYSTEM_CONFIG_BLUEPRINT: SystemConfigBlueprint = {
  id: 'platform-config',
  version: SYSTEM_CONFIG_VERSION,
  settings: {
    // Operational
    maintenanceMode: false,
    defaultTimezone: 'America/New_York',
    defaultCurrency: 'USD',
    maxOrganizations: 10000,

    // Feature Flags
    featureFlags: {
      enableAIChat: true,
      enableWorkflows: true,
      enableEcommerce: true,
      enableSocialMedia: true,
      enableLeadHunter: true,
      enableFineTuning: true,
      enableWebsiteBuilder: true,
      enableAnalytics: true,
    },
  },
};

/**
 * Get the system config blueprint
 */
export function getSystemConfigBlueprint(): SystemConfigBlueprint {
  return { ...SYSTEM_CONFIG_BLUEPRINT };
}
