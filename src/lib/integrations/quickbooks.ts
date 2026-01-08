/**
 * QuickBooks Integration
 * - Create invoices
 * - Track payments
 * - Sync customers
 * - Revenue reporting
 */

import { logger } from '@/lib/logger/logger';

interface QuickBooksCustomer {
  id?: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  companyName?: string;
  primaryEmailAddr?: { address: string };
  primaryPhone?: { freeFormNumber: string };
}

interface QuickBooksInvoice {
  id?: string;
  customerId: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity?: number;
  }>;
  dueDate?: Date;
  invoiceNumber?: string;
}

/**
 * Create or update customer in QuickBooks
 */
export async function syncCustomerToQuickBooks(
  organizationId: string,
  customer: QuickBooksCustomer
): Promise<string> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials(organizationId, 'quickbooks');
    
    if (!credentials?.accessToken) {
      throw new Error('QuickBooks not connected');
    }

    const realmId = credentials.metadata?.realmId;
    if (!realmId) {
      throw new Error('QuickBooks realm ID not found');
    }

    // Create customer in QuickBooks
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/customer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          DisplayName: customer.displayName,
          GivenName: customer.givenName,
          FamilyName: customer.familyName,
          CompanyName: customer.companyName,
          PrimaryEmailAddr: customer.primaryEmailAddr,
          PrimaryPhone: customer.primaryPhone,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`QuickBooks API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const customerId = data.Customer.Id;

    logger.info('QuickBooks customer synced', { organizationId, customerId });

    return customerId;

  } catch (error: any) {
    logger.error('Failed to sync customer to QuickBooks', error, { organizationId });
    throw error;
  }
}

/**
 * Create invoice in QuickBooks
 */
export async function createQuickBooksInvoice(
  organizationId: string,
  invoice: QuickBooksInvoice
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials(organizationId, 'quickbooks');
    
    if (!credentials?.accessToken) {
      throw new Error('QuickBooks not connected');
    }

    const realmId = credentials.metadata?.realmId;
    if (!realmId) {
      throw new Error('QuickBooks realm ID not found');
    }

    // Build line items
    const lines = invoice.lineItems.map((item, index) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: item.amount,
      SalesItemLineDetail: {
        Qty: item.quantity ?? 1,
      },
      Description: item.description,
    }));

    // Create invoice
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          CustomerRef: { value: invoice.customerId },
          Line: lines,
          DueDate: invoice.dueDate?.toISOString().split('T')[0],
          DocNumber: invoice.invoiceNumber,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`QuickBooks API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    logger.info('QuickBooks invoice created', {
      organizationId,
      invoiceId: data.Invoice.Id,
    });

    return {
      invoiceId: data.Invoice.Id,
      invoiceNumber: data.Invoice.DocNumber,
    };

  } catch (error: any) {
    logger.error('Failed to create QuickBooks invoice', error, { organizationId });
    throw error;
  }
}

/**
 * Get QuickBooks OAuth URL
 */
export function getQuickBooksAuthUrl(organizationId: string, redirectUri: string): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  if (!clientId) {
    throw new Error('QUICKBOOKS_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: organizationId,
  });

  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeQuickBooksCode(
  code: string,
  redirectUri: string,
  realmId: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; realmId: string }> {
  try {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('QuickBooks credentials not configured');
    }

    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange QuickBooks code');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      realmId, // Store realm ID for future API calls
    };

  } catch (error: any) {
    logger.error('QuickBooks OAuth exchange failed', error);
    throw error;
  }
}

