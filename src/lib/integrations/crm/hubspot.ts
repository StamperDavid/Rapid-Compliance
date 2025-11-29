/**
 * HubSpot Integration
 * CRM functions for HubSpot
 */

import type { ConnectedIntegration } from '@/types/integrations';

/**
 * Execute a HubSpot function
 */
export async function executeHubSpotFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const accessToken = integration.accessToken;
  
  if (!accessToken) {
    throw new Error('HubSpot access token not configured');
  }
  
  switch (functionName) {
    case 'createHubSpotContact':
      return await createContact(parameters, accessToken);
      
    default:
      throw new Error(`Unknown HubSpot function: ${functionName}`);
  }
}

/**
 * Create a contact in HubSpot
 */
async function createContact(
  params: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
  },
  accessToken: string
): Promise<{ contactId: string; created: boolean }> {
  const properties: any = {
    email: params.email,
  };
  
  if (params.firstName) properties.firstname = params.firstName;
  if (params.lastName) properties.lastname = params.lastName;
  if (params.phone) properties.phone = params.phone;
  if (params.company) properties.company = params.company;
  
  const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create contact: ${JSON.stringify(error)}`);
  }
  
  const data = await response.json();
  
  return {
    contactId: data.id,
    created: true,
  };
}

