/**
 * QuickBooks Integration
 * - Create invoices
 * - Track payments
 * - Sync customers
 * - Revenue reporting
 */

import { logger } from '@/lib/logger/logger';

// ============================================================================
// Request Interfaces
// ============================================================================

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

// ============================================================================
// QuickBooks API Response Interfaces
// ============================================================================

interface QuickBooksError {
  Message: string;
  Detail: string;
  code: string;
}

interface QuickBooksErrorResponse {
  Fault: {
    Error: QuickBooksError[];
    type: string;
  };
  time: string;
}

interface QuickBooksCustomerData {
  Id: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  Active: boolean;
  SyncToken: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface QuickBooksCustomerResponse {
  Customer: QuickBooksCustomerData;
  time: string;
}

interface QuickBooksInvoiceLineItem {
  Id: string;
  LineNum: number;
  Description: string;
  Amount: number;
  DetailType: string;
  SalesItemLineDetail?: {
    Qty: number;
    UnitPrice?: number;
    ItemRef?: { value: string; name: string };
  };
}

interface QuickBooksInvoiceData {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef: { value: string; name: string };
  Line: QuickBooksInvoiceLineItem[];
  SyncToken: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface QuickBooksInvoiceResponse {
  Invoice: QuickBooksInvoiceData;
  time: string;
}

interface QuickBooksTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

interface QuickBooksTokenErrorResponse {
  error: string;
  error_description: string;
}

interface IntegrationCredentials {
  accessToken: string;
  metadata?: {
    realmId?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if response is an error
 */
function isQuickBooksError(data: unknown): data is QuickBooksErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'Fault' in data &&
    typeof (data as Record<string, unknown>).Fault === 'object'
  );
}

/**
 * Type guard to check if token response is an error
 */
function isTokenError(data: unknown): data is QuickBooksTokenErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as Record<string, unknown>).error === 'string'
  );
}

/**
 * Extract error message from QuickBooks error response
 */
function extractQuickBooksError(errorData: QuickBooksErrorResponse): string {
  const errors = errorData.Fault?.Error ?? [];
  const messages = errors
    .map(err => `${err.Message}${err.Detail ? `: ${err.Detail}` : ''}`)
    .join('; ');
  return messages || 'Unknown QuickBooks API error';
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Create or update customer in QuickBooks
 */
export async function syncCustomerToQuickBooks(
  customer: QuickBooksCustomer
): Promise<string> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials('quickbooks') as IntegrationCredentials | null;

    if (!credentials?.accessToken) {
      throw new Error('QuickBooks not connected');
    }

    const realmId = credentials.metadata?.realmId;
    if (!realmId || typeof realmId !== 'string') {
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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isQuickBooksError(data)) {
        const errorMessage = extractQuickBooksError(data);
        throw new Error(`QuickBooks API error: ${errorMessage}`);
      }
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    // Validate response structure
    if (!data || typeof data !== 'object' || !('Customer' in data)) {
      throw new Error('Invalid response structure from QuickBooks API');
    }

    const customerResponse = data as QuickBooksCustomerResponse;
    const customerId = customerResponse.Customer.Id;

    logger.info('QuickBooks customer synced', { customerId });

    return customerId;

  } catch (error) {
    logger.error('Failed to sync customer to QuickBooks', error as Error);
    throw error;
  }
}

/**
 * Create invoice in QuickBooks
 */
export async function createQuickBooksInvoice(
  invoice: QuickBooksInvoice
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials('quickbooks') as IntegrationCredentials | null;

    if (!credentials?.accessToken) {
      throw new Error('QuickBooks not connected');
    }

    const realmId = credentials.metadata?.realmId;
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('QuickBooks realm ID not found');
    }

    // Build line items with proper structure
    const lines = invoice.lineItems.map((item) => ({
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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isQuickBooksError(data)) {
        const errorMessage = extractQuickBooksError(data);
        throw new Error(`QuickBooks API error: ${errorMessage}`);
      }
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    // Validate response structure
    if (!data || typeof data !== 'object' || !('Invoice' in data)) {
      throw new Error('Invalid response structure from QuickBooks API');
    }

    const invoiceResponse = data as QuickBooksInvoiceResponse;

    logger.info('QuickBooks invoice created', {
      invoiceId: invoiceResponse.Invoice.Id,
    });

    return {
      invoiceId: invoiceResponse.Invoice.Id,
      invoiceNumber: invoiceResponse.Invoice.DocNumber,
    };

  } catch (error) {
    logger.error('Failed to create QuickBooks invoice', error as Error);
    throw error;
  }
}

/**
 * Get QuickBooks OAuth URL
 */
export function getQuickBooksAuthUrl(redirectUri: string): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  if (!clientId) {
    throw new Error('QUICKBOOKS_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: 'rapid-compliance-root',
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
    const clientId = process.env.QUICKBOOKS_CLIENT_ID ?? '';
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET ?? '';

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

    const data: unknown = await response.json();

    if (!response.ok) {
      if (isTokenError(data)) {
        throw new Error(`QuickBooks OAuth error: ${data.error} - ${data.error_description}`);
      }
      throw new Error(`Failed to exchange QuickBooks code: ${response.status} ${response.statusText}`);
    }

    // Validate response structure
    if (!data || typeof data !== 'object' || !('access_token' in data)) {
      throw new Error('Invalid token response structure from QuickBooks OAuth');
    }

    const tokenResponse = data as QuickBooksTokenResponse;

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
      realmId, // Store realm ID for future API calls
    };

  } catch (error) {
    logger.error('QuickBooks OAuth exchange failed', error as Error);
    throw error;
  }
}

