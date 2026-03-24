import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

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

/** Providers whose client-side SDK needs a publishable key */
const CLIENT_KEY_ENV_MAP: Record<string, string | undefined> = {
  stripe: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

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

    if (!configDoc) {
      return NextResponse.json(
        { success: true, provider: 'stripe', clientKey: CLIENT_KEY_ENV_MAP.stripe ?? null },
        { status: 200 },
      );
    }

    const config = configDoc as unknown as EcommerceConfig;
    const defaultProvider = config.payments?.providers?.find(
      (p) => p.isDefault && p.enabled,
    );

    const providerName = defaultProvider?.provider ?? 'stripe';
    const clientKey = CLIENT_KEY_ENV_MAP[providerName] ?? null;

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
