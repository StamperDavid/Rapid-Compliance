/**
 * Payment Service
 * Handles payment processing via Stripe and other providers
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { OrderPayment } from '@/types/ecommerce';

export interface PaymentRequest {
  workspaceId: string;
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
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${request.workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    return {
      success: false,
      error: 'E-commerce not configured',
    };
  }
  
  const paymentConfig = (ecommerceConfig as any).payments;
  const defaultProvider = paymentConfig.providers?.find((p: any) => p.isDefault && p.enabled);
  
  if (!defaultProvider) {
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
    const orgId = request.workspaceId.split('/')[0]; // Extract org ID
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
    console.error('Stripe payment error:', error);
    return {
      success: false,
      error: error.message || 'Payment processing failed',
    };
  }
}

/**
 * Calculate Stripe processing fee
 */
function calculateStripeFee(amount: number): number {
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
  // TODO: Implement Square payment
  return {
    success: false,
    error: 'Square payment not yet implemented',
  };
}

/**
 * Process PayPal payment
 */
async function processPayPalPayment(
  request: PaymentRequest,
  providerConfig: any
): Promise<PaymentResult> {
  // TODO: Implement PayPal payment
  return {
    success: false,
    error: 'PayPal payment not yet implemented',
  };
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
  
  // Find order with this transaction ID
  const { where } = await import('firebase/firestore');
  const orders = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/orders`,
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
  amount?: number
): Promise<PaymentResult> {
  try {
    // Get Stripe API key (need to get from order's workspace)
    // For now, assume we have it
    const stripe = await import('stripe');
    // TODO: Get API key from workspace
    const stripeClient = new stripe.Stripe(process.env.STRIPE_SECRET_KEY || '', {
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
      error: error.message || 'Refund failed',
    };
  }
}

