/**
 * Tax Service
 * Calculates tax for orders
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import type { Cart, Address } from '@/types/ecommerce';
import { getSubCollection } from '@/lib/firebase/collections';

export interface TaxCalculation {
  amount: number;
  rate: number;
  breakdown: Array<{
    name: string;
    rate: number;
    amount: number;
  }>;
}

/**
 * Calculate tax
 */
export async function calculateTax(
  cart: Cart,
  billingAddress: Address,
  shippingAddress: Address
): Promise<TaxCalculation> {
  // Get e-commerce config
  const ecommerceConfig = await FirestoreService.get(
    getSubCollection('ecommerce'),
    'config'
  );

  if (!ecommerceConfig) {
    throw new Error('E-commerce not configured');
  }

  const taxConfig = (ecommerceConfig as Record<string, unknown>).tax as Record<string, unknown> | undefined;
  
  // If no tax config or tax not enabled, return zero tax
  if (!taxConfig?.enabled) {
    return {
      amount: 0,
      rate: 0,
      breakdown: [],
    };
  }
  
  // Use shipping address for tax calculation (or billing if no shipping)
  const taxAddress = shippingAddress || billingAddress;
  
  if (taxConfig?.calculationType === 'automated') {
    return calculateAutomatedTax(taxConfig, cart, taxAddress);
  } else {
    return calculateManualTax(taxConfig, cart, taxAddress);
  }
}

/**
 * Calculate tax using automated provider.
 * Currently falls back to manual tax rates.
 * To enable automated tax: configure Stripe Tax, TaxJar, or Avalara
 * via the API keys page, then add provider-specific logic here.
 */
async function calculateAutomatedTax(
  taxConfig: Record<string, unknown>,
  cart: Cart,
  address: Address
): Promise<TaxCalculation> {
  const provider = taxConfig.provider as string | undefined;

  if (provider === 'stripe') {
    // Stripe Tax is calculated automatically during Stripe Checkout session
    // creation when Stripe Tax is enabled in the Dashboard.
    // Return zero here — Stripe handles tax line items at payment time.
    return { amount: 0, rate: 0, breakdown: [] };
  }

  if (provider === 'taxjar') {
    return calculateTaxJarTax(taxConfig, cart, address);
  }

  // No automated provider configured — fall back to manual rates
  return calculateManualTax(taxConfig, cart, address);
}

interface TaxJarTaxResponse {
  tax: {
    amount_to_collect: number;
    rate: number;
    breakdown?: {
      state_tax_rate?: number;
      state_tax_collectable?: number;
      county_tax_rate?: number;
      county_tax_collectable?: number;
      city_tax_rate?: number;
      city_tax_collectable?: number;
      special_district_tax_rate?: number;
      special_tax_collectable?: number;
    };
  };
}

/**
 * Calculate tax using TaxJar's real-time tax calculation API.
 * Falls back to manual rates if TaxJar is not configured or the API call fails.
 */
async function calculateTaxJarTax(
  taxConfig: Record<string, unknown>,
  cart: Cart,
  address: Address
): Promise<TaxCalculation> {
  const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
  const { PLATFORM_ID } = await import('@/lib/constants/platform');

  const taxJarKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'taxjar') as { apiKey?: string } | null;

  if (!taxJarKeys?.apiKey) {
    const { logger } = await import('@/lib/logger/logger');
    logger.warn('TaxJar API key not configured, falling back to manual tax rates', { file: 'tax-service.ts' });
    return calculateManualTax(taxConfig, cart, address);
  }

  try {
    const response = await fetch('https://api.taxjar.com/v2/taxes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${taxJarKeys.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_country: address.country || 'US',
        to_zip: address.zip,
        to_state: address.state,
        to_city: address.city,
        amount: cart.subtotal,
        shipping: cart.shipping || 0,
        line_items: cart.items.map((item, index) => ({
          id: String(index),
          quantity: item.quantity,
          unit_price: item.price,
          product_tax_code: '',
        })),
      }),
    });

    if (!response.ok) {
      const { logger } = await import('@/lib/logger/logger');
      logger.error(
        'TaxJar API error, falling back to manual rates',
        new Error(`Status ${response.status}`),
        { file: 'tax-service.ts' }
      );
      return await calculateManualTax(taxConfig, cart, address);
    }

    const result = await response.json() as TaxJarTaxResponse;
    const breakdown: Array<{ name: string; rate: number; amount: number }> = [];
    const bd = result.tax.breakdown;

    if (bd) {
      if (bd.state_tax_collectable && bd.state_tax_collectable > 0) {
        breakdown.push({
          name: 'State Tax',
          rate: (bd.state_tax_rate ?? 0) * 100,
          amount: bd.state_tax_collectable,
        });
      }
      if (bd.county_tax_collectable && bd.county_tax_collectable > 0) {
        breakdown.push({
          name: 'County Tax',
          rate: (bd.county_tax_rate ?? 0) * 100,
          amount: bd.county_tax_collectable,
        });
      }
      if (bd.city_tax_collectable && bd.city_tax_collectable > 0) {
        breakdown.push({
          name: 'City Tax',
          rate: (bd.city_tax_rate ?? 0) * 100,
          amount: bd.city_tax_collectable,
        });
      }
      if (bd.special_tax_collectable && bd.special_tax_collectable > 0) {
        breakdown.push({
          name: 'Special District Tax',
          rate: (bd.special_district_tax_rate ?? 0) * 100,
          amount: bd.special_tax_collectable,
        });
      }
    }

    return {
      amount: result.tax.amount_to_collect,
      rate: result.tax.rate * 100,
      breakdown,
    };
  } catch (error: unknown) {
    const { logger } = await import('@/lib/logger/logger');
    logger.error(
      'TaxJar calculation failed, falling back to manual rates',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'tax-service.ts' }
    );
    return calculateManualTax(taxConfig, cart, address);
  }
}

interface TaxRate {
  enabled: boolean;
  country: string;
  state?: string;
  city?: string;
  zipCode?: string;
  rate: number;
  name: string;
  priority: number;
  compound?: boolean;
  applyToShipping?: boolean;
}

/**
 * Calculate tax using manual rates
 */
function calculateManualTax(
  taxConfigParam: Record<string, unknown>,
  cart: Cart,
  address: Address
): Promise<TaxCalculation> {
  const taxConfig = taxConfigParam;
  const taxRates = (taxConfig.taxRates ?? []) as TaxRate[];
  const applicableRates = taxRates.filter((rate: TaxRate) => {
    if (!rate.enabled) {return false;}
    if (rate.country !== address.country) {return false;}
    if (rate.state && rate.state !== address.state) {return false;}
    if (rate.city && rate.city !== address.city) {return false;}
    if (rate.zipCode && rate.zipCode !== address.zip) {return false;}
    return true;
  });

  if (applicableRates.length === 0) {
    return Promise.resolve({
      amount: 0,
      rate: 0,
      breakdown: [],
    });
  }

  // Sort by priority (higher priority first)
  applicableRates.sort((a: TaxRate, b: TaxRate) => b.priority - a.priority);
  
  // Calculate tax
  let taxableAmount = cart.subtotal;
  if (((taxConfig.settings as Record<string, unknown> | undefined)?.pricesIncludeTax ?? false) === true) {
    // Tax is already included in prices, calculate backwards
    taxableAmount = cart.subtotal / (1 + (applicableRates[0].rate ?? 0) / 100);
  }
  
  const breakdown: Array<{ name: string; rate: number; amount: number }> = [];
  let totalTax = 0;
  
  for (const rate of applicableRates) {
    const taxAmount = (taxableAmount * (rate.rate ?? 0)) / 100;
    breakdown.push({
      name: rate.name,
      rate: rate.rate ?? 0,
      amount: taxAmount,
    });
    totalTax += taxAmount;
    
    if (!rate.compound) {
      // Non-compound tax: don't add to taxable amount for next rate
      break;
    }
    // Compound tax: add to taxable amount for next rate
    taxableAmount += taxAmount;
  }
  
  // Apply tax to shipping if configured
  if (applicableRates[0]?.applyToShipping === true) {
    const shippingTax = (cart.shipping * (applicableRates[0].rate ?? 0)) / 100;
    totalTax += shippingTax;
    breakdown[0].amount += shippingTax;
  }

  return Promise.resolve({
    amount: totalTax,
    rate: applicableRates[0].rate ?? 0,
    breakdown,
  });
}




