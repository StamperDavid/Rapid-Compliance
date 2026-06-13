/**
 * Video Provider — credential resolution + usage metering seams (Phase 0)
 *
 * This module is the single place engine credentials are resolved and the
 * single place usage is recorded. Today both behaviors are the simple
 * single-tenant (managed) path. They are isolated here so the multi-tenant
 * BYOK + wallet-billing flip is an additive change inside these two functions,
 * not a sweep across every provider.
 */

import type { APIServiceName } from '@/types/api-keys';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import type { VideoEngineId } from '@/types/video-pipeline';
import type { TenantContext } from './types';

/** Maps an engine id to the apiKeyService service name that holds its key. */
const ENGINE_API_KEY_SERVICE: Record<VideoEngineId, APIServiceName> = {
  hedra: 'hedra',
  fal: 'fal',
};

export interface EngineCredentials {
  /** The resolved API key string. */
  apiKey: string;
  /**
   * true  = key is OUR master account → usage is metered for wallet billing.
   * false = key is the tenant's own (BYOK) → not metered.
   *
   * Single-tenant today: always managed (true). The BYOK seam is documented
   * below and resolves here once multi-tenancy returns.
   */
  metered: boolean;
}

/**
 * Resolve the API key + metering flag for an engine within a tenant context.
 *
 * MANAGED PATH (today, single-tenant): we hold one master key per engine in
 * Firestore via apiKeyService; usage is metered (metered: true).
 *
 * BYOK SEAM (multi-tenant future): when a tenant supplies their own key we would
 * resolve it here keyed by `ctx.tenantId` and return metered: false. Until the
 * multi-tenant flip there is exactly one tenant (PLATFORM_ID) and exactly one
 * managed key per engine, so this always returns the managed key.
 */
export async function resolveEngineCredentials(
  engineId: VideoEngineId,
  ctx: TenantContext,
): Promise<EngineCredentials> {
  const service = ENGINE_API_KEY_SERVICE[engineId];

  // Managed master key. apiKeyService.getServiceKey's first arg is the platform/
  // tenant scope — pass ctx.tenantId so this is already tenant-aware. In
  // single-tenant mode ctx.tenantId === PLATFORM_ID.
  const key = await apiKeyService.getServiceKey(ctx.tenantId, service);

  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(
      `No API key configured for video engine "${engineId}" (service "${service}"). Add it in Settings > API Keys.`,
    );
  }

  return { apiKey: key, metered: true };
}

/**
 * Record a unit of engine usage.
 *
 * METERING STUB — wallet billing activates at the multi-tenant flip. For now this
 * ONLY logs; no Firestore write, no Stripe charge. When the managed credits
 * wallet ships, this is where per-tenant metered usage is debited.
 */
export async function recordUsage(
  ctx: TenantContext,
  engineId: VideoEngineId,
  model: string,
  units: number,
): Promise<void> {
  logger.info('[video-metering] usage recorded (metering stub — wallet billing activates at multi-tenant flip)', {
    tenantId: ctx.tenantId,
    engineId,
    model,
    units,
    file: 'providers/credentials.ts',
  });
  // No await target yet; keep async so the billing write is a drop-in later.
  return Promise.resolve();
}
