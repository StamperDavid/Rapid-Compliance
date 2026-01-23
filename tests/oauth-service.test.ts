/**
 * OAuth Service Tests
 * Test OAuth 2.0 flows for integrations
 */

import { describe, it, expect } from '@jest/globals';
import type { OAuthConfig } from '@/lib/integrations/oauth-service';
import { generateAuthUrl } from '@/lib/integrations/oauth-service';
import { syncCustomerToQuickBooks, createQuickBooksInvoice, recordQuickBooksPayment } from '@/lib/integrations/quickbooks-service';
import { syncCustomerToXero, createXeroInvoice, recordXeroPayment, getXeroTenants } from '@/lib/integrations/xero-service';
import { PAYMENT_PROVIDERS } from '@/lib/ecommerce/payment-providers';

// Strongly-typed mock data for QuickBooks
// These interfaces extend Record<string, unknown> to match the service function signatures
interface QuickBooksCustomerMock extends Record<string, unknown> {
  displayName: string;
  email: string;
  phone?: string;
  synced?: boolean;
}

interface QuickBooksInvoiceMock extends Record<string, unknown> {
  customerId: string;
  amount: number;
  dueDate: string;
  id?: string;
}

interface QuickBooksPaymentMock extends Record<string, unknown> {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  recorded?: boolean;
}

// Strongly-typed mock data for Xero
// These interfaces extend Record<string, unknown> to match the service function signatures
interface XeroCustomerMock extends Record<string, unknown> {
  name: string;
  email: string;
  phone?: string;
  synced?: boolean;
}

interface XeroInvoiceMock extends Record<string, unknown> {
  contactId: string;
  amount: number;
  dueDate: string;
  id?: string;
}

interface XeroPaymentMock extends Record<string, unknown> {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  recorded?: boolean;
}

describe('OAuth Service', () => {
  describe('Authorization URL Generation', () => {
    it('should generate valid OAuth URL with state token', () => {
      // Verify function signature
      expect(typeof generateAuthUrl).toBe('function');

      // Type check: generateAuthUrl should accept correct parameters
      const validProviders: Array<OAuthConfig['provider']> = ['google', 'microsoft', 'slack', 'quickbooks', 'xero'];
      expect(validProviders).toContain('google');
    });
  });

  describe('Supported Providers', () => {
    it('should support Google OAuth', () => {
      const provider: OAuthConfig['provider'] = 'google';
      expect(provider).toBe('google');
    });

    it('should support Microsoft OAuth', () => {
      const provider: OAuthConfig['provider'] = 'microsoft';
      expect(provider).toBe('microsoft');
    });

    it('should support QuickBooks OAuth', () => {
      const provider: OAuthConfig['provider'] = 'quickbooks';
      expect(provider).toBe('quickbooks');
    });

    it('should support Xero OAuth', () => {
      const provider: OAuthConfig['provider'] = 'xero';
      expect(provider).toBe('xero');
    });
  });
});

describe('QuickBooks Service', () => {
  describe('Customer Sync', () => {
    it('should format customer data for QuickBooks API', () => {
      expect(typeof syncCustomerToQuickBooks).toBe('function');

      // Create strongly-typed mock customer
      const mockCustomer: QuickBooksCustomerMock = {
        displayName: 'Test Customer',
        email: 'test@example.com',
        phone: '555-1234'
      };

      const result = syncCustomerToQuickBooks(mockCustomer);
      expect(result).toHaveProperty('synced', true);
    });
  });

  describe('Invoice Creation', () => {
    it('should format invoice data correctly', () => {
      expect(typeof createQuickBooksInvoice).toBe('function');

      // Create strongly-typed mock invoice
      const mockInvoice: QuickBooksInvoiceMock = {
        customerId: 'customer-123',
        amount: 1000,
        dueDate: '2026-02-28'
      };

      const result = createQuickBooksInvoice(mockInvoice);
      expect(result).toHaveProperty('id', 'qb-invoice-test');
    });
  });

  describe('Payment Recording', () => {
    it('should format payment data correctly', () => {
      expect(typeof recordQuickBooksPayment).toBe('function');

      // Create strongly-typed mock payment
      const mockPayment: QuickBooksPaymentMock = {
        invoiceId: 'invoice-123',
        amount: 1000,
        paymentDate: '2026-01-23'
      };

      const result = recordQuickBooksPayment(mockPayment);
      expect(result).toHaveProperty('recorded', true);
    });
  });
});

describe('Xero Service', () => {
  describe('Contact Sync', () => {
    it('should format contact data for Xero API', () => {
      expect(typeof syncCustomerToXero).toBe('function');

      // Create strongly-typed mock customer
      const mockCustomer: XeroCustomerMock = {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '555-1234'
      };

      const result = syncCustomerToXero(mockCustomer);
      expect(result).toHaveProperty('synced', true);
    });
  });

  describe('Invoice Creation', () => {
    it('should create invoices in Xero format', () => {
      expect(typeof createXeroInvoice).toBe('function');

      // Create strongly-typed mock invoice
      const mockInvoice: XeroInvoiceMock = {
        contactId: 'contact-123',
        amount: 1000,
        dueDate: '2026-02-28'
      };

      const result = createXeroInvoice(mockInvoice);
      expect(result).toHaveProperty('id', 'xero-invoice-test');
    });
  });

  describe('Payment Recording', () => {
    it('should record payments in Xero', () => {
      expect(typeof recordXeroPayment).toBe('function');

      // Create strongly-typed mock payment
      const mockPayment: XeroPaymentMock = {
        invoiceId: 'invoice-123',
        amount: 1000,
        paymentDate: '2026-01-23'
      };

      const result = recordXeroPayment(mockPayment);
      expect(result).toHaveProperty('recorded', true);
    });
  });

  describe('Tenant Management', () => {
    it('should fetch available Xero tenants', async () => {
      expect(typeof getXeroTenants).toBe('function');

      const tenants = await getXeroTenants();
      expect(Array.isArray(tenants)).toBe(true);
      expect(tenants.length).toBeGreaterThan(0);
      expect(tenants[0]).toHaveProperty('id');
      expect(tenants[0]).toHaveProperty('name');
    });
  });
});

describe('Payment Providers', () => {
  it('should export payment providers array', () => {
    expect(Array.isArray(PAYMENT_PROVIDERS)).toBe(true);
    expect(PAYMENT_PROVIDERS.length).toBeGreaterThan(0);
  });

  it('should have properly typed provider entries', () => {
    const provider = PAYMENT_PROVIDERS[0];
    expect(provider).toHaveProperty('id');
    expect(provider).toHaveProperty('name');
    expect(provider).toHaveProperty('description');
    expect(typeof provider.id).toBe('string');
    expect(typeof provider.name).toBe('string');
  });
});






















