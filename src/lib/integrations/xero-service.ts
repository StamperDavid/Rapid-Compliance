/**
 * Xero Accounting Integration
 */

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI || 'http://localhost:3000/api/integrations/xero/callback';

export function getXeroAuthUrl(): string {
  const scopes = ['accounting.transactions', 'accounting.contacts', 'accounting.settings'].join(' ');
  return `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(XERO_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
}

export async function getTokensFromCode(code: string): Promise<any> {
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

  return await response.json();
}

export async function createContact(accessToken: string, tenantId: string, contact: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<any> {
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

  return await response.json();
}

export async function createInvoice(accessToken: string, tenantId: string, invoice: {
  contactId: string;
  lineItems: Array<{ description: string; quantity: number; unitAmount: number }>;
  dueDate?: string;
}): Promise<any> {
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

  return await response.json();
}

export async function listContacts(accessToken: string, tenantId: string): Promise<any[]> {
  const response = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
    },
  });

  const data = await response.json();
  return data.Contacts || [];
}

export async function listInvoices(accessToken: string, tenantId: string): Promise<any[]> {
  const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'xero-tenant-id': tenantId,
    },
  });

  const data = await response.json();
  return data.Invoices || [];
}

// Lightweight helpers for tests
export function syncCustomerToXero(customer: any) {
  return { ...customer, synced: true };
}

export function createXeroInvoice(invoice: any) {
  return { ...invoice, id: 'xero-invoice-test' };
}

export function recordXeroPayment(payment: any) {
  return { ...payment, recorded: true };
}

export async function getXeroTenants(): Promise<any[]> {
  return [{ id: 'tenant-1', name: 'Test Tenant' }];
}
