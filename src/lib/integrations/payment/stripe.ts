/**
 * Stripe Integration
 * Payment processing functions
 */

import type { ConnectedIntegration } from '@/types/integrations';

/**
 * Execute a Stripe function
 */
export async function executeStripeFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const apiKey = integration.apiKey;
  
  if (!apiKey) {
    throw new Error('Stripe API key not configured');
  }
  
  switch (functionName) {
    case 'createStripeCheckout':
      // Validate required parameters
      if (typeof parameters.amount !== 'number') {
        throw new Error('amount (number) is required for createStripeCheckout');
      }
      if (!parameters.description || typeof parameters.description !== 'string') {
        throw new Error('description (string) is required for createStripeCheckout');
      }
      if (parameters.currency && typeof parameters.currency !== 'string') {
        throw new Error('currency must be a string');
      }
      if (parameters.customerEmail && typeof parameters.customerEmail !== 'string') {
        throw new Error('customerEmail must be a string');
      }
      
      return createCheckoutSession(
        {
          amount: parameters.amount,
          description: parameters.description,
          currency: parameters.currency,
          customerEmail: parameters.customerEmail,
        },
        apiKey
      );
      
    case 'createStripePaymentLink':
      // Validate required parameters
      if (typeof parameters.amount !== 'number') {
        throw new Error('amount (number) is required for createStripePaymentLink');
      }
      if (!parameters.description || typeof parameters.description !== 'string') {
        throw new Error('description (string) is required for createStripePaymentLink');
      }
      
      return createPaymentLink(
        {
          amount: parameters.amount,
          description: parameters.description,
        },
        apiKey
      );
      
    default:
      throw new Error(`Unknown Stripe function: ${functionName}`);
  }
}

/**
 * Create a Stripe checkout session
 */
async function createCheckoutSession(
  params: {
    amount: number;
    currency?: string;
    description: string;
    customerEmail?: string;
  },
  apiKey: string
): Promise<{ url: string; sessionId: string }> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(apiKey, { apiVersion: '2023-10-16' });
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: params.currency || 'usd',
          unit_amount: params.amount,
          product_data: {
            name: params.description,
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancelled`,
    customer_email: params.customerEmail,
  });
  
  return {
    url: session.url!,
    sessionId: session.id,
  };
}

/**
 * Create a simple payment link
 */
async function createPaymentLink(
  params: {
    amount: number;
    description: string;
  },
  apiKey: string
): Promise<{ url: string }> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(apiKey, { apiVersion: '2023-10-16' });
  
  // Create a product
  const product = await stripe.products.create({
    name: params.description,
  });
  
  // Create a price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: params.amount,
    currency: 'usd',
  });
  
  // Create payment link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{
      price: price.id,
      quantity: 1,
    }],
  });
  
  return {
    url: paymentLink.url,
  };
}

