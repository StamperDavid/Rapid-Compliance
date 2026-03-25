import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const checkoutInitiateSchema = z.object({
  amount: z.number().positive().max(999999.99),
  currency: z.string().length(3).default('usd'),
  metadata: z.record(z.string()).optional(),
});

// ─── Firestore config types ──────────────────────────────────────────────────

interface EcommercePaymentProvider {
  provider: string;
  isDefault: boolean;
  enabled: boolean;
  mode?: string;
}

interface EcommerceConfig {
  payments?: {
    providers?: EcommercePaymentProvider[];
  };
}

// ─── Provider key shapes ─────────────────────────────────────────────────────

interface StripeKeys {
  secretKey?: string;
}

interface PayPalKeys {
  clientId?: string;
  clientSecret?: string;
  mode?: string;
}

interface SquareKeys {
  accessToken?: string;
  locationId?: string;
}

interface AuthorizeNetKeys {
  apiLoginId?: string;
  transactionKey?: string;
  mode?: string;
}

interface TwoCheckoutKeys {
  merchantCode?: string;
  secretKey?: string;
  mode?: string;
}

interface MollieKeys {
  apiKey?: string;
}

// ─── Provider-specific session creators ──────────────────────────────────────

interface InitiateResult {
  provider: string;
  clientSecret?: string;
  redirectUrl?: string;
  sessionId?: string;
}

async function initiateStripe(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
): Promise<InitiateResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe')) as StripeKeys | null;
  if (!keys?.secretKey) {
    throw new Error('Stripe not configured. Please add Stripe API keys in settings.');
  }

  const stripe = new Stripe(keys.secretKey, { apiVersion: '2023-10-16' });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: currency.toLowerCase(),
    metadata,
    automatic_payment_methods: { enabled: true },
  });

  return {
    provider: 'stripe',
    clientSecret: paymentIntent.client_secret ?? undefined,
    sessionId: paymentIntent.id,
  };
}

async function initiatePayPal(
  amount: number,
  currency: string,
  _metadata: Record<string, string>,
): Promise<InitiateResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'paypal')) as PayPalKeys | null;
  if (!keys?.clientId || !keys.clientSecret) {
    throw new Error('PayPal not configured. Please add PayPal API keys in settings.');
  }

  const baseUrl = keys.mode === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // Get access token
  const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${keys.clientId}:${keys.clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  const authData = (await authResponse.json()) as { access_token?: string };
  if (!authData.access_token) {
    throw new Error('Failed to authenticate with PayPal');
  }

  // Create order
  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.access_token}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency.toUpperCase(),
          value: amount.toFixed(2),
        },
      }],
      application_context: {
        return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout`,
      },
    }),
  });

  const orderData = (await orderResponse.json()) as {
    id?: string;
    links?: Array<{ rel?: string; href?: string }>;
  };

  if (!orderData.id) {
    throw new Error('Failed to create PayPal order');
  }

  const approveLink = orderData.links?.find((l) => l.rel === 'approve');

  return {
    provider: 'paypal',
    redirectUrl: approveLink?.href,
    sessionId: orderData.id,
  };
}

async function initiateSquare(
  amount: number,
  currency: string,
  _metadata: Record<string, string>,
): Promise<InitiateResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'square')) as SquareKeys | null;
  if (!keys?.accessToken || !keys.locationId) {
    throw new Error('Square not configured. Please add Square API keys in settings.');
  }

  const response = await fetch('https://connect.squareup.com/v2/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keys.accessToken}`,
      'Square-Version': '2024-01-18',
    },
    body: JSON.stringify({
      idempotency_key: `checkout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      amount_money: {
        amount: Math.round(amount * 100),
        currency: currency.toUpperCase(),
      },
      location_id: keys.locationId,
      autocomplete: false,
    }),
  });

  const data = (await response.json()) as {
    payment?: { id?: string };
    errors?: Array<{ detail?: string }>;
  };

  if (data.errors?.length) {
    throw new Error(data.errors[0]?.detail ?? 'Square payment creation failed');
  }

  return {
    provider: 'square',
    sessionId: data.payment?.id,
  };
}

async function initiateAuthorizeNet(
  _amount: number,
  _currency: string,
  _metadata: Record<string, string>,
): Promise<InitiateResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'authorizenet')) as AuthorizeNetKeys | null;
  if (!keys?.apiLoginId || !keys.transactionKey) {
    throw new Error('Authorize.Net not configured. Please add API keys in settings.');
  }

  // Authorize.Net Accept.js flow — return credentials for client-side tokenization
  // The actual charge happens after the client collects card data via Accept.js
  return {
    provider: 'authorizenet',
    sessionId: `authnet_${Date.now()}`,
    // Client needs the login ID for Accept.js initialization
    clientSecret: keys.apiLoginId,
  };
}

async function initiate2Checkout(
  amount: number,
  currency: string,
  _metadata: Record<string, string>,
): Promise<InitiateResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, '2checkout')) as TwoCheckoutKeys | null;
  if (!keys?.merchantCode || !keys.secretKey) {
    throw new Error('2Checkout not configured. Please add API keys in settings.');
  }

  const baseUrl = keys.mode === 'production'
    ? 'https://api.2checkout.com'
    : 'https://sandbox.2checkout.com';

  // 2Checkout hosted checkout — generate a redirect URL
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success`;
  const redirectUrl = `${baseUrl}/checkout/purchase?merchant=${keys.merchantCode}&dynamic=1&currency=${currency.toUpperCase()}&price=${amount.toFixed(2)}&return-url=${encodeURIComponent(returnUrl)}`;

  return {
    provider: '2checkout',
    redirectUrl,
    sessionId: `2co_${Date.now()}`,
  };
}

async function initiateMollie(
  amount: number,
  currency: string,
  _metadata: Record<string, string>,
): Promise<InitiateResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'mollie')) as MollieKeys | null;
  if (!keys?.apiKey) {
    throw new Error('Mollie not configured. Please add Mollie API key in settings.');
  }

  const response = await fetch('https://api.mollie.com/v2/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keys.apiKey}`,
    },
    body: JSON.stringify({
      amount: {
        currency: currency.toUpperCase(),
        value: amount.toFixed(2),
      },
      description: 'SalesVelocity.ai Checkout',
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success`,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/mollie`,
    }),
  });

  const data = (await response.json()) as {
    id?: string;
    _links?: { checkout?: { href?: string } };
  };

  if (!data.id) {
    throw new Error('Failed to create Mollie payment');
  }

  return {
    provider: 'mollie',
    redirectUrl: data._links?.checkout?.href,
    sessionId: data.id,
  };
}

async function initiatePaddle(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
): Promise<InitiateResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'paddle')) as { apiKey?: string; mode?: string } | null;
  if (!keys?.apiKey) {
    throw new Error('Paddle not configured. Please add Paddle API key in settings.');
  }

  const baseUrl = keys.mode === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  const response = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keys.apiKey}`,
    },
    body: JSON.stringify({
      items: [{
        price: {
          description: 'SalesVelocity.ai Checkout',
          name: 'Checkout Payment',
          unit_price: {
            amount: String(Math.round(amount * 100)),
            currency_code: currency.toUpperCase(),
          },
          quantity: { minimum: 1, maximum: 1 },
        },
        quantity: 1,
      }],
      checkout: {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success`,
      },
      customer: {
        email: metadata.customerEmail ?? metadata.userId ?? '',
      },
    }),
  });

  const data = (await response.json()) as {
    data?: { id?: string; checkout?: { url?: string } };
    error?: { detail?: string };
  };

  if (!response.ok || !data.data?.id) {
    throw new Error(data.error?.detail ?? 'Failed to create Paddle transaction');
  }

  return {
    provider: 'paddle',
    sessionId: data.data.id,
    // Paddle overlay uses sessionId, but also provide checkout URL for fallback
    redirectUrl: data.data.checkout?.url,
  };
}

async function initiateAdyen(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
): Promise<InitiateResult> {
  const { createAdyenSession } = await import('@/lib/ecommerce/adyen-provider');
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success?provider=adyen`;

  const result = await createAdyenSession(amount, currency, returnUrl, metadata);

  if ('error' in result) {
    throw new Error(result.error);
  }

  return {
    provider: 'adyen',
    sessionId: result.sessionId,
    // clientSecret carries the sessionData needed for Drop-in initialization
    clientSecret: result.sessionData,
  };
}

// ─── Provider dispatcher ─────────────────────────────────────────────────────

type ProviderInitiator = (
  amount: number,
  currency: string,
  metadata: Record<string, string>,
) => Promise<InitiateResult>;

const PROVIDER_MAP: Record<string, ProviderInitiator> = {
  stripe: initiateStripe,
  paypal: initiatePayPal,
  square: initiateSquare,
  authorizenet: initiateAuthorizeNet,
  '2checkout': initiate2Checkout,
  mollie: initiateMollie,
  paddle: initiatePaddle,
  adyen: initiateAdyen,
};

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/checkout/initiate');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(checkoutInitiateSchema, body);

    if (!validation.success) {
      interface ValidationErrorItem { path?: string[]; message?: string }
      interface ValidationErrorResult {
        success: false;
        errors?: { errors?: ValidationErrorItem[] };
      }
      const validationError = validation as ValidationErrorResult;
      const errorDetails = validationError.errors?.errors?.map((e: ValidationErrorItem) => {
        const joinedPath = e.path?.join('.');
        return {
          path: (joinedPath !== '' && joinedPath != null) ? joinedPath : 'unknown',
          message: (e.message !== '' && e.message != null) ? e.message : 'Validation error',
        };
      }) ?? [];
      return errors.validation('Validation failed', { errors: errorDetails });
    }

    const { amount, currency, metadata } = validation.data;

    // Read default provider from Firestore ecommerce config
    const configDoc = await AdminFirestoreService.get(
      getSubCollection('ecommerce'),
      'config',
    );

    let providerName = 'stripe'; // default fallback
    if (configDoc) {
      const config = configDoc as unknown as EcommerceConfig;
      const defaultProvider = config.payments?.providers?.find(
        (p) => p.isDefault && p.enabled,
      );
      if (defaultProvider) {
        providerName = defaultProvider.provider;
      }
    }

    // Build metadata
    const enrichedMetadata: Record<string, string> = {
      userId: user.uid,
      ...(metadata ?? {}),
    };

    // Dispatch to provider
    const initiator = PROVIDER_MAP[providerName];
    if (!initiator) {
      return errors.badRequest(`Payment provider "${providerName}" is not supported for checkout.`);
    }

    logger.info('Initiating checkout', {
      route: '/api/checkout/initiate',
      provider: providerName,
      amount,
      currency,
    });

    const result = await initiator(amount, currency ?? 'usd', enrichedMetadata);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(
      'Checkout initiation error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/checkout/initiate' },
    );

    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
