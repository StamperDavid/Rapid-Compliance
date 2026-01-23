/**
 * Salesforce Integration
 * CRM functions for Salesforce
 */

import type { ConnectedIntegration } from '@/types/integrations';

interface SalesforceLeadParams {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone?: string;
  notes?: string;
}

interface SalesforceApiResponse {
  id: string;
  success: boolean;
  errors?: unknown[];
}

interface SalesforceLeadResult {
  leadId: string;
  created: boolean;
}

type SalesforceFunctionResult = SalesforceLeadResult;

/**
 * Execute a Salesforce function
 */
export async function executeSalesforceFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  integration: ConnectedIntegration
): Promise<SalesforceFunctionResult> {
  if (!integration.config) {
    throw new Error('Salesforce configuration missing');
  }
  
  const instanceUrl = integration.config.instanceUrl as string;
  const accessToken = integration.config.accessToken as string;
  
  if (!instanceUrl || !accessToken) {
    throw new Error('Salesforce credentials not configured');
  }
  
  switch (functionName) {
    case 'createSalesforceLead': {
      // Validate required parameters
      const requiredFields: Array<keyof SalesforceLeadParams> = ['firstName', 'lastName', 'email', 'company'];
      const missingFields = requiredFields.filter(field => !parameters[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields for Salesforce lead: ${missingFields.join(', ')}`);
      }
      
      // Validate types
      if (typeof parameters.firstName !== 'string' || typeof parameters.lastName !== 'string' || 
          typeof parameters.email !== 'string' || typeof parameters.company !== 'string') {
        throw new Error('firstName, lastName, email, and company must be strings');
      }
      
      // Optional fields validation
      if (parameters.phone && typeof parameters.phone !== 'string') {
        throw new Error('phone must be a string');
      }
      if (parameters.notes && typeof parameters.notes !== 'string') {
        throw new Error('notes must be a string');
      }
      
      return createLead(
        {
          firstName: parameters.firstName,
          lastName: parameters.lastName,
          email: parameters.email,
          company: parameters.company,
          phone: parameters.phone as string | undefined,
          notes: parameters.notes as string | undefined,
        },
        instanceUrl,
        accessToken
      );
    }
      
    default:
      throw new Error(`Unknown Salesforce function: ${functionName}`);
  }
}

/**
 * Create a lead in Salesforce
 */
async function createLead(
  params: SalesforceLeadParams,
  instanceUrl: string,
  accessToken: string
): Promise<SalesforceLeadResult> {
  const response = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Lead`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      FirstName: params.firstName,
      LastName: params.lastName,
      Email: params.email,
      Company: params.company,
      Phone: params.phone,
      Description: params.notes,
      LeadSource: 'AI Agent',
    }),
  });
  
  if (!response.ok) {
    const error: unknown = await response.json();
    throw new Error(`Failed to create lead: ${JSON.stringify(error)}`);
  }

  const data = await response.json() as SalesforceApiResponse;

  return {
    leadId: data.id,
    created: data.success,
  };
}

