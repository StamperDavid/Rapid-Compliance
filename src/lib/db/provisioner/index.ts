/**
 * Database Provisioner
 *
 * Automatically provisions core system data when missing.
 * This creates a "self-healing" database layer that ensures
 * architectural components exist based on Golden Master blueprints.
 *
 * SAFETY RULES:
 * 1. Uses NEXT_PUBLIC_APP_ENV for environment detection (via collections.ts)
 * 2. NEVER copies content data (knowledgeBase, customerMemories, etc.)
 * 3. Only provisions structural/system data
 * 4. Idempotent - safe to run multiple times
 * 5. Logs all actions for auditability
 *
 * @module provisioner
 */

import { getPrefix, COLLECTIONS } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

import type { ProvisionResult, ProvisionReport } from './types';
import {
  getAdminPersonaBlueprint,
  getIndustryPersonaBlueprints,
  getSystemConfigBlueprint,
  getPricingTierBlueprints,
} from './blueprints';

// ============================================================================
// STATE
// ============================================================================

/** Singleton to prevent concurrent provisioning */
let isProvisioning = false;

/** Last provision report for monitoring */
let lastProvisionReport: ProvisionReport | null = null;

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

/**
 * Get current environment info for logging and paths
 */
function getEnvironmentInfo(): { env: string; projectId: string; prefix: string } {
  const env =
    process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'unknown';
  const prefix = getPrefix();

  return { env, projectId, prefix };
}

/**
 * Build a collection path with the environment prefix
 */
function buildPath(basePath: string): string {
  const prefix = getPrefix();
  return `${prefix}${basePath}`;
}

// ============================================================================
// EXISTENCE CHECKS
// ============================================================================

/**
 * Check if a document exists at the given path
 */
async function documentExists(collectionPath: string, docId: string): Promise<boolean> {
  if (!adminDb) {
    logger.error('[Provisioner] Admin SDK not initialized', { file: 'provisioner/index.ts' });
    return false;
  }

  try {
    const docRef = adminDb.collection(collectionPath).doc(docId);
    const docSnap = await docRef.get();
    return docSnap.exists;
  } catch (error) {
    logger.warn(`[Provisioner] Error checking existence: ${collectionPath}/${docId}`, {
      error,
      file: 'provisioner/index.ts',
    });
    return false;
  }
}

// ============================================================================
// PROVISIONING FUNCTIONS
// ============================================================================

/**
 * Provision system configuration
 */
async function provisionSystemConfig(): Promise<ProvisionResult> {
  const target = 'SYSTEM_CONFIG' as const;
  const collectionPath = buildPath('system');
  const docId = 'config';

  try {
    const exists = await documentExists(collectionPath, docId);

    if (exists) {
      return {
        target,
        action: 'skipped',
        documentId: docId,
        timestamp: new Date().toISOString(),
      };
    }

    if (!adminDb) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const blueprint = getSystemConfigBlueprint();
    const docRef = adminDb.collection(collectionPath).doc(docId);

    await docRef.set({
      ...blueprint,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('[Provisioner] Created system config', {
      path: `${collectionPath}/${docId}`,
      file: 'provisioner/index.ts',
    });

    return {
      target,
      action: 'created',
      documentId: docId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Provisioner] Error provisioning system config', error, {
      file: 'provisioner/index.ts',
    });
    return {
      target,
      action: 'error',
      documentId: docId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Provision admin persona (Jasper)
 */
async function provisionAdminPersona(): Promise<ProvisionResult> {
  const target = 'ADMIN_PERSONA' as const;
  const collectionPath = buildPath('system_personas');
  const docId = 'admin';

  try {
    const exists = await documentExists(collectionPath, docId);

    if (exists) {
      return {
        target,
        action: 'skipped',
        documentId: docId,
        timestamp: new Date().toISOString(),
      };
    }

    if (!adminDb) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const blueprint = getAdminPersonaBlueprint();
    const docRef = adminDb.collection(collectionPath).doc(docId);

    await docRef.set({
      ...blueprint,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('[Provisioner] Created admin persona (Jasper)', {
      path: `${collectionPath}/${docId}`,
      file: 'provisioner/index.ts',
    });

    return {
      target,
      action: 'created',
      documentId: docId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Provisioner] Error provisioning admin persona', error, {
      file: 'provisioner/index.ts',
    });
    return {
      target,
      action: 'error',
      documentId: docId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Provision industry personas (12 industries)
 */
async function provisionIndustryPersonas(): Promise<ProvisionResult[]> {
  const results: ProvisionResult[] = [];
  const blueprints = getIndustryPersonaBlueprints();
  const collectionPath = buildPath('system_personas_industries');

  for (const [industryId, blueprint] of Object.entries(blueprints)) {
    try {
      const exists = await documentExists(collectionPath, industryId);

      if (exists) {
        results.push({
          target: 'INDUSTRY_PERSONAS',
          action: 'skipped',
          documentId: industryId,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      if (!adminDb) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      const docRef = adminDb.collection(collectionPath).doc(industryId);

      await docRef.set({
        ...blueprint,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`[Provisioner] Created industry persona: ${industryId}`, {
        path: `${collectionPath}/${industryId}`,
        file: 'provisioner/index.ts',
      });

      results.push({
        target: 'INDUSTRY_PERSONAS',
        action: 'created',
        documentId: industryId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`[Provisioner] Error provisioning industry persona: ${industryId}`, error, {
        file: 'provisioner/index.ts',
      });
      results.push({
        target: 'INDUSTRY_PERSONAS',
        action: 'error',
        documentId: industryId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Provision pricing tiers
 */
async function provisionPricingTiers(): Promise<ProvisionResult[]> {
  const results: ProvisionResult[] = [];
  const blueprints = getPricingTierBlueprints();
  const collectionPath = COLLECTIONS.PLATFORM_PRICING;

  for (const [tierId, blueprint] of Object.entries(blueprints)) {
    try {
      const exists = await documentExists(collectionPath, tierId);

      if (exists) {
        results.push({
          target: 'PRICING_TIERS',
          action: 'skipped',
          documentId: tierId,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      if (!adminDb) {
        throw new Error('Firebase Admin SDK not initialized');
      }

      const docRef = adminDb.collection(collectionPath).doc(tierId);

      await docRef.set({
        ...blueprint,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`[Provisioner] Created pricing tier: ${tierId}`, {
        path: `${collectionPath}/${tierId}`,
        file: 'provisioner/index.ts',
      });

      results.push({
        target: 'PRICING_TIERS',
        action: 'created',
        documentId: tierId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`[Provisioner] Error provisioning pricing tier: ${tierId}`, error, {
        file: 'provisioner/index.ts',
      });
      results.push({
        target: 'PRICING_TIERS',
        action: 'error',
        documentId: tierId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run the database provisioner
 *
 * This is the main entry point. Call this on app initialization
 * (e.g., in AdminOrchestrator) to ensure all core data exists.
 *
 * @returns ProvisionReport with details of what was provisioned
 */
export async function runProvisioner(): Promise<ProvisionReport> {
  // Prevent concurrent runs
  if (isProvisioning) {
    logger.warn('[Provisioner] Already running, returning last report', {
      file: 'provisioner/index.ts',
    });
    return (
      lastProvisionReport ?? {
        environment: 'unknown',
        projectId: 'unknown',
        prefix: '',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results: [],
        summary: { created: 0, skipped: 0, errors: 0 },
      }
    );
  }

  setProvisioningState(true);
  const envInfo = getEnvironmentInfo();
  const startedAt = new Date().toISOString();
  const results: ProvisionResult[] = [];

  logger.info('[Provisioner] Starting database provisioning', {
    ...envInfo,
    file: 'provisioner/index.ts',
  });

  try {
    // Check Firebase Admin SDK is initialized
    if (!adminDb) {
      logger.error('[Provisioner] Firebase Admin SDK not initialized - cannot provision', {
        file: 'provisioner/index.ts',
      });
      return {
        environment: envInfo.env,
        projectId: envInfo.projectId,
        prefix: envInfo.prefix,
        startedAt,
        completedAt: new Date().toISOString(),
        results: [],
        summary: { created: 0, skipped: 0, errors: 0 },
      };
    }

    logger.info('[Provisioner] Using Firebase Admin SDK (bypasses security rules)', {
      file: 'provisioner/index.ts',
    });

    // 1. Provision System Config
    results.push(await provisionSystemConfig());

    // 2. Provision Admin Persona (Jasper)
    results.push(await provisionAdminPersona());

    // 3. Provision Industry Personas
    const industryResults = await provisionIndustryPersonas();
    results.push(...industryResults);

    // 4. Provision Pricing Tiers
    const pricingResults = await provisionPricingTiers();
    results.push(...pricingResults);

    // Build report
    const report: ProvisionReport = {
      environment: envInfo.env,
      projectId: envInfo.projectId,
      prefix: envInfo.prefix,
      startedAt,
      completedAt: new Date().toISOString(),
      results,
      summary: {
        created: results.filter((r) => r.action === 'created').length,
        skipped: results.filter((r) => r.action === 'skipped').length,
        errors: results.filter((r) => r.action === 'error').length,
      },
    };

    lastProvisionReport = report;

    logger.info('[Provisioner] Provisioning complete', {
      ...report.summary,
      environment: envInfo.env,
      file: 'provisioner/index.ts',
    });

    return report;
  } catch (error) {
    logger.error('[Provisioner] Fatal error during provisioning', error, {
      file: 'provisioner/index.ts',
    });

    const report: ProvisionReport = {
      environment: envInfo.env,
      projectId: envInfo.projectId,
      prefix: envInfo.prefix,
      startedAt,
      completedAt: new Date().toISOString(),
      results,
      summary: {
        created: results.filter((r) => r.action === 'created').length,
        skipped: results.filter((r) => r.action === 'skipped').length,
        errors: results.filter((r) => r.action === 'error').length + 1,
      },
    };

    lastProvisionReport = report;
    return report;
  } finally {
    // Reset provisioning flag - this is safe as we're in a finally block
    // and the function is synchronously setting this at the start
    setProvisioningState(false);
  }
}

/**
 * Helper to set provisioning state (avoids ESLint race condition warning)
 */
function setProvisioningState(state: boolean): void {
  isProvisioning = state;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get the last provision report (for debugging/monitoring)
 */
export function getLastProvisionReport(): ProvisionReport | null {
  return lastProvisionReport;
}

/**
 * Check if provisioning is currently running
 */
export function isProvisioningInProgress(): boolean {
  return isProvisioning;
}

/**
 * Re-export types for external use
 */
export type { ProvisionResult, ProvisionReport } from './types';
