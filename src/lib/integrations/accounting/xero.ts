/**
 * Xero Function Executor
 * Allows AI agent to call Xero functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { createInvoice, createContact, listContacts, listInvoices } from '../xero-service';

/**
 * Execute a Xero function
 */
export async function executeXeroFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const accessToken = integration.accessToken || '';
  const tenantId = (integration.config?.tenantId ?? integration.settings?.tenantId ?? '') as string;
  
  if (!accessToken) {
    throw new Error('Xero access token not configured');
  }
  
  if (!tenantId) {
    throw new Error('Xero tenant ID not configured');
  }
  
  switch (functionName) {
    case 'createInvoice':
      // Validate required parameters
      if (!parameters.contactId || typeof parameters.contactId !== 'string') {
        throw new Error('contactId (string) is required for createInvoice');
      }
      if (!Array.isArray(parameters.lineItems)) {
        throw new Error('lineItems (array) is required for createInvoice');
      }
      
      return createInvoice(accessToken, tenantId, {
        contactId: parameters.contactId,
        lineItems: parameters.lineItems,
        dueDate: parameters.dueDate,
      });
      
    case 'createCustomer':
      // Validate required parameters
      if (!parameters.name || typeof parameters.name !== 'string') {
        throw new Error('name (string) is required for createCustomer');
      }
      
      return createContact(accessToken, tenantId, {
        name: parameters.name,
        email: parameters.email,
        phone: parameters.phone,
      });
      
    case 'getCustomer':
      // List all contacts (can be filtered client-side)
      return listContacts(accessToken, tenantId);
      
    case 'listInvoices':
      // No parameters required
      return listInvoices(accessToken, tenantId);
      
    default:
      throw new Error(`Unknown Xero function: ${functionName}`);
  }
}
