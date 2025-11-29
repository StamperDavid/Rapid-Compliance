/**
 * Xero Integration Service
 * Sync customers, invoices, payments with Xero
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';

export interface XeroConfig {
  tenantId: string; // Xero organization/tenant ID
  accessToken: string;
  refreshToken: string;
}

/**
 * Sync customer to Xero
 */
export async function syncCustomerToXero(
  organizationId: string,
  customerId: string,
  customerData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    address?: any;
  }
): Promise<{ success: boolean; xeroId?: string; error?: string }> {
  try {
    const config = await getXeroConfig(organizationId);
    
    // Create contact in Xero
    const contact = {
      Name: customerData.company || `${customerData.firstName} ${customerData.lastName}`,
      FirstName: customerData.firstName,
      LastName: customerData.lastName,
      EmailAddress: customerData.email,
      Phones: customerData.phone ? [{
        PhoneType: 'DEFAULT',
        PhoneNumber: customerData.phone,
      }] : undefined,
      Addresses: customerData.address ? [{
        AddressType: 'STREET',
        AddressLine1: customerData.address.street,
        City: customerData.address.city,
        Region: customerData.address.state,
        PostalCode: customerData.address.zip,
        Country: customerData.address.country || 'USA',
      }] : undefined,
    };
    
    const response = await fetch(
      'https://api.xero.com/api.xro/2.0/Contacts',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'xero-tenant-id': config.tenantId,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Contacts: [contact] }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.Message || 'Failed to sync customer to Xero',
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      xeroId: result.Contacts[0].ContactID,
    };
  } catch (error: any) {
    console.error('Xero sync error:', error);
    return {
      success: false,
      error: error.message || 'Xero sync failed',
    };
  }
}

/**
 * Create invoice in Xero
 */
export async function createXeroInvoice(
  organizationId: string,
  invoiceData: {
    contactId: string; // Xero contact ID
    lineItems: Array<{
      description: string;
      amount: number;
      quantity: number;
      accountCode?: string;
    }>;
    dueDate?: string;
    invoiceNumber?: string;
    reference?: string;
  }
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const config = await getXeroConfig(organizationId);
    
    // Build invoice
    const invoice = {
      Type: 'ACCREC', // Accounts Receivable (sales invoice)
      Contact: {
        ContactID: invoiceData.contactId,
      },
      LineItems: invoiceData.lineItems.map(item => ({
        Description: item.description,
        Quantity: item.quantity,
        UnitAmount: item.amount,
        AccountCode: item.accountCode || '200', // Default sales account
        TaxType: 'NONE', // Should be configurable based on region
      })),
      DueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      InvoiceNumber: invoiceData.invoiceNumber,
      Reference: invoiceData.reference,
      Status: 'AUTHORISED', // Or 'DRAFT'
    };
    
    const response = await fetch(
      'https://api.xero.com/api.xro/2.0/Invoices',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'xero-tenant-id': config.tenantId,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Invoices: [invoice] }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.Message || 'Failed to create invoice in Xero',
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      invoiceId: result.Invoices[0].InvoiceID,
    };
  } catch (error: any) {
    console.error('Xero invoice error:', error);
    return {
      success: false,
      error: error.message || 'Xero invoice creation failed',
    };
  }
}

/**
 * Record payment in Xero
 */
export async function recordXeroPayment(
  organizationId: string,
  paymentData: {
    invoiceId: string; // Xero invoice ID
    amount: number;
    date?: string;
    reference?: string;
    accountCode?: string; // Bank account code
  }
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const config = await getXeroConfig(organizationId);
    
    const payment = {
      Invoice: {
        InvoiceID: paymentData.invoiceId,
      },
      Account: {
        Code: paymentData.accountCode || '001', // Default bank account
      },
      Amount: paymentData.amount,
      Date: paymentData.date || new Date().toISOString().split('T')[0],
      Reference: paymentData.reference,
    };
    
    const response = await fetch(
      'https://api.xero.com/api.xro/2.0/Payments',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'xero-tenant-id': config.tenantId,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Payments: [payment] }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.Message || 'Failed to record payment in Xero',
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      paymentId: result.Payments[0].PaymentID,
    };
  } catch (error: any) {
    console.error('Xero payment error:', error);
    return {
      success: false,
      error: error.message || 'Xero payment recording failed',
    };
  }
}

/**
 * Get Xero configuration
 */
async function getXeroConfig(organizationId: string): Promise<XeroConfig> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  const integration = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    'xero'
  );
  
  if (!integration) {
    throw new Error('Xero not connected');
  }
  
  const config = integration as any;
  
  if (!config.accessToken || !config.tenantId) {
    throw new Error('Xero configuration incomplete');
  }
  
  return {
    tenantId: config.tenantId,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
  };
}

/**
 * Get Xero organization info
 */
export async function getXeroOrganizationInfo(
  organizationId: string
): Promise<any> {
  const config = await getXeroConfig(organizationId);
  
  const response = await fetch(
    'https://api.xero.com/api.xro/2.0/Organisation',
    {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'xero-tenant-id': config.tenantId,
        'Accept': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch organization info');
  }
  
  const result = await response.json();
  return result.Organisations[0];
}

/**
 * Get available Xero tenants (organizations user has access to)
 */
export async function getXeroTenants(accessToken: string): Promise<any[]> {
  const response = await fetch(
    'https://api.xero.com/connections',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch Xero tenants');
  }
  
  return await response.json();
}

