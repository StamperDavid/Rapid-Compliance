/**
 * Additional Payment Providers
 * Support for multiple payment processors to give users maximum flexibility
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { PaymentRequest, PaymentResult } from './payment-service'
import { logger } from '@/lib/logger/logger';

/**
 * Process Authorize.Net payment
 */
export async function processAuthorizeNetPayment(
  request: PaymentRequest,
  _providerConfig: unknown
): Promise<PaymentResult> {
  try {
    const orgId = request.workspaceId.split('/')[0];
    const authNetKeys = await apiKeyService.getServiceKey(orgId, 'authorizenet');
    
    if (!authNetKeys) {
      return {
        success: false,
        error: 'Authorize.Net credentials not configured',
      };
    }
    
    const { apiLoginId, transactionKey, mode } = authNetKeys;
    
    if (!apiLoginId || !transactionKey) {
      return {
        success: false,
        error: 'Authorize.Net API credentials missing',
      };
    }
    
    // Authorize.Net API endpoint
    const endpoint = mode === 'production'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';
    
    // Create transaction request
    const transactionRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey,
        },
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: request.amount.toFixed(2),
          payment: {
            opaqueData: {
              dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
              dataValue: request.paymentToken,
            },
          },
          customer: {
            email: request.customer.email,
          },
          billTo: {
            firstName: request.customer.firstName,
            lastName: request.customer.lastName,
            email: request.customer.email,
          },
          order: {
            invoiceNumber: request.metadata?.orderId,
          },
        },
      },
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionRequest),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: 'Authorize.Net API request failed',
      };
    }
    
    const result = await response.json();
    const txnResponse = result.transactionResponse;
    
    if (txnResponse?.responseCode === '1') {
      // Approved
      return {
        success: true,
        transactionId: txnResponse.transId,
        provider: 'authorizenet',
        cardLast4: txnResponse.accountNumber?.slice(-4),
        cardBrand: txnResponse.accountType,
        processingFee: calculateAuthorizeNetFee(request.amount),
      };
    } else {
      const errorText = txnResponse?.errors?.[0]?.errorText;
      return {
        success: false,
        error: (errorText !== '' && errorText != null) ? errorText : 'Transaction failed',
      };
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Authorize.Net payment error:', error, { file: 'payment-providers.ts' });
    const errorMessage = err.message;
    return {
      success: false,
      error: (errorMessage !== '' && errorMessage != null) ? errorMessage : 'Authorize.Net payment processing failed',
    };
  }
}

/**
 * Calculate Authorize.Net fee
 */
function calculateAuthorizeNetFee(amount: number): number {
  // Authorize.Net: 2.9% + $0.30 (typical rate, varies by merchant)
  return amount * 0.029 + 0.30;
}

/**
 * Process Braintree payment (PayPal-owned)
 * NOTE: Disabled - requires 'braintree' package installation
 * To enable: npm install braintree
 */
// Braintree removed - not needed for production


/**
 * Process 2Checkout payment (now Verifone)
 */
export async function process2CheckoutPayment(
  request: PaymentRequest,
  _providerConfig: unknown
): Promise<PaymentResult> {
  try {
    const orgId = request.workspaceId.split('/')[0];
    const tcoKeys = await apiKeyService.getServiceKey(orgId, '2checkout');
    
    if (!tcoKeys) {
      return {
        success: false,
        error: '2Checkout credentials not configured',
      };
    }
    
    const { merchantCode, secretKey, mode } = tcoKeys;
    
    if (!merchantCode || !secretKey) {
      return {
        success: false,
        error: '2Checkout API credentials missing',
      };
    }
    
    // 2Checkout API endpoint
    const endpoint = mode === 'production'
      ? 'https://api.2checkout.com/rest/6.0/orders/'
      : 'https://api.sandbox.2checkout.com/rest/6.0/orders/';
    
    // Create order
    const orderData = {
      Country: 'US',
      Currency: request.currency.toUpperCase(),
      CustomerIP: '127.0.0.1', // Should be actual customer IP
      ExternalReference: request.metadata?.orderId,
      Language: 'en',
      Source: 'api',
      BillingDetails: {
        FirstName: request.customer.firstName,
        LastName: request.customer.lastName,
        Email: request.customer.email,
        Phone: request.customer.phone,
      },
      Items: [{
        Name: 'Order Payment',
        Description: `Payment for order`,
        Quantity: 1,
        Price: request.amount,
        IsDynamic: true,
      }],
      PaymentDetails: {
        Type: 'EES_TOKEN_PAYMENT',
        PaymentMethod: {
          EesToken: request.paymentToken,
          Vendor3DSReturnURL: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/complete`,
        },
      },
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Avangate-Authentication': `code="${merchantCode}" date="${new Date().toUTCString()}" hash="${secretKey}"`,
      },
      body: JSON.stringify(orderData),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: '2Checkout API request failed',
      };
    }
    
    const result = await response.json();
    
    if (result.RefNo) {
      return {
        success: true,
        transactionId: result.RefNo,
        provider: '2checkout',
        processingFee: calculate2CheckoutFee(request.amount),
      };
    } else {
      return {
        success: false,
        error:(result.message !== '' && result.message != null) ? result.message : '2Checkout payment failed',
      };
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('2Checkout payment error:', error, { file: 'payment-providers.ts' });
    return {
      success: false,
      error:(err.message !== '' && err.message != null) ? err.message : '2Checkout payment processing failed',
    };
  }
}

/**
 * Calculate 2Checkout fee
 */
function calculate2CheckoutFee(amount: number): number {
  // 2Checkout: 3.5% + $0.35 (typical rate)
  return amount * 0.035 + 0.35;
}

/**
 * Process Razorpay payment (popular in India)
 * NOTE: Disabled - requires 'razorpay' package installation
 * To enable: npm install razorpay
 */
// Razorpay removed - not needed for production


/**
 * Process Mollie payment (popular in Europe)
 */
export async function processMolliePayment(
  request: PaymentRequest,
  _providerConfig: unknown
): Promise<PaymentResult> {
  try {
    const orgId = request.workspaceId.split('/')[0];
    const mollieKeys = await apiKeyService.getServiceKey(orgId, 'mollie');
    
    if (!mollieKeys) {
      return {
        success: false,
        error: 'Mollie credentials not configured',
      };
    }
    
    const { apiKey } = mollieKeys;
    
    if (!apiKey) {
      return {
        success: false,
        error: 'Mollie API key missing',
      };
    }
    
    // Create payment
    const response = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: {
          currency: request.currency.toUpperCase(),
          value: request.amount.toFixed(2),
        },
        description: `Payment from ${request.customer.email}`,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/complete`,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mollie`,
        metadata: {
          order_id: request.metadata?.orderId,
          customer_email: request.customer.email,
        },
      }),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: 'Mollie API request failed',
      };
    }
    
    const payment = await response.json();
    
    if (payment.id) {
      return {
        success: true,
        transactionId: payment.id,
        provider: 'mollie',
        processingFee: calculateMollieFee(request.amount),
      };
    } else {
      return {
        success: false,
        error: 'Mollie payment creation failed',
      };
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Mollie payment error:', error, { file: 'payment-providers.ts' });
    return {
      success: false,
      error:(err.message !== '' && err.message != null) ? err.message : 'Mollie payment processing failed',
    };
  }
}

/**
 * Calculate Mollie fee
 */
function calculateMollieFee(amount: number): number {
  // Mollie: 1.8% + €0.25 (varies by payment method)
  // Using approximate USD conversion
  return amount * 0.018 + 0.28;
}

// Simple Razorpay fee helper for tests
export function calculateRazorpayFee(amount: number): number {
  return amount * 0.02;
}

/**
 * Get all available payment providers
 */
export const PAYMENT_PROVIDERS = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Most popular, great for global payments',
    fee: '2.9% + $0.30',
    logo: '💳',
    countries: 'Global',
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Best for in-person + online sales',
    fee: '2.9% + $0.30',
    logo: '🟦',
    countries: 'US, CA, UK, AU, JP',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Trusted by customers worldwide',
    fee: '2.9% + $0.30',
    logo: '🅿️',
    countries: 'Global',
  },
  {
    id: 'authorizenet',
    name: 'Authorize.Net',
    description: 'Reliable for established businesses',
    fee: '2.9% + $0.30',
    logo: '🔐',
    countries: 'US, CA, UK, EU',
  },
  {
    id: '2checkout',
    name: '2Checkout',
    description: 'Multi-currency, global reach',
    fee: '3.5% + $0.35',
    logo: '✅',
    countries: 'Global',
  },
  {
    id: 'mollie',
    name: 'Mollie',
    description: 'Popular in Europe, local methods',
    fee: '1.8% + €0.25',
    logo: '🇪🇺',
    countries: 'Europe',
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    description: 'Popular in India, simple fees',
    fee: '2% + small fixed',
    logo: '🇮🇳',
    countries: 'India',
  },
  {
    id: 'braintree',
    name: 'Braintree',
    description: 'PayPal-owned, robust payments',
    fee: '2.9% + $0.30',
    logo: '💠',
    countries: 'Global',
  },
];

