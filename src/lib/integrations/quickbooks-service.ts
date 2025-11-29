/**
 * QuickBooks Integration Service
 * Sync customers, invoices, payments with QuickBooks Online
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';

export interface QuickBooksConfig {
  realmId: string; // Company ID
  accessToken: string;
  refreshToken: string;
  environment: 'production' | 'sandbox';
}

/**
 * Sync customer to QuickBooks
 */
export async function syncCustomerToQuickBooks(
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
): Promise<{ success: boolean; quickbooksId?: string; error?: string }> {
  try {
    const config = await getQuickBooksConfig(organizationId);
    
    // QuickBooks API endpoint
    const baseUrl = config.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    // Create customer in QuickBooks
    const customer = {
      DisplayName: `${customerData.firstName} ${customerData.lastName}`,
      GivenName: customerData.firstName,
      FamilyName: customerData.lastName,
      PrimaryEmailAddr: {
        Address: customerData.email,
      },
      PrimaryPhone: customerData.phone ? {
        FreeFormNumber: customerData.phone,
      } : undefined,
      CompanyName: customerData.company,
      BillAddr: customerData.address ? {
        Line1: customerData.address.street,
        City: customerData.address.city,
        CountrySubDivisionCode: customerData.address.state,
        PostalCode: customerData.address.zip,
        Country: customerData.address.country || 'USA',
      } : undefined,
    };
    
    const response = await fetch(
      `${baseUrl}/v3/company/${config.realmId}/customer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customer),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.Fault?.Error?.[0]?.Message || 'Failed to sync customer',
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      quickbooksId: result.Customer.Id,
    };
  } catch (error: any) {
    console.error('QuickBooks sync error:', error);
    return {
      success: false,
      error: error.message || 'QuickBooks sync failed',
    };
  }
}

/**
 * Create invoice in QuickBooks
 */
export async function createQuickBooksInvoice(
  organizationId: string,
  invoiceData: {
    customerId: string; // QuickBooks customer ID
    lineItems: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
    dueDate?: string;
    invoiceNumber?: string;
  }
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const config = await getQuickBooksConfig(organizationId);
    
    const baseUrl = config.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    // Build invoice
    const invoice = {
      CustomerRef: {
        value: invoiceData.customerId,
      },
      Line: invoiceData.lineItems.map((item, index) => ({
        Id: String(index + 1),
        LineNum: index + 1,
        Description: item.description,
        Amount: item.amount * item.quantity,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.amount,
          ItemRef: {
            name: item.description,
            value: '1', // Default item - should be configurable
          },
        },
      })),
      DueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      DocNumber: invoiceData.invoiceNumber,
    };
    
    const response = await fetch(
      `${baseUrl}/v3/company/${config.realmId}/invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoice),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.Fault?.Error?.[0]?.Message || 'Failed to create invoice',
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      invoiceId: result.Invoice.Id,
    };
  } catch (error: any) {
    console.error('QuickBooks invoice error:', error);
    return {
      success: false,
      error: error.message || 'QuickBooks invoice creation failed',
    };
  }
}

/**
 * Record payment in QuickBooks
 */
export async function recordQuickBooksPayment(
  organizationId: string,
  paymentData: {
    customerId: string; // QuickBooks customer ID
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    invoiceId?: string; // QuickBooks invoice ID
  }
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const config = await getQuickBooksConfig(organizationId);
    
    const baseUrl = config.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    const payment = {
      CustomerRef: {
        value: paymentData.customerId,
      },
      TotalAmt: paymentData.amount,
      PaymentMethodRef: {
        name: paymentData.paymentMethod,
      },
      PrivateNote: paymentData.transactionId ? `Transaction ID: ${paymentData.transactionId}` : undefined,
      Line: paymentData.invoiceId ? [{
        Amount: paymentData.amount,
        LinkedTxn: [{
          TxnId: paymentData.invoiceId,
          TxnType: 'Invoice',
        }],
      }] : undefined,
    };
    
    const response = await fetch(
      `${baseUrl}/v3/company/${config.realmId}/payment`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payment),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.Fault?.Error?.[0]?.Message || 'Failed to record payment',
      };
    }
    
    const result = await response.json();
    
    return {
      success: true,
      paymentId: result.Payment.Id,
    };
  } catch (error: any) {
    console.error('QuickBooks payment error:', error);
    return {
      success: false,
      error: error.message || 'QuickBooks payment recording failed',
    };
  }
}

/**
 * Get QuickBooks configuration
 */
async function getQuickBooksConfig(organizationId: string): Promise<QuickBooksConfig> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  const integration = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    'quickbooks'
  );
  
  if (!integration) {
    throw new Error('QuickBooks not connected');
  }
  
  const config = integration as any;
  
  if (!config.accessToken || !config.realmId) {
    throw new Error('QuickBooks configuration incomplete');
  }
  
  return {
    realmId: config.realmId,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    environment: config.environment || 'sandbox',
  };
}

/**
 * Get QuickBooks company info
 */
export async function getQuickBooksCompanyInfo(
  organizationId: string
): Promise<any> {
  const config = await getQuickBooksConfig(organizationId);
  
  const baseUrl = config.environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
  
  const response = await fetch(
    `${baseUrl}/v3/company/${config.realmId}/companyinfo/${config.realmId}`,
    {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Accept': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch company info');
  }
  
  const result = await response.json();
  return result.CompanyInfo;
}

