import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const STOREFRONT_DOC_ID = 'default';
const ECOMMERCE_DOC_ID = 'config';
const storefrontPath = getSubCollection('storefrontConfig');
const ecommercePath = getSubCollection('ecommerce');

const themeSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  fontFamily: z.string().optional(),
  headerStyle: z.string().optional(),
  productCardStyle: z.string().optional(),
  borderRadius: z.string().optional(),
  buttonRadius: z.string().optional(),
}).optional();

const paymentProcessingSchema = z.object({
  enablePayments: z.boolean(),
  stripeEnabled: z.boolean(),
  paypalEnabled: z.boolean(),
  squareEnabled: z.boolean(),
  authorizenetEnabled: z.boolean(),
  twocheckoutEnabled: z.boolean(),
  mollieEnabled: z.boolean(),
  paddleEnabled: z.boolean(),
  adyenEnabled: z.boolean(),
  chargebeeEnabled: z.boolean(),
  hyperswitchEnabled: z.boolean(),
  defaultProvider: z.string(),
  autoCreateOrder: z.boolean(),
  autoCreateInvoice: z.boolean(),
  autoRecordPayment: z.boolean(),
  currency: z.string(),
  taxRate: z.number(),
});

const storefrontConfigSchema = z.object({
  enabled: z.boolean(),
  businessType: z.enum(['products', 'services', 'both']),
  storeName: z.string(),
  storeUrl: z.string(),
  theme: themeSchema,
  productSchema: z.string(),
  serviceSchema: z.string(),
  checkoutSettings: z.object({
    enableGuestCheckout: z.boolean(),
    requirePhone: z.boolean(),
    collectShipping: z.boolean(),
  }),
  paymentProcessing: paymentProcessingSchema,
});

type PaymentProcessing = z.infer<typeof paymentProcessingSchema>;

/**
 * Derive the ecommerce/config payments.providers[] array from the storefront
 * payment-gateway toggles. Replicates the client page's providerMap transform.
 */
function buildProviders(pp: PaymentProcessing): Array<{ provider: string; enabled: boolean; isDefault: boolean }> {
  const providerMap: Array<{ key: keyof PaymentProcessing; id: string }> = [
    { key: 'stripeEnabled', id: 'stripe' },
    { key: 'paypalEnabled', id: 'paypal' },
    { key: 'squareEnabled', id: 'square' },
    { key: 'authorizenetEnabled', id: 'authorizenet' },
    { key: 'twocheckoutEnabled', id: '2checkout' },
    { key: 'mollieEnabled', id: 'mollie' },
    { key: 'paddleEnabled', id: 'paddle' },
    { key: 'adyenEnabled', id: 'adyen' },
    { key: 'hyperswitchEnabled', id: 'hyperswitch' },
  ];

  return providerMap
    .filter(({ key }) => Boolean(pp[key]))
    .map(({ id }) => ({
      provider: id,
      enabled: true,
      isDefault: id === pp.defaultProvider,
    }));
}

/**
 * GET /api/settings/storefront - Fetch the storefront config doc
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const config = await AdminFirestoreService.get(storefrontPath, STOREFRONT_DOC_ID);

    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch storefront config';
    logger.error('Failed to fetch storefront config', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/storefront/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Upsert handler shared by PUT and POST. Writes BOTH the storefrontConfig/default
 * doc AND the derived ecommerce/config payments.providers[] array.
 */
async function upsert(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body: unknown = await request.json();
  const bodyResult = storefrontConfigSchema.safeParse(body);

  if (!bodyResult.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: bodyResult.error.errors },
      { status: 400 }
    );
  }

  const config = bodyResult.data;
  const now = new Date().toISOString();

  // 1. Write the full storefront config doc
  await AdminFirestoreService.set(
    storefrontPath,
    STOREFRONT_DOC_ID,
    {
      ...config,
      updatedAt: now,
      updatedBy: authResult.user.uid,
    }
  );

  // 2. Sync payment-provider toggles → ecommerce/config (where processPayment() reads from)
  const providers = buildProviders(config.paymentProcessing);
  await AdminFirestoreService.set(
    ecommercePath,
    ECOMMERCE_DOC_ID,
    {
      payments: { providers },
      updatedAt: now,
    },
    true
  );

  return NextResponse.json({ success: true });
}

/**
 * PUT /api/settings/storefront - Upsert storefront config + ecommerce providers
 */
export async function PUT(request: NextRequest) {
  try {
    return await upsert(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save storefront config';
    logger.error('Failed to save storefront config', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/storefront/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings/storefront - Upsert storefront config (alias of PUT)
 */
export async function POST(request: NextRequest) {
  try {
    return await upsert(request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save storefront config';
    logger.error('Failed to save storefront config', error instanceof Error ? error : new Error(String(error)), { file: 'api/settings/storefront/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
