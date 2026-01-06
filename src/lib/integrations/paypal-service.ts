/**
 * PayPal Integration
 * Uses API keys from workspace settings (NOT .env)
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';

interface PayPalConfig {
  clientId: string;
  secret: string;
  mode: 'sandbox' | 'live';
}

async function getPayPalConfig(organizationId: string): Promise<PayPalConfig> {
  const keys = await apiKeyService.getKeys(organizationId);
  
  if (!keys?.payments?.paypal?.clientId || !keys?.payments?.paypal?.clientSecret) {
    throw new Error('PayPal not configured. Please add your PayPal API keys in Settings > API Keys');
  }
  
  return {
    clientId: keys.payments.paypal.clientId,
    secret: keys.payments.paypal.clientSecret,
    mode: keys.payments.paypal.mode,
  };
}

async function getAccessToken(organizationId: string): Promise<string> {
  const config = await getPayPalConfig(organizationId);
  const baseUrl = config.mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
  
  const auth = Buffer.from(`${config.clientId}:${config.secret}`).toString('base64');
  
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

export async function createOrder(
  organizationId: string,
  amount: number,
  currency: string = 'USD'
): Promise<any> {
  const accessToken = await getAccessToken(organizationId);
  const config = await getPayPalConfig(organizationId);
  const baseUrl = config.mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
  
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: (amount / 100).toFixed(2),
        },
      }],
    }),
  });

  return response.json();
}

export async function captureOrder(
  organizationId: string,
  orderId: string
): Promise<any> {
  const accessToken = await getAccessToken(organizationId);
  const config = await getPayPalConfig(organizationId);
  const baseUrl = config.mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
  
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

export async function createPayout(
  organizationId: string,
  recipients: Array<{ email: string; amount: number }>
): Promise<any> {
  const accessToken = await getAccessToken(organizationId);
  const config = await getPayPalConfig(organizationId);
  const baseUrl = config.mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
  
  const response = await fetch(`${baseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `batch_${Date.now()}`,
        email_subject: 'You have a payout!',
      },
      items: recipients.map(r => ({
        recipient_type: 'EMAIL',
        amount: {
          value: (r.amount / 100).toFixed(2),
          currency: 'USD',
        },
        receiver: r.email,
      })),
    }),
  });

  return response.json();
}

export async function getOrderDetails(
  organizationId: string,
  orderId: string
): Promise<any> {
  const accessToken = await getAccessToken(organizationId);
  const config = await getPayPalConfig(organizationId);
  const baseUrl = config.mode === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
  
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return response.json();
}




