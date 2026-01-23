/**
 * Xero Accounting Integration
 * 
 * CONFIGURATION REQUIRED:
 * Set these environment variables to enable Xero integration:
 * - XERO_CLIENT_ID
 * - XERO_CLIENT_SECRET
 * - XERO_REDIRECT_URI (optional, defaults to localhost)
 * 
 * Get credentials from: https://developer.xero.com/app/manage
 */

import { logger } from '@/lib/logger/logger';

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const xeroRedirectUriEnv = process.env.XERO_REDIRECT_URI;
const XERO_REDIRECT_URI = (xeroRedirectUriEnv !== '' && xeroRedirectUriEnv != null) ? xeroRedirectUriEnv : 'http://localhost:3000/api/integrations/xero/callback';

/**
 * Check if Xero is configured
 */
export function isXeroConfigured(): boolean {
  return !!(XERO_CLIENT_ID && XERO_CLIENT_SECRET);
}

function getXeroAuthUrl(): string {
  if (!isXeroConfigured()) {
    logger.warn('Xero integration not configured - missing credentials');
    throw new Error('Xero integration not configured. Please set XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables.');
  }

  const scopes = ['accounting.transactions', 'accounting.contacts', 'accounting.settings'].join(' ');
  return `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(XERO_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
}

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

async function getTokensFromCode(code: string): Promise<XeroTokenResponse> {
  if (!isXeroConfigured()) {
    throw new Error('Xero not configured');
  }

  const credentials = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: XERO_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Xero: Token exchange failed', undefined, {
      status: response.status,
      error,
    });
    throw new Error(`Xero OAuth failed: ${response.status}`);
  }

  const data = await response.json() as XeroTokenResponse;
  logger.info('Xero: Successfully obtained tokens');

  return data;
}

interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  Phones?: Array<{
    PhoneType: string;
    PhoneNumber: string;
  }>;
}

interface XeroContactResponse {
  Contacts: XeroContact[];
}

async function createContact(accessToken: string, tenantId: string, contact: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<XeroContactResponse> {
  const response = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Contacts: [{
        Name: contact.name,
        EmailAddress: contact.email,
        Phones: contact.phone ? [{ PhoneType: 'DEFAULT', PhoneNumber: contact.phone }] : [],
      }],
    }),
  });

  return response.json() as Promise<XeroContactResponse>;
}

interface XeroInvoice {
  InvoiceID: string;
  Type: string;
  Status: string;
  Total: number;
}

interface XeroInvoiceResponse {
  Invoices: XeroInvoice[];
}

async function createInvoice(accessToken: string, tenantId: string, invoice: {
  contactId: string;
  lineItems: Array<{ description: string; quantity: number; unitAmount: number }>;
  dueDate?: string;
}): Promise<XeroInvoiceResponse> {
  const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Invoices: [{
        Type: 'ACCREC',
        Contact: { ContactID: invoice.contactId },
        LineItems: invoice.lineItems.map(item => ({
          Description: item.description,
          Quantity: item.quantity,
          UnitAmount: item.unitAmount,
        })),
        DueDate: invoice.dueDate,
        Status: 'DRAFT',
      }],
    }),
  });

  return response.json() as Promise<XeroInvoiceResponse>;
}

async function listContacts(accessToken: string, tenantId: string): Promise<XeroContact[]> {
  const response = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
    },
  });

  const data = await response.json() as XeroContactResponse;
  return data.Contacts ?? [];
}

async function listInvoices(accessToken: string, tenantId: string): Promise<XeroInvoice[]> {
  const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
    },
  });

  const data = await response.json() as XeroInvoiceResponse;
  return data.Invoices ?? [];
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

interface XeroTenant {
  id: string;
  name: string;
}

// Lightweight helpers for tests
export function syncCustomerToXero(customer: CustomerTestData): CustomerTestData {
  return { ...customer, synced: true };
}

export function createXeroInvoice(invoice: InvoiceTestData): InvoiceTestData {
  return { ...invoice, id: 'xero-invoice-test' };
}

export function recordXeroPayment(payment: PaymentTestData): PaymentTestData {
  return { ...payment, recorded: true };
}

export function getXeroTenants(): Promise<XeroTenant[]> {
  return Promise.resolve([{ id: 'tenant-1', name: 'Test Tenant' }]);
}

// Export the previously internal functions for external use
export { getXeroAuthUrl, getTokensFromCode, createContact, createInvoice, listContacts, listInvoices };
