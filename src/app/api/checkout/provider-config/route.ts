import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

/** Shape of the ecommerce/config document's payments section */
interface EcommercePaymentProvider {
  provider: string;
  isDefault: boolean;
  enabled: boolean;
}

interface EcommerceConfig {
  payments?: {
    providers?: EcommercePaymentProvider[];
  };
}

/** Shape of Stripe keys from apiKeyService */
interface StripeKeysShape {
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

/**
 * Resolve the client-facing publishable key for a payment provider.
 * All keys come from Firestore via apiKeyService — no env vars.
 */
async function getClientKey(providerName: string): Promise<string | null> {
  switch (providerName) {
    case 'stripe': {
      const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe')) as StripeKeysShape | null;
      return keys?.publicKey ?? null;
    }
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/checkout/provider-config');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Read ecommerce config from Firestore
    const configDoc = await AdminFirestoreService.get(
      getSubCollection('ecommerce'),
      'config',
    );

    let providerName = 'stripe';
    if (configDoc) {
      const config = configDoc as unknown as EcommerceConfig;
      const defaultProvider = config.payments?.providers?.find(
        (p) => p.isDefault && p.enabled,
      );
      if (defaultProvider) {
        providerName = defaultProvider.provider;
      }
    }

    const clientKey = await getClientKey(providerName);

    return NextResponse.json({
      success: true,
      provider: providerName,
      clientKey,
    });
  } catch (error) {
    logger.error(
      'Provider config error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/checkout/provider-config' },
    );
    return errors.internal('Failed to load payment provider configuration');
  }
}
