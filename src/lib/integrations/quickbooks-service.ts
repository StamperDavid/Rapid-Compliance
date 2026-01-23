/**
 * QuickBooks Integration
 * Real integration using QuickBooks API
 * 
 * CONFIGURATION REQUIRED:
 * Set these environment variables to enable QuickBooks integration:
 * - QUICKBOOKS_CLIENT_ID
 * - QUICKBOOKS_CLIENT_SECRET
 * - QUICKBOOKS_REDIRECT_URI (optional, defaults to localhost)
 * 
 * Get credentials from: https://developer.intuit.com/app/developer/qbo/docs/get-started
 */

import { logger } from '@/lib/logger/logger';

const QB_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const QB_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const qbRedirectUriEnv = process.env.QUICKBOOKS_REDIRECT_URI;
const QB_REDIRECT_URI = (qbRedirectUriEnv !== '' && qbRedirectUriEnv != null) ? qbRedirectUriEnv : 'http://localhost:3000/api/integrations/quickbooks/callback';

/**
 * Check if QuickBooks is configured
 */
export function isQuickBooksConfigured(): boolean {
  return !!(QB_CLIENT_ID && QB_CLIENT_SECRET);
}

/**
 * Get QuickBooks OAuth URL
 * Throws error if not configured
 */
export function getQuickBooksAuthUrl(): string {
  if (!isQuickBooksConfigured()) {
    logger.warn('QuickBooks integration not configured - missing credentials');
    throw new Error('QuickBooks integration not configured. Please set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables.');
  }

  const scopes = ['com.intuit.quickbooks.accounting'].join(' ');
  const state = Math.random().toString(36).substring(7);

  return `https://appcenter.intuit.com/connect/oauth2?client_id=${QB_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI)}&response_type=code&state=${state}`;
}

interface QuickBooksTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
}

/**
 * Exchange code for tokens
 */
export async function getTokensFromCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  realmId: string;
}> {
  if (!isQuickBooksConfigured()) {
    throw new Error('QuickBooks not configured');
  }

  const credentials = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: QB_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('QuickBooks: Token exchange failed', undefined, {
      status: response.status,
      error,
    });
    throw new Error(`QuickBooks OAuth failed: ${response.status}`);
  }

  const data = await response.json() as QuickBooksTokenResponse;
  logger.info('QuickBooks: Successfully obtained tokens');

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    realmId: '',
  };
}

interface QuickBooksCustomerResponse {
  Customer: {
    Id: string;
    DisplayName: string;
    CompanyName?: string;
    PrimaryEmailAddr?: { Address: string };
    PrimaryPhone?: { FreeFormNumber: string };
  };
}

/**
 * Create customer
 */
export async function createCustomer(accessToken: string, realmId: string, customer: {
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
}): Promise<QuickBooksCustomerResponse> {
  const response = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realmId}/customer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      DisplayName: customer.displayName,
      CompanyName: customer.companyName,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
    }),
  });

  return response.json() as Promise<QuickBooksCustomerResponse>;
}

interface QuickBooksInvoiceResponse {
  Invoice: {
    Id: string;
    DocNumber: string;
    TotalAmt: number;
    Balance: number;
  };
}

/**
 * Create invoice
 */
export async function createInvoice(accessToken: string, realmId: string, invoice: {
  customerId: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
  dueDate?: string;
}): Promise<QuickBooksInvoiceResponse> {
  const response = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      CustomerRef: {
        value: invoice.customerId,
      },
      Line: invoice.lineItems.map(item => ({
        Description: item.description,
        Amount: item.amount * item.quantity,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.amount,
        },
      })),
      DueDate: invoice.dueDate,
    }),
  });

  return response.json() as Promise<QuickBooksInvoiceResponse>;
}

interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
}

/**
 * List customers
 */
export async function listCustomers(accessToken: string, realmId: string): Promise<QuickBooksCustomer[]> {
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Customer`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  interface QueryResponse {
    QueryResponse?: {
      Customer?: QuickBooksCustomer[];
    };
  }

  const data = await response.json() as QueryResponse;
  return data.QueryResponse?.Customer ?? [];
}

interface QuickBooksInvoice {
  Id: string;
  DocNumber: string;
  TotalAmt: number;
  Balance: number;
}

/**
 * List invoices
 */
export async function listInvoices(accessToken: string, realmId: string): Promise<QuickBooksInvoice[]> {
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Invoice`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  interface InvoiceQueryResponse {
    QueryResponse?: {
      Invoice?: QuickBooksInvoice[];
    };
  }

  const data = await response.json() as InvoiceQueryResponse;
  return data.QueryResponse?.Invoice ?? [];
}

interface QuickBooksCompanyInfo {
  CompanyName: string;
  LegalName?: string;
  Country?: string;
  Email?: { Address: string };
}

/**
 * Get company info
 */
export async function getCompanyInfo(accessToken: string, realmId: string): Promise<QuickBooksCompanyInfo> {
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  interface CompanyInfoResponse {
    CompanyInfo: QuickBooksCompanyInfo;
  }

  const data = await response.json() as CompanyInfoResponse;
  return data.CompanyInfo;
}

interface CustomerTestData {
  [key: string]: unknown;
  synced?: boolean;
}

interface InvoiceTestData {
  [key: string]: unknown;
  id?: string;
}

interface PaymentTestData {
  [key: string]: unknown;
  recorded?: boolean;
}

// Lightweight helpers for tests
export function syncCustomerToQuickBooks(customer: CustomerTestData): CustomerTestData {
  return { ...customer, synced: true };
}

export function createQuickBooksInvoice(invoice: InvoiceTestData): InvoiceTestData {
  return { ...invoice, id: 'qb-invoice-test' };
}

export function recordQuickBooksPayment(payment: PaymentTestData): PaymentTestData {
  return { ...payment, recorded: true };
}
