/**
 * E-commerce Internal Types
 * These types are used internally by ecommerce services
 * to avoid 'any' types and ensure type safety
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Product data from CRM with mapped fields
 */
export interface ProductData {
  id: string;
  name: string;
  price: number;
  description?: string;
  images?: string[];
  sku?: string;
  stockLevel?: number;
}

/**
 * E-commerce configuration from Firestore
 */
export interface EcommerceConfigData {
  productSchema: string;
  productMappings: ProductFieldMappings;
  payments?: PaymentConfig;
  shipping?: ShippingConfig;
  tax?: TaxConfig;
  notifications?: NotificationConfig;
  inventory?: InventoryConfig;
  integration?: IntegrationConfig;
}

export interface ProductFieldMappings {
  name: string;
  price: string;
  description?: string;
  images?: string;
  sku?: string;
  inventory?: string;
  category?: string;
  weight?: string;
  dimensions?: string;
  [key: string]: string | undefined;
}

export interface PaymentConfig {
  providers: PaymentProvider[];
}

export interface PaymentProvider {
  provider: string;
  enabled: boolean;
  isDefault: boolean;
  mode?: string;
}

export interface ShippingConfig {
  freeShipping?: {
    enabled: boolean;
    minOrderAmount?: number;
  };
  methods?: ShippingMethod[];
}

export interface ShippingMethod {
  id: string;
  name: string;
  enabled: boolean;
  rateType: 'flat' | 'calculated' | 'free' | 'pickup';
  flatRate?: number;
  carrier?: string;
  service?: string;
  estimatedDays?: {
    min: number;
    max: number;
  };
}

export interface TaxConfig {
  enabled: boolean;
  calculationType?: 'manual' | 'automated';
  taxRates?: TaxRate[];
  settings?: {
    pricesIncludeTax?: boolean;
  };
}

export interface TaxRate {
  name: string;
  rate: number;
  enabled: boolean;
  country: string;
  state?: string;
  city?: string;
  zipCode?: string;
  priority: number;
  compound?: boolean;
  applyToShipping?: boolean;
}

export interface NotificationConfig {
  customer?: {
    orderConfirmation?: {
      enabled: boolean;
      subject: string;
      body: string;
      fromEmail: string;
      fromName: string;
    };
  };
}

export interface InventoryConfig {
  trackInventory: boolean;
  inventoryField?: string;
}

export interface IntegrationConfig {
  createCustomerEntity?: boolean;
  customerSchema?: string;
  createOrderEntity?: boolean;
  orderSchema?: string;
  triggerWorkflows?: boolean;
}

/**
 * Discount code data from Firestore
 */
export interface DiscountCodeData {
  code: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  status: string;
  startsAt?: string | Date | Timestamp;
  expiresAt?: string | Date | Timestamp;
  usageLimit?: number;
  usageCount?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
}

/**
 * Payment result data from payment providers
 */
export interface PaymentResultData {
  provider: string;
  transactionId: string;
  cardLast4?: string;
  cardBrand?: string;
  processingFee?: number;
}

/**
 * Shipping calculation data
 */
export interface ShippingCalculationData {
  methodName: string;
  methodId: string;
  carrier?: string;
  service?: string;
  cost: number;
  estimatedDelivery?: string | Date;
}

/**
 * Tax calculation data
 */
export interface TaxCalculationData {
  amount: number;
  rate: number;
}

/**
 * Type guard to check if value is a Timestamp
 */
export function isTimestamp(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as Record<string, unknown>).toDate === 'function'
  );
}

/**
 * Serialize timestamp to ISO string
 */
export function serializeTimestamp(timestamp: unknown): string {
  if (isTimestamp(timestamp)) {
    return timestamp.toDate().toISOString();
  }
  return new Date(timestamp as string | number | Date).toISOString();
}

/**
 * Type guard for error with message
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Get error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'Unknown error occurred';
}
