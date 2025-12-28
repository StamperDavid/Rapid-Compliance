/**
 * QuickBooks Function Executor
 * Allows AI agent to call QuickBooks functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { createInvoice, createCustomer, listCustomers, listInvoices } from '../quickbooks-service';

/**
 * Execute a QuickBooks function
 */
export async function executeQuickBooksFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const accessToken = integration.accessToken || '';
  const realmId = integration.config?.realmId || integration.settings?.realmId || '';
  
  if (!accessToken) {
    throw new Error('QuickBooks access token not configured');
  }
  
  if (!realmId) {
    throw new Error('QuickBooks realm ID not configured');
  }
  
  switch (functionName) {
    case 'createInvoice':
      // Validate required parameters
      if (!parameters.customerId || typeof parameters.customerId !== 'string') {
        throw new Error('customerId (string) is required for createInvoice');
      }
      if (!Array.isArray(parameters.lineItems)) {
        throw new Error('lineItems (array) is required for createInvoice');
      }
      
      return await createInvoice(accessToken, realmId, {
        customerId: parameters.customerId,
        lineItems: parameters.lineItems,
        dueDate: parameters.dueDate,
      });
      
    case 'createCustomer':
      // Validate required parameters
      if (!parameters.displayName || typeof parameters.displayName !== 'string') {
        throw new Error('displayName (string) is required for createCustomer');
      }
      
      return await createCustomer(accessToken, realmId, {
        displayName: parameters.displayName,
        companyName: parameters.companyName,
        email: parameters.email,
        phone: parameters.phone,
      });
      
    case 'getCustomer':
      // List all customers (can be filtered client-side)
      return await listCustomers(accessToken, realmId);
      
    case 'listInvoices':
      // No parameters required
      return await listInvoices(accessToken, realmId);
      
    default:
      throw new Error(`Unknown QuickBooks function: ${functionName}`);
  }
}
