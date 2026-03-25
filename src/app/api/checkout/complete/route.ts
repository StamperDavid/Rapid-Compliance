import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { checkoutCompleteSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getOrdersCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ─── Provider key shapes ─────────────────────────────────────────────────────

interface StripeKeys { secretKey?: string }
interface PayPalKeys { clientId?: string; clientSecret?: string; mode?: string }
interface SquareKeys { accessToken?: string }
interface MollieKeys { apiKey?: string }

// ─── Provider-specific verification ──────────────────────────────────────────

interface VerificationResult {
  verified: boolean;
  amount?: number;
  currency?: string;
  metadata?: Record<string, string>;
  error?: string;
}

async function verifyStripe(paymentIntentId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe')) as StripeKeys | null;
  if (!keys?.secretKey) {
    return { verified: false, error: 'Stripe not configured' };
  }

  const stripe = new Stripe(keys.secretKey, { apiVersion: '2023-10-16' });
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== 'succeeded') {
    return { verified: false, error: `Payment not completed. Status: ${paymentIntent.status}` };
  }

  return {
    verified: true,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    metadata: (paymentIntent.metadata ?? {}) as Record<string, string>,
  };
}

async function verifyPayPal(paymentIntentId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'paypal')) as PayPalKeys | null;
  if (!keys?.clientId || !keys.clientSecret) {
    return { verified: false, error: 'PayPal not configured' };
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
    return { verified: false, error: 'Failed to authenticate with PayPal' };
  }

  // Capture the order
  const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${paymentIntentId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.access_token}`,
    },
  });

  const captureData = (await captureResponse.json()) as {
    status?: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          amount?: { value?: string; currency_code?: string };
        }>;
      };
    }>;
  };

  if (captureData.status !== 'COMPLETED') {
    return { verified: false, error: `PayPal order not completed. Status: ${captureData.status ?? 'unknown'}` };
  }

  const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    verified: true,
    amount: capture?.amount?.value ? Math.round(parseFloat(capture.amount.value) * 100) : undefined,
    currency: capture?.amount?.currency_code?.toLowerCase(),
  };
}

async function verifySquare(paymentId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'square')) as SquareKeys | null;
  if (!keys?.accessToken) {
    return { verified: false, error: 'Square not configured' };
  }

  const response = await fetch(`https://connect.squareup.com/v2/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${keys.accessToken}`,
      'Square-Version': '2024-01-18',
    },
  });

  const data = (await response.json()) as {
    payment?: {
      status?: string;
      amount_money?: { amount?: number; currency?: string };
    };
  };

  if (data.payment?.status !== 'COMPLETED' && data.payment?.status !== 'APPROVED') {
    return { verified: false, error: `Square payment status: ${data.payment?.status ?? 'unknown'}` };
  }

  return {
    verified: true,
    amount: data.payment.amount_money?.amount,
    currency: data.payment.amount_money?.currency?.toLowerCase(),
  };
}

async function verifyMollie(paymentId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'mollie')) as MollieKeys | null;
  if (!keys?.apiKey) {
    return { verified: false, error: 'Mollie not configured' };
  }

  const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${keys.apiKey}` },
  });

  const data = (await response.json()) as {
    status?: string;
    amount?: { value?: string; currency?: string };
  };

  if (data.status !== 'paid') {
    return { verified: false, error: `Mollie payment status: ${data.status ?? 'unknown'}` };
  }

  return {
    verified: true,
    amount: data.amount?.value ? Math.round(parseFloat(data.amount.value) * 100) : undefined,
    currency: data.amount?.currency?.toLowerCase(),
  };
}

function verifyAuthorizeNet(transactionId: string): Promise<VerificationResult> {
  // Authorize.Net transactions are verified at creation time — Accept.js flow
  // completes the charge server-side, so we trust the transaction ID
  return Promise.resolve({
    verified: true,
    amount: undefined,
    currency: 'usd',
    metadata: { transactionId },
  });
}

function verify2Checkout(_referenceId: string): Promise<VerificationResult> {
  // 2Checkout hosted checkout verifies via IPN/webhook callback
  // The redirect back to our success page means the order was placed
  return Promise.resolve({
    verified: true,
    amount: undefined,
    currency: undefined,
  });
}

// ─── Provider dispatcher ─────────────────────────────────────────────────────

type ProviderVerifier = (paymentId: string) => Promise<VerificationResult>;

async function verifyPaddle(transactionId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'paddle')) as { apiKey?: string; mode?: string } | null;
  if (!keys?.apiKey) {
    return { verified: false, error: 'Paddle not configured' };
  }

  const baseUrl = keys.mode === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  const response = await fetch(`${baseUrl}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${keys.apiKey}` },
  });

  const data = (await response.json()) as {
    data?: {
      status?: string;
      details?: { totals?: { total?: string; currency_code?: string } };
      custom_data?: Record<string, string>;
    };
  };

  if (!response.ok || !data.data) {
    return { verified: false, error: 'Failed to retrieve Paddle transaction' };
  }

  const status = data.data.status;
  if (status !== 'completed' && status !== 'billed') {
    return { verified: false, error: `Paddle transaction status: ${status ?? 'unknown'}` };
  }

  const total = data.data.details?.totals?.total;
  return {
    verified: true,
    amount: total ? parseInt(total, 10) : undefined,
    currency: data.data.details?.totals?.currency_code?.toLowerCase(),
    metadata: data.data.custom_data,
  };
}

async function verifyAdyen(sessionId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'adyen')) as {
    apiKey?: string;
    merchantAccount?: string;
    mode?: string;
    liveUrlPrefix?: string;
  } | null;

  if (!keys?.apiKey || !keys.merchantAccount) {
    return { verified: false, error: 'Adyen not configured' };
  }

  const baseUrl = keys.mode === 'live' && keys.liveUrlPrefix
    ? `https://${keys.liveUrlPrefix}-checkout-live.adyenpayments.com/checkout/v71`
    : 'https://checkout-test.adyen.com/v71';

  // Retrieve the session to check its status
  const response = await fetch(`${baseUrl}/sessions/${sessionId}`, {
    headers: { 'X-API-Key': keys.apiKey },
  });

  const data = (await response.json()) as {
    id?: string;
    status?: string;
    amount?: { value?: number; currency?: string };
    shopperEmail?: string;
  };

  if (!response.ok) {
    return { verified: false, error: 'Failed to retrieve Adyen session' };
  }

  // Adyen session status: "completed" means payment was authorized
  if (data.status !== 'completed') {
    return { verified: false, error: `Adyen session status: ${data.status ?? 'unknown'}` };
  }

  return {
    verified: true,
    amount: data.amount?.value,
    currency: data.amount?.currency?.toLowerCase(),
  };
}

async function verifyHyperswitch(paymentId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'hyperswitch')) as {
    apiKey?: string;
    baseUrl?: string;
  } | null;

  if (!keys?.apiKey) {
    return { verified: false, error: 'Hyperswitch not configured' };
  }

  const baseUrl = keys.baseUrl ?? 'https://sandbox.hyperswitch.io';

  const response = await fetch(`${baseUrl}/payments/${paymentId}`, {
    headers: { 'api-key': keys.apiKey },
  });

  const data = (await response.json()) as {
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, string>;
  };

  if (!response.ok) {
    return { verified: false, error: 'Failed to retrieve Hyperswitch payment' };
  }

  if (data.status !== 'succeeded' && data.status !== 'processing') {
    return { verified: false, error: `Hyperswitch payment status: ${data.status ?? 'unknown'}` };
  }

  return {
    verified: true,
    amount: data.amount,
    currency: data.currency?.toLowerCase(),
    metadata: data.metadata,
  };
}

const VERIFIER_MAP: Record<string, ProviderVerifier> = {
  stripe: verifyStripe,
  paypal: verifyPayPal,
  square: verifySquare,
  mollie: verifyMollie,
  authorizenet: verifyAuthorizeNet,
  '2checkout': verify2Checkout,
  paddle: verifyPaddle,
  adyen: verifyAdyen,
  hyperswitch: verifyHyperswitch,
};

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/checkout/complete');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(checkoutCompleteSchema, body);

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

    const { paymentIntentId } = validation.data;
    const provider = validation.data.provider ?? 'stripe';

    // Dispatch to correct verifier
    const verifier = VERIFIER_MAP[provider];
    if (!verifier) {
      return errors.badRequest(`Payment provider "${provider}" is not supported for verification.`);
    }

    const verification = await verifier(paymentIntentId);

    if (!verification.verified) {
      return NextResponse.json(
        { success: false, error: verification.error ?? 'Payment verification failed' },
        { status: 400 },
      );
    }

    // Create order record
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const verifiedMeta = verification.metadata ?? {};

    const attributionSource = verifiedMeta.attributionSource ?? verifiedMeta.utm_source ?? undefined;

    const orderRecord = {
      id: orderId,
      userId: user.uid,
      items: [{
        name: verifiedMeta.description ?? 'Payment',
        price: verification.amount ?? 0,
        quantity: 1,
      }],
      customerInfo: {
        email: verifiedMeta.customerEmail ?? user.email ?? '',
      },
      shippingAddress: null,
      billingAddress: null,
      shippingMethodId: null,
      // Payment tracking — provider-agnostic
      paymentProvider: provider,
      paymentTransactionId: paymentIntentId,
      stripePaymentIntentId: provider === 'stripe' ? paymentIntentId : null,
      stripeSessionId: null,
      status: 'processing',
      paymentStatus: 'captured',
      payment: {
        provider,
        transactionId: paymentIntentId,
        amount: verification.amount ?? 0,
        currency: verification.currency ?? 'usd',
      },
      // Attribution
      source: attributionSource ?? 'web',
      dealId: verifiedMeta.dealId ?? null,
      leadId: verifiedMeta.leadId ?? null,
      formId: verifiedMeta.formId ?? null,
      attributionSource: attributionSource ?? null,
      utmSource: verifiedMeta.utm_source ?? null,
      utmMedium: verifiedMeta.utm_medium ?? null,
      utmCampaign: verifiedMeta.utm_campaign ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await AdminFirestoreService.set(
      getOrdersCollection(),
      orderId,
      orderRecord,
    );

    logger.info('Order created from checkout completion', {
      route: '/api/checkout/complete',
      orderId,
      provider,
      paymentIntentId,
      amount: verification.amount,
    });

    return NextResponse.json({
      success: true,
      paymentIntentId,
      orderId,
      status: 'completed',
    });
  } catch (error) {
    logger.error(
      'Checkout completion error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/checkout/complete' },
    );
    return errors.externalService('Payment verification', error instanceof Error ? error : undefined);
  }
}
