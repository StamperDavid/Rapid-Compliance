/**
 * Payment Service
 * Handles payment processing via Stripe and other providers
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { OrderPayment } from '@/types/ecommerce'
import { logger } from '@/lib/logger/logger';

export interface PaymentRequest {
  workspaceId: string;
  organizationId: string;
  amount: number; // In cents
  currency: string;
  paymentMethod: string;
  paymentToken?: string; // Stripe payment intent token, etc.
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
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
    `${COLLECTIONS.ORGANIZATIONS}/${request.organizationId}/workspaces/${request.workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    return {
      success: false,
      error: 'E-commerce not configured',
    };
  }
  
  const paymentConfig = (ecommerceConfig as any).payments;
  const defaultProvider = paymentConfig?.providers?.find((p: any) => p.isDefault && p.enabled);
  
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
  providerConfig: any
): Promise<PaymentResult> {
  try {
    // Get Stripe API key
    const orgId = request.organizationId || request.workspaceId.split('/')[0]; // Use org ID directly or extract from workspace
    const stripeKey = await apiKeyService.getServiceKey(orgId, 'stripe');
    
    if (!stripeKey) {
      return {
        success: false,
        error: 'Stripe API key not configured',
      };
    }
    
    const apiKey = typeof stripeKey === 'string' ? stripeKey : stripeKey.apiKey;
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
          cardLast4 = (pm as any).card?.last4;
          cardBrand = (pm as any).card?.brand;
        } catch (e) {
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
  } catch (error: any) {
    logger.error('Stripe payment error:', error, { file: 'payment-service.ts' });
    return {
      success: false,
      error:(error.message !== '' && error.message != null) ? error.message : 'Payment processing failed',
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
  providerConfig: any
): Promise<PaymentResult> {
  try {
    // Get Square API credentials
    const orgId = request.workspaceId.split('/')[0];
    const squareKeys = await apiKeyService.getServiceKey(orgId, 'square');
    
    if (!squareKeys) {
      return {
        success: false,
        error: 'Square API credentials not configured',
      };
    }
    
    const { accessToken, locationId } = squareKeys;
    
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
      environment: providerConfig.mode === 'production' ? square.SquareEnvironment.Production : square.SquareEnvironment.Sandbox,
    });
    
    // Create payment
    const response = await client.payments.create({
      sourceId: request.paymentToken ?? '', // Square payment token from frontend
      idempotencyKey: `${request.workspaceId}-${Date.now()}`, // Unique key
      amountMoney: {
        amount: BigInt(Math.round(request.amount * 100)), // Convert to cents
        currency: request.currency.toUpperCase() as any,
      },
      locationId,
      customerId: undefined, // Can link to Square customer
      referenceId: request.metadata?.orderId,
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
      return {
        success: false,
        error: response.errors?.[0]?(.detail !== '' && .detail != null) ? .detail : 'Square payment failed',
      };
    }
  } catch (error: any) {
    logger.error('Square payment error:', error, { file: 'payment-service.ts' });
    return {
      success: false,
      error:(error.message !== '' && error.message != null) ? error.message : 'Square payment processing failed',
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
  providerConfig: any
): Promise<PaymentResult> {
  try {
    // Get PayPal API credentials
    const orgId = request.workspaceId.split('/')[0];
    const paypalKeys = await apiKeyService.getServiceKey(orgId, 'paypal');
    
    if (!paypalKeys) {
      return {
        success: false,
        error: 'PayPal API credentials not configured',
      };
    }
    
    const { clientId, clientSecret, mode } = paypalKeys;
    
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
    
    const { access_token } = await authResponse.json();
    
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
          reference_id: request.metadata?(.orderId !== '' && .orderId != null) ? .orderId : 'default',
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
      const error = await orderResponse.json();
      return {
        success: false,
        error:(error.message !== '' && error.message != null) ? error.message : 'PayPal order creation failed',
      };
    }
    
    const order = await orderResponse.json();
    
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
      
      const captureResult = await captureResponse.json();
      
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
    
  } catch (error: any) {
    logger.error('PayPal payment error:', error, { file: 'payment-service.ts' });
    return {
      success: false,
      error:(error.message !== '' && error.message != null) ? error.message : 'PayPal payment processing failed',
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
  organizationId: string,
  transactionId: string,
  amount?: number
): Promise<PaymentResult> {
  // Get provider from transaction
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  // Find order with this transaction ID
  const { where } = await import('firebase/firestore');
  const orders = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/orders`,
    [where('payment.transactionId', '==', transactionId)]
  );
  
  if (orders.length === 0) {
    return {
      success: false,
      error: 'Order not found',
    };
  }
  
  const order = orders[0] as any;
  const provider = order.payment.provider;
  
  // Route to appropriate provider
  switch (provider) {
    case 'stripe':
      return refundStripePayment(transactionId, amount);
    
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
    const apiKeys = await apiKeyService.getKeys(workspaceId);
    
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
  } catch (error: any) {
    return {
      success: false,
      error:(error.message !== '' && error.message != null) ? error.message : 'Refund failed',
    };
  }
}

