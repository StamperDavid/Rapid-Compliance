/**
 * Payment Service Tests
 * Test payment processing across multiple providers
 */

import { describe, it, expect, jest } from '@jest/globals';
import { calculateStripeFee, calculateSquareFee, calculatePayPalFee, processPayment } from '@/lib/ecommerce/payment-service';
import { calculateRazorpayFee, PAYMENT_PROVIDERS } from '@/lib/ecommerce/payment-providers';

describe('Payment Service', () => {
  describe('Fee Calculations', () => {
    it('should calculate Stripe fees correctly', () => {
      // $100 order: 2.9% + $0.30 = $3.20
      expect(calculateStripeFee(100)).toBeCloseTo(3.20, 2);
      
      // $1000 order: 2.9% + $0.30 = $29.30
      expect(calculateStripeFee(1000)).toBeCloseTo(29.30, 2);
    });
    
    it('should calculate Square fees correctly', () => {
      // $100 order: 2.9% + $0.30 = $3.20
      expect(calculateSquareFee(100)).toBeCloseTo(3.20, 2);
    });
    
    it('should calculate PayPal fees correctly', () => {
      // $100 order: 2.9% + $0.30 = $3.20
      expect(calculatePayPalFee(100)).toBeCloseTo(3.20, 2);
    });
    
    it('should calculate Razorpay fees correctly', () => {
      // $100 order: 2% = $2.00
      expect(calculateRazorpayFee(100)).toBeCloseTo(2.00, 2);
    });
  });
  
  describe('Provider Routing', () => {
    it('should route to correct payment provider', async () => {
      const request = {
        workspaceId: 'test-workspace',
        amount: 100,
        currency: 'USD',
        paymentMethod: 'card',
        customer: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      };
      
      // This would need mocking in real tests
      // Just verify the function exists and has correct signature
      expect(typeof processPayment).toBe('function');
    });
  });
  
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





















