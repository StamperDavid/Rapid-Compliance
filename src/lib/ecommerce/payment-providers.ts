/**
 * Additional Payment Providers
 * Support for multiple payment processors to give users maximum flexibility
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { PaymentRequest, PaymentResult } from './payment-service';

/**
 * Process Authorize.Net payment
 */
export async function processAuthorizeNetPayment(
  request: PaymentRequest,
  providerConfig: any
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
    
    const { apiLoginId, transactionKey, mode } = authNetKeys as any;
    
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
    
    if (txnResponse && txnResponse.responseCode === '1') {
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
      return {
        success: false,
        error: txnResponse?.errors?.[0]?.errorText || 'Transaction failed',
      };
    }
  } catch (error: any) {
    console.error('Authorize.Net payment error:', error);
    return {
      success: false,
      error: error.message || 'Authorize.Net payment processing failed',
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
 */
export async function processBraintreePayment(
  request: PaymentRequest,
  providerConfig: any
): Promise<PaymentResult> {
  try {
    const orgId = request.workspaceId.split('/')[0];
    const braintreeKeys = await apiKeyService.getServiceKey(orgId, 'braintree');
    
    if (!braintreeKeys) {
      return {
        success: false,
        error: 'Braintree credentials not configured',
      };
    }
    
    const { merchantId, publicKey, privateKey, environment } = braintreeKeys as any;
    
    if (!merchantId || !publicKey || !privateKey) {
      return {
        success: false,
        error: 'Braintree API credentials missing',
      };
    }
    
    // Use Braintree SDK
    const braintree = await import('braintree');
    const gateway = new braintree.BraintreeGateway({
      environment: environment === 'production' 
        ? braintree.Environment.Production
        : braintree.Environment.Sandbox,
      merchantId,
      publicKey,
      privateKey,
    });
    
    // Create transaction
    const result = await gateway.transaction.sale({
      amount: request.amount.toFixed(2),
      paymentMethodNonce: request.paymentToken,
      customer: {
        firstName: request.customer.firstName,
        lastName: request.customer.lastName,
        email: request.customer.email,
        phone: request.customer.phone,
      },
      options: {
        submitForSettlement: true,
      },
      orderId: request.metadata?.orderId,
    });
    
    if (result.success && result.transaction) {
      const transaction = result.transaction;
      
      return {
        success: true,
        transactionId: transaction.id,
        provider: 'braintree',
        cardLast4: transaction.creditCard?.last4,
        cardBrand: transaction.creditCard?.cardType,
        processingFee: calculateBraintreeFee(request.amount),
      };
    } else {
      return {
        success: false,
        error: result.message || 'Braintree transaction failed',
      };
    }
  } catch (error: any) {
    console.error('Braintree payment error:', error);
    return {
      success: false,
      error: error.message || 'Braintree payment processing failed',
    };
  }
}

/**
 * Calculate Braintree fee
 */
function calculateBraintreeFee(amount: number): number {
  // Braintree: 2.9% + $0.30 (standard rate)
  return amount * 0.029 + 0.30;
}

/**
 * Process 2Checkout payment (now Verifone)
 */
export async function process2CheckoutPayment(
  request: PaymentRequest,
  providerConfig: any
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
    
    const { merchantCode, secretKey, mode } = tcoKeys as any;
    
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
        error: result.message || '2Checkout payment failed',
      };
    }
  } catch (error: any) {
    console.error('2Checkout payment error:', error);
    return {
      success: false,
      error: error.message || '2Checkout payment processing failed',
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
 */
export async function processRazorpayPayment(
  request: PaymentRequest,
  providerConfig: any
): Promise<PaymentResult> {
  try {
    const orgId = request.workspaceId.split('/')[0];
    const razorpayKeys = await apiKeyService.getServiceKey(orgId, 'razorpay');
    
    if (!razorpayKeys) {
      return {
        success: false,
        error: 'Razorpay credentials not configured',
      };
    }
    
    const { keyId, keySecret } = razorpayKeys as any;
    
    if (!keyId || !keySecret) {
      return {
        success: false,
        error: 'Razorpay API credentials missing',
      };
    }
    
    // Use Razorpay SDK
    const Razorpay = (await import('razorpay')).default;
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    
    // Capture payment
    const payment = await razorpay.payments.capture(
      request.paymentToken || '',
      Math.round(request.amount * 100), // Amount in paise (smallest currency unit)
      request.currency.toUpperCase()
    );
    
    if (payment.status === 'captured') {
      return {
        success: true,
        transactionId: payment.id,
        provider: 'razorpay',
        cardLast4: payment.card?.last4,
        cardBrand: payment.card?.network,
        processingFee: calculateRazorpayFee(request.amount),
      };
    } else {
      return {
        success: false,
        error: `Payment status: ${payment.status}`,
      };
    }
  } catch (error: any) {
    console.error('Razorpay payment error:', error);
    return {
      success: false,
      error: error.message || 'Razorpay payment processing failed',
    };
  }
}

/**
 * Calculate Razorpay fee
 */
function calculateRazorpayFee(amount: number): number {
  // Razorpay: 2% (no fixed fee, varies by plan)
  return amount * 0.02;
}

/**
 * Process Mollie payment (popular in Europe)
 */
export async function processMolliePayment(
  request: PaymentRequest,
  providerConfig: any
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
    
    const { apiKey } = mollieKeys as any;
    
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
  } catch (error: any) {
    console.error('Mollie payment error:', error);
    return {
      success: false,
      error: error.message || 'Mollie payment processing failed',
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
    id: 'braintree',
    name: 'Braintree',
    description: 'PayPal-owned, great mobile support',
    fee: '2.9% + $0.30',
    logo: '🌳',
    countries: 'Global',
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
    id: 'razorpay',
    name: 'Razorpay',
    description: 'Leading payment gateway in India',
    fee: '2% (no fixed fee)',
    logo: '🇮🇳',
    countries: 'India',
  },
  {
    id: 'mollie',
    name: 'Mollie',
    description: 'Popular in Europe, local methods',
    fee: '1.8% + €0.25',
    logo: '🇪🇺',
    countries: 'Europe',
  },
];

