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

  // No automated provider configured — fall back to manual rates
  return calculateManualTax(taxConfig, cart, address);
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




