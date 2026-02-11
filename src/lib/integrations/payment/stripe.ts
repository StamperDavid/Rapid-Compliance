/**
 * Stripe Integration
 * Payment processing functions
 */

import type { ConnectedIntegration } from '@/types/integrations';

/**
 * Stripe function parameters
 */
interface StripeFunctionParams {
  amount?: number;
  description?: string;
  currency?: string;
  customerEmail?: string;
}

/**
 * Execute a Stripe function
 */
export async function executeStripeFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  integration: ConnectedIntegration
): Promise<unknown> {
  const apiKey = integration.config.apiKey as string | undefined;

  if (!apiKey) {
    throw new Error('Stripe API key not configured');
  }

  // Type guard for parameters
  const params = parameters as StripeFunctionParams;

  switch (functionName) {
    case 'createStripeCheckout':
      // Validate required parameters
      if (typeof params.amount !== 'number' || !Number.isInteger(params.amount) || params.amount <= 0) {
        throw new Error('amount must be a positive integer in cents');
      }
      if (!params.description || typeof params.description !== 'string') {
        throw new Error('description (string) is required for createStripeCheckout');
      }
      if (params.currency && typeof params.currency !== 'string') {
        throw new Error('currency must be a string');
      }
      if (params.customerEmail && typeof params.customerEmail !== 'string') {
        throw new Error('customerEmail must be a string');
      }

      return createCheckoutSession(
        {
          amount: params.amount,
          description: params.description,
          currency: params.currency,
          customerEmail: params.customerEmail,
        },
        apiKey
      );

    case 'createStripePaymentLink':
      // Validate required parameters
      if (typeof params.amount !== 'number') {
        throw new Error('amount (number) is required for createStripePaymentLink');
      }
      if (!params.description || typeof params.description !== 'string') {
        throw new Error('description (string) is required for createStripePaymentLink');
      }

      return createPaymentLink(
        {
          amount: params.amount,
          description: params.description,
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
          currency: (params.currency !== '' && params.currency != null) ? params.currency : 'usd',
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

  if (!session.url) {
    throw new Error('Stripe checkout session URL is missing');
  }

  return {
    url: session.url,
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
