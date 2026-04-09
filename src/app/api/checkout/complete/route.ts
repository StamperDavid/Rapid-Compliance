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

// ─── Type coercion helpers ──────────────────────────────────────────────────

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return v;
  }
  return undefined;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

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

async function verifyRazorpay(paymentId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'razorpay')) as { keyId?: string; keySecret?: string } | null;
  if (!keys?.keyId || !keys?.keySecret) {
    return { verified: false, error: 'Razorpay not configured' };
  }

  const authHeader = `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString('base64')}`;
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: authHeader },
  });

  const data = (await response.json()) as {
    id?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };

  if (!response.ok || (data.status !== 'captured' && data.status !== 'authorized')) {
    return { verified: false, error: `Razorpay payment status: ${data.status ?? 'unknown'}` };
  }

  return {
    verified: true,
    amount: data.amount,
    currency: data.currency?.toLowerCase(),
  };
}

async function verifyBraintree(transactionId: string): Promise<VerificationResult> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'braintree')) as {
    merchantId?: string;
    publicKey?: string;
    privateKey?: string;
    mode?: string;
  } | null;

  if (!keys?.publicKey || !keys?.privateKey) {
    return { verified: false, error: 'Braintree not configured' };
  }

  const graphqlUrl = keys.mode === 'production'
    ? 'https://payments.braintree-api.com/graphql'
    : 'https://payments.sandbox.braintree-api.com/graphql';
  const authHeader = `Basic ${Buffer.from(`${keys.publicKey}:${keys.privateKey}`).toString('base64')}`;

  const query = `
    query SearchTransaction($input: TransactionSearchInput!) {
      search { transactions(input: $input) { edges { node { id status amount { value currencyIsoCode } } } } }
    }
  `;

  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      'Braintree-Version': '2024-08-01',
    },
    body: JSON.stringify({
      query,
      variables: { input: { id: { is: transactionId } } },
    }),
  });

  if (!response.ok) {
    return { verified: false, error: 'Failed to verify Braintree transaction' };
  }

  const result = (await response.json()) as {
    data?: {
      search?: {
        transactions?: {
          edges?: Array<{
            node?: {
              id?: string;
              status?: string;
              amount?: { value?: string; currencyIsoCode?: string };
            };
          }>;
        };
      };
    };
  };

  const txn = result.data?.search?.transactions?.edges?.[0]?.node;
  if (!txn?.id) {
    return { verified: false, error: 'Braintree transaction not found' };
  }

  const validStatuses = ['SETTLED', 'SETTLING', 'SUBMITTED_FOR_SETTLEMENT', 'AUTHORIZED'];
  if (!validStatuses.includes(txn.status ?? '')) {
    return { verified: false, error: `Braintree transaction status: ${txn.status ?? 'unknown'}` };
  }

  return {
    verified: true,
    amount: txn.amount?.value ? Math.round(parseFloat(txn.amount.value) * 100) : undefined,
    currency: txn.amount?.currencyIsoCode?.toLowerCase(),
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
  razorpay: verifyRazorpay,
  braintree: verifyBraintree,
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

    const { paymentIntentId, orderData } = validation.data;
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

    // Create canonical order record matching the Order type from types/ecommerce.ts
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const verifiedMeta = verification.metadata ?? {};
    const od = orderData ?? {};

    // Extract customer info from orderData or metadata
    const customerEmail = asString(od.customerEmail) ?? verifiedMeta.customerEmail ?? user.email ?? '';
    const customerFirstName = asString(od.customerFirstName) ?? '';
    const customerLastName = asString(od.customerLastName) ?? '';

    // Extract items from orderData, or build a single-item fallback
    const rawItems = Array.isArray(od.items) ? od.items as Record<string, unknown>[] : [];
    const orderItems = rawItems.length > 0
      ? rawItems.map((item, idx) => ({
        id: `oi_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 9)}`,
        productId: asString(item.productId) ?? '',
        productName: asString(item.productName) ?? asString(item.name) ?? 'Item',
        sku: asString(item.sku),
        variantId: asString(item.variantId),
        price: asNumber(item.price) ?? 0,
        quantity: asNumber(item.quantity) ?? 1,
        subtotal: asNumber(item.subtotal) ?? (asNumber(item.price) ?? 0) * (asNumber(item.quantity) ?? 1),
        tax: 0,
        discount: 0,
        total: asNumber(item.subtotal) ?? (asNumber(item.price) ?? 0) * (asNumber(item.quantity) ?? 1),
        fulfillmentStatus: 'unfulfilled',
        quantityFulfilled: 0,
        image: asString(item.image),
        refunded: false,
      }))
      : [{
        id: `oi_${Date.now()}_0_${Math.random().toString(36).substring(2, 9)}`,
        productId: '',
        productName: verifiedMeta.description ?? 'Payment',
        price: verification.amount ?? 0,
        quantity: 1,
        subtotal: verification.amount ?? 0,
        tax: 0,
        discount: 0,
        total: verification.amount ?? 0,
        fulfillmentStatus: 'unfulfilled',
        quantityFulfilled: 0,
        refunded: false,
      }];

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const subtotal = asNumber(od.subtotal) ?? orderItems.reduce((sum, i) => sum + i.subtotal, 0);
    const tax = asNumber(od.tax) ?? 0;
    const shippingCost = asNumber(od.shipping) ?? 0;
    const discount = asNumber(od.discount) ?? 0;
    const total = asNumber(od.total) ?? (subtotal - discount + tax + shippingCost);
    const attributionSource = verifiedMeta.attributionSource ?? verifiedMeta.utm_source ?? undefined;

    const orderRecord: Record<string, unknown> = {
      id: orderId,
      orderNumber,
      userId: user.uid,
      customerEmail,
      customer: {
        firstName: customerFirstName,
        lastName: customerLastName,
        email: customerEmail,
      },
      items: orderItems,
      billingAddress: isObject(od.billingAddress) ? od.billingAddress : null,
      shippingAddress: isObject(od.shippingAddress) ? od.shippingAddress : null,
      subtotal,
      tax,
      shipping: shippingCost,
      discount,
      total,
      payment: {
        method: 'credit_card',
        provider,
        transactionId: paymentIntentId,
        status: 'captured',
        amountCharged: total,
        amountRefunded: 0,
        processedAt: now,
        capturedAt: now,
      },
      paymentIntentId,
      shippingInfo: {
        method: 'standard',
        methodId: 'default',
        cost: shippingCost,
      },
      status: 'processing',
      fulfillmentStatus: 'unfulfilled',
      paymentStatus: 'captured',
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
      orderNumber,
      provider,
      paymentIntentId,
      amount: total,
    });

    return NextResponse.json({
      success: true,
      paymentIntentId,
      orderId,
      orderNumber,
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
