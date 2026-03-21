/**
 * Payment Service Tests
 * Test payment processing across multiple providers with mocked APIs
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  calculateStripeFee,
  calculateSquareFee,
  calculatePayPalFee,
  processPayment,
  refundPayment,
  type PaymentRequest,
} from '@/lib/ecommerce/payment-service';
import { calculateRazorpayFee, PAYMENT_PROVIDERS } from '@/lib/ecommerce/payment-providers';

// ============================================================================
// Mocks
// ============================================================================

// apiKeyService is already mocked in jest.setup.js — import the mocked version
import { apiKeyService } from '@/lib/api-keys/api-key-service';
const mockGetServiceKey = apiKeyService.getServiceKey as jest.MockedFunction<typeof apiKeyService.getServiceKey>;
// Cast to jest.Mock via unknown — getKeys returns complex APIKeysConfig
const mockGetKeys = apiKeyService.getKeys as unknown as jest.MockedFunction<() => Promise<Record<string, unknown>>>;

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/constants/platform', () => ({
  PLATFORM_ID: 'test-platform',
}));

// Mock Firestore lookups used by processPayment
const mockFirestoreGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFirestoreGetAll = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
jest.mock('@/lib/db/firestore-service', () => ({
  FirestoreService: {
    get: (...args: unknown[]) => mockFirestoreGet(...args),
    getAll: (...args: unknown[]) => mockFirestoreGetAll(...args),
  },
}));

jest.mock('@/lib/firebase/collections', () => ({
  getSubCollection: (name: string) => `organizations/test-platform/${name}`,
}));

// Mock Stripe SDK — stripe module exports a function that IS the Stripe constructor
// and also has .Stripe property pointing to itself
const mockPaymentIntentsCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPaymentMethodsRetrieve = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRefundsCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();

function createMockStripeInstance() {
  return {
    paymentIntents: {
      create: (...args: unknown[]) => mockPaymentIntentsCreate(...args),
    },
    paymentMethods: {
      retrieve: (...args: unknown[]) => mockPaymentMethodsRetrieve(...args),
    },
    refunds: {
      create: (...args: unknown[]) => mockRefundsCreate(...args),
    },
  };
}

// The real stripe module is a function AND has .Stripe on it
// Dynamic import('stripe') in Jest returns { default: mockFn, Stripe: mockFn }
const MockStripeClass = jest.fn().mockImplementation(createMockStripeInstance);
const stripeMock = Object.assign(MockStripeClass, { Stripe: MockStripeClass });

jest.mock('stripe', () => ({
  __esModule: true,
  default: stripeMock,
  Stripe: MockStripeClass,
}));

// Mock firebase/firestore where clause
jest.mock('firebase/firestore', () => ({
  where: jest.fn((...args: unknown[]) => args),
}));

// ============================================================================
// Helpers
// ============================================================================

function makePaymentRequest(overrides?: Partial<PaymentRequest>): PaymentRequest {
  return {
    amount: 100,
    currency: 'USD',
    paymentMethod: 'card',
    customer: {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
    ...overrides,
  };
}

function setupStripeConfig(): void {
  mockFirestoreGet.mockResolvedValue({
    payments: {
      providers: [
        { provider: 'stripe', isDefault: true, enabled: true },
      ],
    },
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Fee Calculations
  // --------------------------------------------------------------------------

  describe('Fee Calculations', () => {
    it('should calculate Stripe fees correctly', () => {
      expect(calculateStripeFee(100)).toBeCloseTo(3.20, 2);
      expect(calculateStripeFee(1000)).toBeCloseTo(29.30, 2);
      expect(calculateStripeFee(0)).toBeCloseTo(0.30, 2);
    });

    it('should calculate Square fees correctly', () => {
      expect(calculateSquareFee(100)).toBeCloseTo(3.20, 2);
      expect(calculateSquareFee(50)).toBeCloseTo(1.75, 2);
    });

    it('should calculate PayPal fees correctly', () => {
      expect(calculatePayPalFee(100)).toBeCloseTo(3.20, 2);
      expect(calculatePayPalFee(250)).toBeCloseTo(7.55, 2);
    });

    it('should calculate Razorpay fees correctly', () => {
      expect(calculateRazorpayFee(100)).toBeCloseTo(2.00, 2);
      expect(calculateRazorpayFee(500)).toBeCloseTo(10.00, 2);
    });
  });

  // --------------------------------------------------------------------------
  // Provider Routing
  // --------------------------------------------------------------------------

  describe('processPayment — Provider Routing', () => {
    it('should return error when e-commerce is not configured', async () => {
      mockFirestoreGet.mockResolvedValue(null);
      const result = await processPayment(makePaymentRequest());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not configured/i);
    });

    it('should return error when no default payment provider', async () => {
      mockFirestoreGet.mockResolvedValue({
        payments: {
          providers: [
            { provider: 'stripe', isDefault: false, enabled: true },
          ],
        },
      });
      const result = await processPayment(makePaymentRequest());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no payment provider/i);
    });

    it('should return error when provider is disabled', async () => {
      mockFirestoreGet.mockResolvedValue({
        payments: {
          providers: [
            { provider: 'stripe', isDefault: true, enabled: false },
          ],
        },
      });
      const result = await processPayment(makePaymentRequest());
      expect(result.success).toBe(false);
    });

    it('should return error for unsupported provider', async () => {
      mockFirestoreGet.mockResolvedValue({
        payments: {
          providers: [
            { provider: 'bitcoin', isDefault: true, enabled: true },
          ],
        },
      });
      const result = await processPayment(makePaymentRequest());
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not yet implemented/i);
    });
  });

  // --------------------------------------------------------------------------
  // Stripe Payments
  // --------------------------------------------------------------------------

  describe('processPayment — Stripe', () => {
    it('should process successful Stripe payment', async () => {
      setupStripeConfig();
      mockGetServiceKey.mockResolvedValue('sk_test_123');
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
        payment_method: 'pm_test_456',
      });
      mockPaymentMethodsRetrieve.mockResolvedValue({
        card: { last4: '4242', brand: 'visa' },
      });

      const result = await processPayment(makePaymentRequest());

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('pi_test_123');
      expect(result.provider).toBe('stripe');
      expect(result.cardLast4).toBe('4242');
      expect(result.cardBrand).toBe('visa');
      expect(result.processingFee).toBeCloseTo(3.20, 2);
    });

    it('should convert amount to cents for Stripe', async () => {
      setupStripeConfig();
      mockGetServiceKey.mockResolvedValue('sk_test_123');
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test',
        status: 'succeeded',
        payment_method: null,
      });

      await processPayment(makePaymentRequest({ amount: 49.99 }));

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4999,
          currency: 'usd',
        }),
      );
    });

    it('should handle non-succeeded Stripe payment status', async () => {
      setupStripeConfig();
      mockGetServiceKey.mockResolvedValue('sk_test_123');
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test',
        status: 'requires_action',
      });

      const result = await processPayment(makePaymentRequest());

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/requires_action/);
    });

    it('should return error when Stripe API key not configured', async () => {
      setupStripeConfig();
      mockGetServiceKey.mockResolvedValue(null);

      const result = await processPayment(makePaymentRequest());

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/stripe.*key/i);
    });

    it('should handle Stripe API error gracefully', async () => {
      setupStripeConfig();
      mockGetServiceKey.mockResolvedValue('sk_test_123');
      mockPaymentIntentsCreate.mockRejectedValue(new Error('Card declined'));

      const result = await processPayment(makePaymentRequest());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card declined');
    });
  });

  // --------------------------------------------------------------------------
  // Refunds
  // --------------------------------------------------------------------------

  describe('refundPayment', () => {
    it('should return error when order not found', async () => {
      mockFirestoreGetAll.mockResolvedValue([]);

      const result = await refundPayment('pi_test_123');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/order not found/i);
    });

    it('should route Stripe refunds correctly', async () => {
      mockFirestoreGetAll.mockResolvedValue([{
        payment: { transactionId: 'pi_test_123', provider: 'stripe' },
      }]);
      mockGetKeys.mockResolvedValue({
        payments: { stripe: { publicKey: 'pk_test', secretKey: 'sk_test_123', webhookSecret: 'whsec_test' } },
      });
      mockRefundsCreate.mockResolvedValue({ id: 're_test_123' });

      const result = await refundPayment('pi_test_123');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('re_test_123');
      expect(result.provider).toBe('stripe');
    });

    it('should convert partial refund amount to cents', async () => {
      mockFirestoreGetAll.mockResolvedValue([{
        payment: { transactionId: 'pi_test_123', provider: 'stripe' },
      }]);
      mockGetKeys.mockResolvedValue({
        payments: { stripe: { secretKey: 'sk_test_123' } },
      });
      mockRefundsCreate.mockResolvedValue({ id: 're_test' });

      await refundPayment('pi_test_123', 25.50);

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2550,
        }),
      );
    });

    it('should return error for non-Stripe provider refunds', async () => {
      mockFirestoreGetAll.mockResolvedValue([{
        payment: { transactionId: 'pp_test_123', provider: 'paypal' },
      }]);

      const result = await refundPayment('pp_test_123');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/manual/i);
    });
  });

  // --------------------------------------------------------------------------
  // Payment Providers List
  // --------------------------------------------------------------------------

  describe('Payment Providers List', () => {
    it('should have 8 payment providers configured', () => {
      expect(PAYMENT_PROVIDERS).toHaveLength(8);

      const providerIds = PAYMENT_PROVIDERS.map((p: { id: string }) => p.id);
      expect(providerIds).toContain('stripe');
      expect(providerIds).toContain('square');
      expect(providerIds).toContain('paypal');
      expect(providerIds).toContain('authorizenet');
      expect(providerIds).toContain('braintree');
      expect(providerIds).toContain('2checkout');
      expect(providerIds).toContain('razorpay');
      expect(providerIds).toContain('mollie');
    });

    it('should have provider metadata', () => {
      PAYMENT_PROVIDERS.forEach((provider: { id: string; name: string; description: string; fee: string; countries: string }) => {
        expect(provider.id).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.description).toBeDefined();
        expect(provider.fee).toBeDefined();
        expect(provider.countries).toBeDefined();
      });
    });
  });
});
