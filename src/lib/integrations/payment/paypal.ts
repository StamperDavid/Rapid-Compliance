/**
 * PayPal Function Executor
 * Allows AI agent to call PayPal functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { createOrder, getOrderDetails, captureOrder } from '../paypal-service';

/**
 * Execute a PayPal function
 */
export async function executePayPalFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const organizationId = integration.organizationId || '';
  
  if (!organizationId) {
    throw new Error('Organization ID not configured');
  }
  
  switch (functionName) {
    case 'createPayment':
      // Validate required parameters
      if (typeof parameters.amount !== 'number') {
        throw new Error('amount (number) is required for createPayment');
      }
      
      const order = await createOrder(
        organizationId,
        parameters.amount,
        parameters.currency || 'USD'
      );
      
      return {
        orderId: order.id,
        approvalUrl: order.links?.find((l: any) => l.rel === 'approve')?.href,
        status: order.status,
      };
      
    case 'getTransaction':
      // Validate required parameters
      if (!parameters.orderId || typeof parameters.orderId !== 'string') {
        throw new Error('orderId (string) is required for getTransaction');
      }
      
      return getOrderDetails(organizationId, parameters.orderId);
      
    case 'capturePayment':
      // Validate required parameters
      if (!parameters.orderId || typeof parameters.orderId !== 'string') {
        throw new Error('orderId (string) is required for capturePayment');
      }
      
      return captureOrder(organizationId, parameters.orderId);
      
    default:
      throw new Error(`Unknown PayPal function: ${functionName}`);
  }
}
