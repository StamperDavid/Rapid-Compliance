/**
 * Payment Service
 * Handles payment processing via Stripe and other providers
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
// OrderPayment type not needed in this service
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Type interfaces for ecommerce configuration
interface PaymentProvider {
  provider: string;
  isDefault: boolean;
  enabled: boolean;
  mode?: string;
  [key: string]: unknown;
}

interface PaymentConfig {
  providers?: PaymentProvider[];
  [key: string]: unknown;
}

interface EcommerceConfig {
  payments?: PaymentConfig;
  [key: string]: unknown;
}

interface StripeKeyConfig {
  apiKey?: string;
  secretKey?: string;
  [key: string]: unknown;
}

interface SquareKeyConfig {
  accessToken?: string;
  locationId?: string;
  [key: string]: unknown;
}

interface PayPalKeyConfig {
  clientId?: string;
  clientSecret?: string;
  mode?: string;
  [key: string]: unknown;
}

interface PayPalAuthResponse {
  access_token: string;
  [key: string]: unknown;
}

interface PayPalOrder {
  id: string;
  status?: string;
  [key: string]: unknown;
}

interface PayPalCaptureResult {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface OrderRecord {
  payment: {
    transactionId: string;
    provider: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PaymentRequest {
  workspaceId: string;
  amount: number; // In dollars (converted to provider-specific units internally)
  currency: string;
  paymentMethod: string;
  paymentToken?: string; // Stripe payment intent token, etc.
  customerIp?: string; // Client IP for fraud detection (e.g., 2Checkout)
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  provider?: string;
  cardLast4?: string;
  cardBrand?: string;
  processingFee?: number;
  error?: string;
}

/**
 * Process payment
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  // Get e-commerce config to determine payment provider
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/${request.workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    return {
      success: false,
      error: 'E-commerce not configured',
    };
  }

  const typedConfig = ecommerceConfig as EcommerceConfig;
  const paymentConfig = typedConfig.payments;
  const defaultProvider = paymentConfig?.providers?.find((p: PaymentProvider) => p.isDefault && p.enabled);

  if (!paymentConfig || !defaultProvider) {
    return {
      success: false,
      error: 'No payment provider configured',
    };
  }

  // Route to appropriate provider
  switch (defaultProvider.provider) {
    case 'stripe':
      return processStripePayment(request, defaultProvider);
    
    case 'square':
      return processSquarePayment(request, defaultProvider);
    
    case 'paypal':
      return processPayPalPayment(request, defaultProvider);
    
    case 'authorizenet': {
      const { processAuthorizeNetPayment } = await import('./payment-providers');
      return processAuthorizeNetPayment(request, defaultProvider);
    }
    
    case '2checkout': {
      const { process2CheckoutPayment } = await import('./payment-providers');
      return process2CheckoutPayment(request, defaultProvider);
    }
    
    case 'mollie': {
      const { processMolliePayment } = await import('./payment-providers');
      return processMolliePayment(request, defaultProvider);
    }
    
    default:
      return {
        success: false,
        error: `Payment provider ${defaultProvider.provider} not yet implemented`,
      };
  }
}

/**
 * Process Stripe payment
 */
async function processStripePayment(
  request: PaymentRequest,
  _providerConfig: unknown
): Promise<PaymentResult> {
  try {
    // Get Stripe API key
    const stripeKeyResponse: unknown = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe');

    if (!stripeKeyResponse) {
      return {
        success: false,
        error: 'Stripe API key not configured',
      };
    }

    const typedStripeKey = stripeKeyResponse as string | StripeKeyConfig;
    const apiKey = typeof typedStripeKey === 'string' ? typedStripeKey : typedStripeKey.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'Stripe API key not found',
      };
    }

    // Use Stripe API
    const stripe = await import('stripe');
    const stripeClient = new stripe.Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });
    
    // Create payment intent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(request.amount * 100), // Convert to cents
      currency: request.currency.toLowerCase(),
      payment_method: request.paymentToken,
      confirm: true,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/complete`,
      metadata: {
        workspaceId: request.workspaceId,
        customerEmail: request.customer.email,
        ...request.metadata,
      },
    });
    
    if (paymentIntent.status === 'succeeded') {
      // Get payment method details if available
      let cardLast4: string | undefined;
      let cardBrand: string | undefined;
      
      if (paymentIntent.payment_method && typeof paymentIntent.payment_method === 'string') {
        // Fetch payment method details
        try {
          const pm = await stripeClient.paymentMethods.retrieve(paymentIntent.payment_method);
          const pmCard = pm.card as { last4?: string; brand?: string } | undefined;
          cardLast4 = pmCard?.last4;
          cardBrand = pmCard?.brand;
        } catch {
          // Ignore if can't fetch
        }
      }
      
      return {
        success: true,
        transactionId: paymentIntent.id,
        provider: 'stripe',
        cardLast4,
        cardBrand,
        processingFee: calculateStripeFee(request.amount),
      };
    } else {
      return {
        success: false,
        error: `Payment status: ${paymentIntent.status}`,
      };
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Stripe payment error:', err, { file: 'payment-service.ts' });
    return {
      success: false,
      error:(err.message !== '' && err.message != null) ? err.message : 'Payment processing failed',
    };
  }
}

/**
 * Calculate Stripe processing fee
 */
export function calculateStripeFee(amount: number): number {
  // Stripe fee: 2.9% + $0.30
  return amount * 0.029 + 0.30;
}

/**
 * Process Square payment
 */
async function processSquarePayment(
  request: PaymentRequest,
  _providerConfig: unknown
): Promise<PaymentResult> {
  try {
    // Get Square API credentials
    const squareKeysResponse: unknown = await apiKeyService.getServiceKey(PLATFORM_ID, 'square');

    if (!squareKeysResponse) {
      return {
        success: false,
        error: 'Square API credentials not configured',
      };
    }

    const typedSquareKeys = squareKeysResponse as SquareKeyConfig;
    const { accessToken, locationId } = typedSquareKeys;

    if (!accessToken || !locationId) {
      return {
        success: false,
        error: 'Square access token or location ID missing',
      };
    }

    // Use Square API
    const square = await import('square');
    const client = new square.SquareClient({
      token: accessToken,
      environment: _providerConfig && typeof _providerConfig === 'object' && 'mode' in _providerConfig && _providerConfig.mode === 'production'
        ? square.SquareEnvironment.Production
        : square.SquareEnvironment.Sandbox,
    });

    // Create payment
    const referenceId = request.metadata?.orderId;
    const response = await client.payments.create({
      sourceId: request.paymentToken ?? '', // Square payment token from frontend
      idempotencyKey: `${request.workspaceId}-${Date.now()}`, // Unique key
      amountMoney: {
        amount: BigInt(Math.round(request.amount * 100)), // Convert to cents
        currency: request.currency.toUpperCase() as 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'JPY',
      },
      locationId,
      customerId: undefined, // Can link to Square customer
      referenceId: typeof referenceId === 'string' ? referenceId : undefined,
      note: `Payment for ${request.customer.email}`,
      buyerEmailAddress: request.customer.email,
    });
    
    if (response.payment) {
      const payment = response.payment;
      
      return {
        success: true,
        transactionId: payment.id ?? '',
        provider: 'square',
        cardLast4: payment.cardDetails?.card?.last4,
        cardBrand: payment.cardDetails?.card?.cardBrand,
        processingFee: calculateSquareFee(request.amount),
      };
    } else {
      const errorDetail = response.errors?.[0]?.detail;
      return {
        success: false,
        error: (errorDetail !== '' && errorDetail != null) ? errorDetail : 'Square payment failed',
      };
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Square payment error:', err, { file: 'payment-service.ts' });
    const errorMessage = err.message;
    return {
      success: false,
      error: (errorMessage !== '' && errorMessage != null) ? errorMessage : 'Square payment processing failed',
    };
  }
}

/**
 * Calculate Square processing fee
 */
export function calculateSquareFee(amount: number): number {
  // Square fee: 2.6% + $0.10 (card present) or 2.9% + $0.30 (card not present)
  // Using card not present rate
  return amount * 0.029 + 0.30;
}

/**
 * Process PayPal payment
 */
async function processPayPalPayment(
  request: PaymentRequest,
  _providerConfig: unknown
): Promise<PaymentResult> {
  try {
    // Get PayPal API credentials
    const paypalKeysResponse: unknown = await apiKeyService.getServiceKey(PLATFORM_ID, 'paypal');

    if (!paypalKeysResponse) {
      return {
        success: false,
        error: 'PayPal API credentials not configured',
      };
    }

    const typedPayPalKeys = paypalKeysResponse as PayPalKeyConfig;
    const { clientId, clientSecret, mode } = typedPayPalKeys;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'PayPal client ID or secret missing',
      };
    }
    
    // PayPal API base URL
    const baseURL = mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Get access token
    const authResponse = await fetch(`${baseURL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!authResponse.ok) {
      return {
        success: false,
        error: 'PayPal authentication failed',
      };
    }

    const authData = await authResponse.json() as PayPalAuthResponse;
    const { access_token } = authData;
    
    // Create order
    const orderResponse = await fetch(`${baseURL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: (() => {
            const v = request.metadata?.orderId;
            return (typeof v === 'string' && v !== '') ? v : 'default';
          })(),
          amount: {
            currency_code: request.currency.toUpperCase(),
            value: request.amount.toFixed(2),
          },
          description: `Payment from ${request.customer.email}`,
        }],
        payer: {
          email_address: request.customer.email,
          name: {
            given_name: request.customer.firstName,
            surname: request.customer.lastName,
          },
        },
      }),
    });

    if (!orderResponse.ok) {
      const _errorResponse: unknown = await orderResponse.json();
      return {
        success: false,
        error: 'PayPal order creation failed',
      };
    }

    const order = await orderResponse.json() as PayPalOrder;
    
    // If we have a payment token (order ID from frontend), capture it
    if (request.paymentToken) {
      const captureResponse = await fetch(`${baseURL}/v2/checkout/orders/${request.paymentToken}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (!captureResponse.ok) {
        return {
          success: false,
          error: 'PayPal payment capture failed',
        };
      }

      const captureResult = await captureResponse.json() as PayPalCaptureResult;

      if (captureResult.status === 'COMPLETED') {
        return {
          success: true,
          transactionId: captureResult.id,
          provider: 'paypal',
          processingFee: calculatePayPalFee(request.amount),
        };
      } else {
        return {
          success: false,
          error: `PayPal payment status: ${captureResult.status}`,
        };
      }
    }

    // Return order ID for frontend to complete
    return {
      success: true,
      transactionId: order.id,
      provider: 'paypal',
    };


  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('PayPal payment error:', err, { file: 'payment-service.ts' });
    return {
      success: false,
      error:(err.message !== '' && err.message != null) ? err.message : 'PayPal payment processing failed',
    };
  }
}

/**
 * Calculate PayPal processing fee
 */
export function calculatePayPalFee(amount: number): number {
  // PayPal fee: 2.9% + $0.30 (standard)
  return amount * 0.029 + 0.30;
}

/**
 * Calculate Razorpay processing fee (approximate)
 */
export function calculateRazorpayFee(amount: number): number {
  // Razorpay: ~2% + small fixed; use 2% baseline
  return amount * 0.02;
}

/**
 * Refund payment
 */
export async function refundPayment(
  workspaceId: string,
  transactionId: string,
  amount?: number
): Promise<PaymentResult> {
  // Get provider from transaction
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

  // Find order with this transaction ID (canonical orders path)
  const { where } = await import('firebase/firestore');
  const orders = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/orders`,
    [where('payment.transactionId', '==', transactionId)]
  );
  
  if (orders.length === 0) {
    return {
      success: false,
      error: 'Order not found',
    };
  }

  const order = orders[0] as OrderRecord;
  const provider = order.payment.provider;

  // Route to appropriate provider
  switch (provider) {
    case 'stripe':
      return refundStripePayment(transactionId, amount, workspaceId);
    
    default:
      return {
        success: false,
        error: `Refund for provider ${provider} not yet implemented`,
      };
  }
}

/**
 * Refund Stripe payment
 */
async function refundStripePayment(
  transactionId: string,
  amount?: number,
  workspaceId?: string
): Promise<PaymentResult> {
  try {
    // Get Stripe API key from workspace settings
    // Note: workspaceId should be passed from the refund() caller
    if (!workspaceId) {
      throw new Error('Workspace ID required for Stripe refunds');
    }
    
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const apiKeys = await apiKeyService.getKeys();
    
    if (!apiKeys?.payments?.stripe?.secretKey) {
      throw new Error('Stripe not configured. Please add your Stripe API key in Settings > API Keys');
    }
    
    const stripe = await import('stripe');
    const stripeClient = new stripe.Stripe(apiKeys.payments.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });
    
    const refund = await stripeClient.refunds.create({
      payment_intent: transactionId,
      amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
    });
    
    return {
      success: true,
      transactionId: refund.id,
      provider: 'stripe',
    };
  } catch (error: unknown) {
      const err = error as Error;
    return {
      success: false,
      error:(err.message !== '' && err.message != null) ? err.message : 'Refund failed',
    };
  }
}

