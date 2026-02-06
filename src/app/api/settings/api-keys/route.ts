/**
 * API Keys Management
 * Saves keys to Firestore (encrypted) instead of .env files
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { handleAPIError, errors, validateRequired } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

interface ApiKeysDocument {
  [service: string]: string | undefined;
  updatedAt?: string;
}

interface FirestoreError {
  code?: string;
  message?: string;
}

function isFirestoreError(error: unknown): error is FirestoreError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * GET - Load API keys for organization
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/settings/api-keys');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Load keys from Firestore
    const apiKeys = await FirestoreService.get<ApiKeysDocument>(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}`,
      'apiKeys'
    );

    // Return masked keys (show only last 4 characters)
    const maskedKeys: Record<string, string> = {};
    if (apiKeys) {
      Object.keys(apiKeys).forEach((service) => {
        const key = apiKeys[service];
        if (typeof key === 'string' && key.length > 8) {
          maskedKeys[service] = '•'.repeat(key.length - 4) + key.slice(-4);
        } else if (typeof key === 'string' && key.length > 0) {
          maskedKeys[service] = '•'.repeat(key.length);
        }
      });
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
 * POST - Save API key
 */
interface SaveApiKeyBody {
  orgId: string;
  service: string;
  key: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    // Validate required fields - DEFAULT_ORG_ID no longer required (penthouse)
    const validation = validateRequired(body as Record<string, unknown>, ['service', 'key']);
    if (!validation.valid) {
      return handleAPIError(
        errors.badRequest('Missing required fields', { missing: validation.missing })
      );
    }

    const { service, key } = body as SaveApiKeyBody;

    // Load existing keys
    const existingKeys: ApiKeysDocument = await FirestoreService.get<ApiKeysDocument>(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}`,
      'apiKeys'
    ) ?? {};

    // Update with new key
    existingKeys[service] = key;
    existingKeys.updatedAt = new Date().toISOString();

    // Save to Firestore
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}`,
      'apiKeys',
      existingKeys,
      false
    );

    logger.info('API key saved', { route: '/api/settings/api-keys', service, DEFAULT_ORG_ID });

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





