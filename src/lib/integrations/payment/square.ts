/**
 * Square Function Executor
 * Allows AI agent to call Square functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { apiKeyService } from '@/lib/api-keys/api-key-service';

/**
 * Square configuration from API keys
 */
interface SquareConfig {
  accessToken?: string;
  environment?: string;
}

/**
 * Square API error response
 */
interface SquareErrorResponse {
  errors?: Array<{
    detail?: string;
  }>;
}

/**
 * Square payment response
 */
interface SquarePaymentResponse {
  payment: {
    id: string;
    status: string;
    receipt_url?: string;
  };
}

/**
 * Square customer response
 */
interface SquareCustomerResponse {
  customer: unknown;
}

/**
 * Square function parameters
 */
interface SquareFunctionParams {
  amount?: number;
  currency?: string;
  sourceId?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  phoneNumber?: string;
}

/**
 * Execute a Square function
 */
export async function executeSquareFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  _integration: ConnectedIntegration
): Promise<unknown> {
  // Get Square API keys from organization settings
  const keys = await apiKeyService.getKeys();
  const squareConfig = (keys?.payments?.square ?? {}) as SquareConfig;
  const squareAccessToken = squareConfig.accessToken;

  if (!squareAccessToken) {
    throw new Error('Square not configured. Please add your Square access token in Settings > API Keys');
  }

  // Check if production mode based on access token prefix or explicit mode setting
  const hasProductionToken = typeof squareAccessToken === 'string' && squareAccessToken.startsWith('sq0atp-');
  const hasProductionEnv = squareConfig.environment === 'production';
  const isProduction = hasProductionToken ? true : (hasProductionEnv ? true : false);
  const baseUrl = isProduction
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  // Type guard for parameters
  const params = parameters as SquareFunctionParams;

  switch (functionName) {
    case 'processPayment': {
      // Validate required parameters
      if (typeof params.amount !== 'number') {
        throw new Error('amount (number) is required for processPayment');
      }
      if (!params.sourceId || typeof params.sourceId !== 'string') {
        throw new Error('sourceId (string) is required for processPayment');
      }

      // Create payment
      const response = await fetch(`${baseUrl}/v2/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18',
        },
        body: JSON.stringify({
          source_id: params.sourceId,
          idempotency_key: `${Date.now()}-${Math.random()}`,
          amount_money: {
            amount: params.amount,
            currency: (params.currency !== '' && params.currency != null) ? params.currency : 'USD',
          },
          autocomplete: true,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as SquareErrorResponse;
        const errorDetail = error.errors?.[0]?.detail;
        const errorMsg = (errorDetail !== '' && errorDetail != null) ? errorDetail : response.statusText;
        throw new Error(`Square API error: ${errorMsg}`);
      }

      const data = (await response.json()) as SquarePaymentResponse;
      return {
        paymentId: data.payment.id,
        status: data.payment.status,
        receiptUrl: data.payment.receipt_url,
      };
    }

    case 'createCustomer': {
      // Validate required parameters
      if (!params.email || typeof params.email !== 'string') {
        throw new Error('email (string) is required for createCustomer');
      }

      const customerResponse = await fetch(`${baseUrl}/v2/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18',
        },
        body: JSON.stringify({
          idempotency_key: `${Date.now()}-${Math.random()}`,
          email_address: params.email,
          given_name: params.givenName,
          family_name: params.familyName,
          phone_number: params.phoneNumber,
        }),
      });

      if (!customerResponse.ok) {
        const error = (await customerResponse.json()) as SquareErrorResponse;
        const customerErrorDetail = error.errors?.[0]?.detail;
        const customerErrorMsg = (customerErrorDetail !== '' && customerErrorDetail != null) ? customerErrorDetail : customerResponse.statusText;
        throw new Error(`Square API error: ${customerErrorMsg}`);
      }

      const customerData = (await customerResponse.json()) as SquareCustomerResponse;
      return customerData.customer;
    }

    default:
      throw new Error(`Unknown Square function: ${functionName}`);
  }
}
