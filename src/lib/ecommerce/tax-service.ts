/**
 * Tax Service
 * Calculates tax for orders
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Cart, Address } from '@/types/ecommerce';

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
  workspaceId: string,
  organizationId: string,
  cart: Cart,
  billingAddress: Address,
  shippingAddress: Address
): Promise<TaxCalculation> {
  // Get e-commerce config
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    throw new Error('E-commerce not configured');
  }
  
  const taxConfig = (ecommerceConfig as any).tax;
  
  // If no tax config or tax not enabled, return zero tax
  if (!taxConfig || !taxConfig.enabled) {
    return {
      amount: 0,
      rate: 0,
      breakdown: [],
    };
  }
  
  // Use shipping address for tax calculation (or billing if no shipping)
  const taxAddress = shippingAddress || billingAddress;
  
  if (taxConfig.calculationType === 'automated') {
    return calculateAutomatedTax(taxConfig, cart, taxAddress);
  } else {
    return calculateManualTax(taxConfig, cart, taxAddress);
  }
}

/**
 * Calculate tax using automated provider (TaxJar, Avalara, etc.)
 */
async function calculateAutomatedTax(
  taxConfig: any,
  cart: Cart,
  address: Address
): Promise<TaxCalculation> {
  // Use Stripe Tax if Stripe is configured, otherwise use basic calculation
  // TaxJar and Avalara can be added later via API keys page
  // For now, fall back to manual calculation
  return calculateManualTax(taxConfig, cart, address);
}

/**
 * Calculate tax using manual rates
 */
function calculateManualTax(
  taxConfig: any,
  cart: Cart,
  address: Address
): Promise<TaxCalculation> {
  const applicableRates = taxConfig.taxRates?.filter((rate: any) => {
    if (!rate.enabled) return false;
    if (rate.country !== address.country) return false;
    if (rate.state && rate.state !== address.state) return false;
    if (rate.city && rate.city !== address.city) return false;
    if (rate.zipCode && rate.zipCode !== address.zip) return false;
    return true;
  }) || [];
  
  if (applicableRates.length === 0) {
    return Promise.resolve({
      amount: 0,
      rate: 0,
      breakdown: [],
    });
  }
  
  // Sort by priority (higher priority first)
  applicableRates.sort((a: any, b: any) => b.priority - a.priority);
  
  // Calculate tax
  let taxableAmount = cart.subtotal;
  if (taxConfig.settings?.pricesIncludeTax) {
    // Tax is already included in prices, calculate backwards
    taxableAmount = cart.subtotal / (1 + applicableRates[0].rate / 100);
  }
  
  const breakdown: Array<{ name: string; rate: number; amount: number }> = [];
  let totalTax = 0;
  
  for (const rate of applicableRates) {
    const taxAmount = (taxableAmount * rate.rate) / 100;
    breakdown.push({
      name: rate.name,
      rate: rate.rate,
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
  if (applicableRates[0]?.applyToShipping) {
    const shippingTax = (cart.shipping * applicableRates[0].rate) / 100;
    totalTax += shippingTax;
    breakdown[0].amount += shippingTax;
  }
  
  return Promise.resolve({
    amount: totalTax,
    rate: applicableRates[0].rate,
    breakdown,
  });
}




