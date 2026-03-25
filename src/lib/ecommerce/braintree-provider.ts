/**
 * Braintree Payment Provider
 * PayPal-owned processor with global reach (2.9% + $0.30).
 * Uses Braintree GraphQL API (payments.braintree-api.com).
 *
 * Flow: Server generates client token → Client tokenizes via Drop-in UI →
 *       Server charges the nonce → Transaction complete.
 * Supports programmatic refunds via GraphQL mutation.
 *
 * No npm package required — all calls use fetch against the GraphQL endpoint.
 *
 * @module lib/ecommerce/braintree-provider
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { PaymentRequest, PaymentResult } from './payment-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface BraintreeKeys {
  merchantId?: string;
  publicKey?: string;
  privateKey?: string;
  /** "sandbox" or "production" */
  mode?: string;
}

// ─── GraphQL Response Shapes ─────────────────────────────────────────────────

interface BraintreeGraphQLResponse {
  data?: {
    chargePaymentMethod?: {
      transaction?: BraintreeTransaction;
    };
    createClientToken?: {
      clientToken?: string;
    };
    refundTransaction?: {
      refund?: {
        id?: string;
        status?: string;
        amount?: {
          value?: string;
        };
      };
    };
  };
  errors?: Array<{
    message?: string;
    extensions?: {
      errorClass?: string;
    };
  }>;
}

interface BraintreeTransaction {
  id?: string;
  status?: string;
  amount?: {
    value?: string;
    currencyIsoCode?: string;
  };
  paymentMethodSnapshot?: {
    __typename?: string;
    last4?: string;
    brandCode?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getBraintreeConfig(): Promise<{
  merchantId: string;
  authHeader: string;
  graphqlUrl: string;
} | null> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'braintree')) as BraintreeKeys | null;
  if (!keys?.merchantId || !keys?.publicKey || !keys?.privateKey) {
    return null;
  }

  const graphqlUrl = keys.mode === 'production'
    ? 'https://payments.braintree-api.com/graphql'
    : 'https://payments.sandbox.braintree-api.com/graphql';

  const authHeader = `Basic ${Buffer.from(`${keys.publicKey}:${keys.privateKey}`).toString('base64')}`;

  return { merchantId: keys.merchantId, authHeader, graphqlUrl };
}

/**
 * Execute a Braintree GraphQL query/mutation.
 */
async function braintreeGraphQL(
  config: { authHeader: string; graphqlUrl: string },
  query: string,
  variables: Record<string, unknown>,
): Promise<BraintreeGraphQLResponse> {
  const response = await fetch(config.graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.authHeader,
      'Braintree-Version': '2024-08-01',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    return {
      errors: [{ message: `Braintree API returned ${response.status}` }],
    };
  }

  return (await response.json()) as BraintreeGraphQLResponse;
}

/**
 * Calculate Braintree processing fee.
 * Standard rate: 2.9% + $0.30 per transaction.
 */
export function calculateBraintreeFee(amount: number): number {
  return amount * 0.029 + 0.30;
}

// ─── Client Token ────────────────────────────────────────────────────────────

/**
 * Generate a Braintree client token for the Drop-in UI.
 * The client uses this token to initialize the Braintree SDK and tokenize payment details.
 */
export async function createBraintreeClientToken(): Promise<{
  clientToken: string;
} | { error: string }> {
  const config = await getBraintreeConfig();
  if (!config) {
    return { error: 'Braintree not configured. Please add Braintree API keys in settings.' };
  }

  const query = `
    mutation CreateClientToken($input: CreateClientTokenInput) {
      createClientToken(input: $input) {
        clientToken
      }
    }
  `;

  const result = await braintreeGraphQL(config, query, { input: {} });

  if (result.errors?.length) {
    const errorMsg = result.errors[0]?.message ?? 'Failed to create Braintree client token';
    logger.error('Braintree client token creation failed', new Error(errorMsg), {
      file: 'braintree-provider.ts',
    });
    return { error: errorMsg };
  }

  const clientToken = result.data?.createClientToken?.clientToken;
  if (!clientToken) {
    return { error: 'Braintree returned empty client token' };
  }

  return { clientToken };
}

// ─── Process Payment ─────────────────────────────────────────────────────────

/**
 * Process a payment via Braintree (for the payment-service dispatcher).
 *
 * If `paymentToken` (nonce from Drop-in UI) is provided, charges it directly.
 * Otherwise returns an error — client must tokenize first via Drop-in UI.
 */
export async function processBraintreePayment(
  request: PaymentRequest,
  _providerConfig: unknown,
): Promise<PaymentResult> {
  try {
    const config = await getBraintreeConfig();
    if (!config) {
      return { success: false, error: 'Braintree not configured. Please add Braintree API keys in settings.' };
    }

    if (!request.paymentToken) {
      // No nonce — client needs to use the Drop-in UI to tokenize first
      // Generate a client token so the frontend can initialize the SDK
      const tokenResult = await createBraintreeClientToken();
      if ('error' in tokenResult) {
        return { success: false, error: tokenResult.error };
      }

      return {
        success: true,
        pending: true,
        transactionId: tokenResult.clientToken,
        provider: 'braintree',
        processingFee: calculateBraintreeFee(request.amount),
      };
    }

    // Charge the nonce directly
    const query = `
      mutation ChargePaymentMethod($input: ChargePaymentMethodInput!) {
        chargePaymentMethod(input: $input) {
          transaction {
            id
            status
            amount {
              value
              currencyIsoCode
            }
            paymentMethodSnapshot {
              __typename
              ... on CreditCardDetails {
                last4
                brandCode
              }
            }
          }
        }
      }
    `;

    const variables = {
      input: {
        paymentMethodId: request.paymentToken,
        transaction: {
          amount: request.amount.toFixed(2),
          orderId: typeof request.metadata?.orderId === 'string'
            ? request.metadata.orderId
            : undefined,
          customerDetails: {
            email: request.customer.email,
          },
        },
      },
    };

    const result = await braintreeGraphQL(config, query, variables);

    if (result.errors?.length) {
      const errorMsg = result.errors[0]?.message ?? 'Braintree charge failed';
      logger.error('Braintree charge failed', new Error(errorMsg), {
        file: 'braintree-provider.ts',
      });
      return { success: false, error: errorMsg };
    }

    const transaction = result.data?.chargePaymentMethod?.transaction;
    if (!transaction?.id) {
      return { success: false, error: 'Braintree returned no transaction' };
    }

    const isSettled = transaction.status === 'SETTLED'
      || transaction.status === 'SETTLING'
      || transaction.status === 'SUBMITTED_FOR_SETTLEMENT'
      || transaction.status === 'AUTHORIZED';

    if (isSettled) {
      const snapshot = transaction.paymentMethodSnapshot;
      return {
        success: true,
        transactionId: transaction.id,
        provider: 'braintree',
        cardLast4: snapshot?.last4,
        cardBrand: snapshot?.brandCode,
        processingFee: calculateBraintreeFee(request.amount),
      };
    }

    return {
      success: false,
      error: `Braintree transaction status: ${transaction.status}`,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Braintree payment error:', err, { file: 'braintree-provider.ts' });
    return {
      success: false,
      error: err.message || 'Braintree payment processing failed',
    };
  }
}

// ─── Refund Payment ──────────────────────────────────────────────────────────

/**
 * Refund a Braintree transaction (full or partial).
 * Uses the refundTransaction GraphQL mutation.
 */
export async function refundBraintreePayment(
  transactionId: string,
  amount?: number,
): Promise<PaymentResult> {
  try {
    const config = await getBraintreeConfig();
    if (!config) {
      return { success: false, error: 'Braintree not configured' };
    }

    const query = `
      mutation RefundTransaction($input: RefundTransactionInput!) {
        refundTransaction(input: $input) {
          refund {
            id
            status
            amount {
              value
            }
          }
        }
      }
    `;

    const input: Record<string, unknown> = {
      transactionId,
    };

    if (amount != null) {
      input.refund = {
        amount: amount.toFixed(2),
      };
    }

    const result = await braintreeGraphQL(config, query, { input });

    if (result.errors?.length) {
      const errorMsg = result.errors[0]?.message ?? 'Braintree refund failed';
      return { success: false, error: errorMsg };
    }

    const refund = result.data?.refundTransaction?.refund;
    if (!refund?.id) {
      return { success: false, error: 'Braintree returned no refund ID' };
    }

    return {
      success: true,
      transactionId: refund.id,
      provider: 'braintree',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Braintree refund error:', err, { file: 'braintree-provider.ts' });
    return { success: false, error: err.message || 'Braintree refund failed' };
  }
}
