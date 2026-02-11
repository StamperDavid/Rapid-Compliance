/**
 * API Keys Management Route
 * Reads/writes keys via apiKeyService (correct Firestore path)
 * and uses key-mapping to translate between flat UI IDs and nested config paths.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import {
  flattenConfigToUI,
  applyUIKeyToConfig,
  UI_TO_CONFIG_MAP,
} from '@/lib/api-keys/key-mapping';
import type { APIKeysConfig } from '@/types/api-keys';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Zod schemas
const SaveKeySchema = z.object({
  service: z.string().min(1, 'service is required'),
  key: z.string().min(1, 'key is required'),
});

const DeleteKeySchema = z.object({
  service: z.string().min(1, 'service is required'),
});

interface FirestoreError {
  code?: string;
  message?: string;
}

function isFirestoreError(error: unknown): error is FirestoreError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * GET - Load API keys for organization (masked)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/settings/api-keys');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Penthouse model: any authenticated user can manage API keys
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Load keys via apiKeyService (correct 4-segment Firestore path)
    const config = await apiKeyService.getKeys();

    // Flatten nested config → flat UI IDs, then mask values
    const flatKeys = config ? flattenConfigToUI(config) : {};
    const maskedKeys: Record<string, string> = {};

    for (const [service, value] of Object.entries(flatKeys)) {
      if (value.length > 8) {
        maskedKeys[service] = '\u2022'.repeat(value.length - 4) + value.slice(-4);
      } else if (value.length > 0) {
        maskedKeys[service] = '\u2022'.repeat(value.length);
      }
    }

    return NextResponse.json({
      success: true,
      keys: maskedKeys,
    });
  } catch (error: unknown) {
    logger.error('API keys loading error', error instanceof Error ? error : new Error(String(error)), { route: '/api/settings/api-keys' });

    if (isFirestoreError(error) && error.code === 'permission-denied') {
      return handleAPIError(errors.forbidden('You do not have permission to view API keys'));
    }

    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * POST - Save a single API key
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Penthouse model: any authenticated user can manage API keys
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    // Validate with Zod
    const parsed = SaveKeySchema.safeParse(body);
    if (!parsed.success) {
      return handleAPIError(
        errors.badRequest('Missing or invalid fields', { errors: parsed.error.issues })
      );
    }

    const { service, key } = parsed.data;

    // Reject unknown service IDs
    if (!UI_TO_CONFIG_MAP[service]) {
      return handleAPIError(errors.badRequest(`Unknown service: ${service}`));
    }

    // Load existing config, deep-clone to avoid mutating the cache
    const existing = await apiKeyService.getKeys();
    const configObj: Record<string, unknown> = existing
      ? structuredClone(existing) as unknown as Record<string, unknown>
      : {};

    // Apply the new key at the correct nested path
    applyUIKeyToConfig(configObj, service, key);

    // Save via apiKeyService (correct path + auto cache invalidation)
    await apiKeyService.saveKeys(configObj as Partial<APIKeysConfig>);

    logger.info('API key saved', { route: '/api/settings/api-keys', service });

    return NextResponse.json({
      success: true,
      message: `${service} API key saved successfully`,
    });
  } catch (error: unknown) {
    logger.error('API keys saving error', error instanceof Error ? error : new Error(String(error)), { route: '/api/settings/api-keys' });

    if (isFirestoreError(error) && error.code === 'permission-denied') {
      return handleAPIError(errors.forbidden('You do not have permission to save API keys'));
    }

    if (isFirestoreError(error) && error.code === 'not-found') {
      return handleAPIError(errors.notFound('Organization'));
    }

    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * DELETE - Remove a single API key
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parsed = DeleteKeySchema.safeParse(body);
    if (!parsed.success) {
      return handleAPIError(
        errors.badRequest('Missing or invalid fields', { errors: parsed.error.issues })
      );
    }

    const { service } = parsed.data;

    if (!UI_TO_CONFIG_MAP[service]) {
      return handleAPIError(errors.badRequest(`Unknown service: ${service}`));
    }

    // Load existing config, set the key to empty string to clear it
    const existing = await apiKeyService.getKeys();
    const configObj: Record<string, unknown> = existing
      ? structuredClone(existing) as unknown as Record<string, unknown>
      : {};

    applyUIKeyToConfig(configObj, service, '');

    await apiKeyService.saveKeys(configObj as Partial<APIKeysConfig>);

    logger.info('API key deleted', { route: '/api/settings/api-keys', service });

    return NextResponse.json({
      success: true,
      message: `${service} API key removed`,
    });
  } catch (error: unknown) {
    logger.error('API keys deletion error', error instanceof Error ? error : new Error(String(error)), { route: '/api/settings/api-keys' });

    if (isFirestoreError(error) && error.code === 'permission-denied') {
      return handleAPIError(errors.forbidden('You do not have permission to delete API keys'));
    }

    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
