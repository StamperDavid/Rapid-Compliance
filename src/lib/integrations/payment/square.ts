/**
 * Square Function Executor
 * Allows AI agent to call Square functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { apiKeyService } from '@/lib/api-keys/api-key-service';

/**
 * Execute a Square function
 */
export async function executeSquareFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const organizationId = (integration.organizationId !== '' && integration.organizationId != null) ? integration.organizationId : '';

  if (!organizationId) {
    throw new Error('Organization ID not configured');
  }
  
  // Get Square API keys from organization settings
  const keys = await apiKeyService.getKeys(organizationId);
  const squareConfig = keys?.payments?.square as any;
  const squareAccessToken = squareConfig?.accessToken;
  
  if (!squareAccessToken) {
    throw new Error('Square not configured. Please add your Square access token in Settings > API Keys');
  }
  
  // Check if production mode based on access token prefix or explicit mode setting
  const hasProductionToken = squareAccessToken.startsWith('sq0atp-');
  const hasProductionEnv = squareConfig?.environment === 'production';
  const isProduction = hasProductionToken ? true : (hasProductionEnv ? true : false);
  const baseUrl = isProduction
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
  
  switch (functionName) {
    case 'processPayment': {
      // Validate required parameters
      if (typeof parameters.amount !== 'number') {
        throw new Error('amount (number) is required for processPayment');
      }
      if (!parameters.sourceId || typeof parameters.sourceId !== 'string') {
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
          source_id: parameters.sourceId,
          idempotency_key: `${Date.now()}-${Math.random()}`,
          amount_money: {
            amount: parameters.amount,
            currency: (parameters.currency !== '' && parameters.currency != null) ? parameters.currency : 'USD',
          },
          autocomplete: true,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        const errorDetail = error.errors?.[0]?.detail;
        const errorMsg = (errorDetail !== '' && errorDetail != null) ? errorDetail : response.statusText;
        throw new Error(`Square API error: ${errorMsg}`);
      }
      
      const data = await response.json();
      return {
        paymentId: data.payment.id,
        status: data.payment.status,
        receiptUrl: data.payment.receipt_url,
      };
    }
      
    case 'createCustomer': {
      // Validate required parameters
      if (!parameters.email || typeof parameters.email !== 'string') {
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
          email_address: parameters.email,
          given_name: parameters.givenName,
          family_name: parameters.familyName,
          phone_number: parameters.phoneNumber,
        }),
      });
      
      if (!customerResponse.ok) {
        const error = await customerResponse.json();
        const customerErrorDetail = error.errors?.[0]?.detail;
        const customerErrorMsg = (customerErrorDetail !== '' && customerErrorDetail != null) ? customerErrorDetail : customerResponse.statusText;
        throw new Error(`Square API error: ${customerErrorMsg}`);
      }
      
      const customerData = await customerResponse.json();
      return customerData.customer;
    }
      
    default:
      throw new Error(`Unknown Square function: ${functionName}`);
  }
}
