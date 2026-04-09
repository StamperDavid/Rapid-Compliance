/**
 * Feature Configuration API
 *
 * GET  — Returns current feature config (or null for unconfigured users)
 * PUT  — Updates feature config (admin auth required, Zod validated)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/lib/auth/api-auth';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { getFeatureConfig, saveFeatureConfig } from '@/lib/services/feature-service';
import { updateFeatureConfigSchema } from '@/lib/validation/feature-schemas';
import type { FeatureConfig, FeatureModuleId } from '@/types/feature-modules';

export const dynamic = 'force-dynamic';

/**
 * GET — Load feature config.
 * If no config exists, auto-creates one from the org's industry category
 * (or all-enabled default). This ensures first login gets a real config.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    let config = await getFeatureConfig();

    // Auto-create config on first load if none exists
    if (!config) {
      try {
        const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
        const { COLLECTIONS } = await import('@/lib/db/firestore-service');
        const { PLATFORM_ID } = await import('@/lib/constants/platform');
        const { getIndustryFeatureConfig } = await import('@/lib/constants/feature-modules');

        // Read org's industry category
        const orgData = await AdminFirestoreService.get(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID) as Record<string, unknown> | null;
        const industryCategory = typeof orgData?.industryCategory === 'string' ? orgData.industryCategory : '';

        config = getIndustryFeatureConfig(industryCategory);
        config.updatedBy = authResult.user.uid;
        await saveFeatureConfig(config);
        logger.info('Feature config auto-created on first load', {
          route: '/api/features',
          industryCategory: industryCategory || '(default)',
        });
      } catch (initError) {
        logger.warn('Failed to auto-create feature config', {
          route: '/api/features',
          error: initError instanceof Error ? initError.message : String(initError),
        });
      }
    }

    // Reconcile: sync storefront enabled state into storefront feature module
    if (config) {
      try {
        const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
        const { getSubCollection } = await import('@/lib/firebase/collections');
        const storefrontData = await AdminFirestoreService.get(
          getSubCollection('storefrontConfig'),
          'default'
        ) as Record<string, unknown> | null;

        if (storefrontData && typeof storefrontData.enabled === 'boolean') {
          if (config.modules.storefront !== storefrontData.enabled) {
            config.modules.storefront = storefrontData.enabled;
            await saveFeatureConfig(config);
            logger.info('Feature config reconciled with storefront', {
              route: '/api/features',
              storefront: storefrontData.enabled,
            });
          }
        }
      } catch {
        // Non-critical reconciliation — don't block the response
      }

      // Reconcile: sync all module-specific configs into feature modules
      try {
        const { adminDb } = await import('@/lib/firebase/admin');
        const { PLATFORM_ID: pid } = await import('@/lib/constants/platform');

        if (!adminDb) { throw new Error('Admin DB not initialized'); }
        const moduleConfigSnap = await adminDb
          .collection(`organizations/${pid}/moduleConfig`)
          .get();

        if (!moduleConfigSnap.empty) {
          const validIds = new Set<string>([
            'crm_pipeline', 'conversations', 'sales_automation', 'email_outreach',
            'social_media', 'video_production', 'forms_surveys', 'workflows',
            'proposals_docs', 'advanced_analytics', 'website_builder', 'storefront',
          ]);

          let changed = false;
          for (const doc of moduleConfigSnap.docs) {
            const id = doc.id;
            if (!validIds.has(id)) { continue; }

            const data = doc.data();
            if (typeof data.enabled === 'boolean') {
              const moduleId = id as FeatureModuleId;
              if (config.modules[moduleId] !== data.enabled) {
                config.modules[moduleId] = data.enabled;
                changed = true;
              }
            }
          }

          if (changed) {
            await saveFeatureConfig(config);
            logger.info('Feature config reconciled with module configs', {
              route: '/api/features',
            });
          }
        }
      } catch {
        // Non-critical reconciliation — don't block the response
      }
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: unknown) {
    logger.error(
      'Feature config load error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/features' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * PUT — Update feature config
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requirePermission(request, 'canManageFeatureFlags');
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parsed = updateFeatureConfigSchema.safeParse(body);
    if (!parsed.success) {
      return handleAPIError(
        errors.badRequest('Invalid feature config', { errors: parsed.error.issues }),
      );
    }

    const userId = authResult.user.uid;

    const config: FeatureConfig = {
      modules: parsed.data.modules,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    await saveFeatureConfig(config);

    logger.info('Feature config updated', { route: '/api/features', userId });

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: unknown) {
    logger.error(
      'Feature config update error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/features' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
