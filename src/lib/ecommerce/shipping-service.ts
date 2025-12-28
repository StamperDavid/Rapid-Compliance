/**
 * Shipping Service
 * Calculates shipping costs
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Cart, Address } from '@/types/ecommerce';

export interface ShippingCalculation {
  cost: number;
  methodId: string;
  methodName: string;
  carrier?: string;
  service?: string;
  estimatedDelivery?: string;
}

/**
 * Calculate shipping cost
 */
export async function calculateShipping(
  workspaceId: string,
  organizationId: string,
  cart: Cart,
  address: Address,
  methodId?: string
): Promise<ShippingCalculation> {
  // Get e-commerce config
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    throw new Error('E-commerce not configured');
  }
  
  const shippingConfig = (ecommerceConfig as any).shipping;
  
  // Check for free shipping
  if (shippingConfig.freeShipping?.enabled) {
    const minAmount = shippingConfig.freeShipping.minOrderAmount || 0;
    if (cart.subtotal >= minAmount) {
      return {
        cost: 0,
        methodId: 'free_shipping',
        methodName: 'Free Shipping',
        estimatedDelivery: calculateEstimatedDelivery(5, 7), // 5-7 business days
      };
    }
  }
  
  // Get shipping method
  if (methodId) {
    const method = shippingConfig.methods?.find((m: any) => m.id === methodId && m.enabled);
    if (method) {
      return calculateMethodCost(method, cart, address);
    }
  }
  
  // Get default/cheapest method
  const availableMethods = shippingConfig.methods?.filter((m: any) => m.enabled) || [];
  if (availableMethods.length === 0) {
    return {
      cost: 0,
      methodId: 'none',
      methodName: 'No Shipping',
    };
  }
  
  // Calculate costs for all methods and return cheapest
  const calculations = await Promise.all(
    availableMethods.map(method => calculateMethodCost(method, cart, address))
  );
  
  return calculations.sort((a, b) => a.cost - b.cost)[0];
}

/**
 * Calculate cost for specific shipping method
 */
async function calculateMethodCost(
  method: any,
  cart: Cart,
  address: Address
): Promise<ShippingCalculation> {
  switch (method.rateType) {
    case 'flat':
      return {
        cost: method.flatRate || 0,
        methodId: method.id,
        methodName: method.name,
        estimatedDelivery: method.estimatedDays
          ? calculateEstimatedDelivery(method.estimatedDays.min, method.estimatedDays.max)
          : undefined,
      };
    
    case 'calculated':
      // Carrier APIs (USPS, UPS, FedEx) can be added via Settings > API Keys > Integrations
      // For now, return flat rate estimate
      return {
        cost: estimateCalculatedShipping(method, cart, address),
        methodId: method.id,
        methodName: method.name,
        carrier: method.carrier,
        service: method.service,
        estimatedDelivery: method.estimatedDays
          ? calculateEstimatedDelivery(method.estimatedDays.min, method.estimatedDays.max)
          : undefined,
      };
    
    case 'free':
      return {
        cost: 0,
        methodId: method.id,
        methodName: method.name,
        estimatedDelivery: method.estimatedDays
          ? calculateEstimatedDelivery(method.estimatedDays.min, method.estimatedDays.max)
          : undefined,
      };
    
    case 'pickup':
      return {
        cost: 0,
        methodId: method.id,
        methodName: method.name,
      };
    
    default:
      return {
        cost: 0,
        methodId: method.id,
        methodName: method.name,
      };
  }
}

/**
 * Estimate calculated shipping (placeholder for carrier API integration)
 */
function estimateCalculatedShipping(method: any, cart: Cart, address: Address): number {
  // Simple estimation based on cart total
  // In production, use carrier APIs
  const baseRate = 5.00;
  const weightMultiplier = 0.5; // $0.50 per estimated pound
  const estimatedWeight = cart.items.length * 1; // Assume 1 lb per item
  
  return baseRate + (estimatedWeight * weightMultiplier);
}

/**
 * Calculate estimated delivery date
 */
function calculateEstimatedDelivery(minDays: number, maxDays: number): string {
  const today = new Date();
  const deliveryDate = new Date();
  deliveryDate.setDate(today.getDate() + maxDays);
  
  // Skip weekends
  while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
  }
  
  return deliveryDate.toISOString().split('T')[0];
}




