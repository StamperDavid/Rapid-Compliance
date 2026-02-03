/**
 * PayPal Function Executor
 * Allows AI agent to call PayPal functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { createOrder, getOrderDetails, captureOrder } from '../paypal-service';

/**
 * PayPal link object
 */
interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

/**
 * PayPal order response
 */
interface PayPalOrder {
  id: string;
  status: string;
  links?: PayPalLink[];
}

/**
 * PayPal function parameters
 */
interface PayPalFunctionParams {
  amount?: number;
  currency?: string;
  orderId?: string;
}

/**
 * Execute a PayPal function
 */
export async function executePayPalFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  _integration: ConnectedIntegration
): Promise<unknown> {
  // Import DEFAULT_ORG_ID for single-tenant
  const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
  const organizationId = DEFAULT_ORG_ID;

  // Type guard for parameters
  const params = parameters as PayPalFunctionParams;

  switch (functionName) {
    case 'createPayment': {
      // Validate required parameters
      if (typeof params.amount !== 'number') {
        throw new Error('amount (number) is required for createPayment');
      }

      const order = (await createOrder(
        organizationId,
        params.amount,
        (params.currency !== '' && params.currency != null) ? params.currency : 'USD'
      )) as PayPalOrder;

      const approvalLink = order.links?.find((l) => l.rel === 'approve');

      return {
        orderId: order.id,
        approvalUrl: approvalLink?.href,
        status: order.status,
      };
    }

    case 'getTransaction': {
      // Validate required parameters
      if (!params.orderId || typeof params.orderId !== 'string') {
        throw new Error('orderId (string) is required for getTransaction');
      }

      return getOrderDetails(organizationId, params.orderId);
    }

    case 'capturePayment': {
      // Validate required parameters
      if (!params.orderId || typeof params.orderId !== 'string') {
        throw new Error('orderId (string) is required for capturePayment');
      }

      return captureOrder(organizationId, params.orderId);
    }

    default:
      throw new Error(`Unknown PayPal function: ${functionName}`);
  }
}
