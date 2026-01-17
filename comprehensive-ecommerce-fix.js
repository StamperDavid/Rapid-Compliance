/**
 * Comprehensive ESLint Fix for E-commerce Directory
 * Replaces all `any` types with proper TypeScript types
 * Removes unused variables
 * Fixes async/await issues
 */

const fs = require('fs');
const path = require('path');

const ecommercePath = path.join(__dirname, 'src', 'lib', 'ecommerce');

console.log('Starting comprehensive fix...\n');

// Define all type-safe replacements
const fixes = {
  'cart-service.ts': [
    // Add type definitions at the top
    {
      search: /import { Timestamp } from 'firebase\/firestore';/g,
      replace: `import { Timestamp } from 'firebase/firestore';

interface ProductData {
  id: string;
  name: string;
  sku: string;
  price: number | string;
  description?: string;
  images?: string[];
  stockLevel?: number;
}

interface DiscountData {
  code: string;
  type: string;
  value: number;
  status: string;
  startsAt?: string | Date;
  expiresAt?: string | Date;
  usageLimit?: number;
  usageCount?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
}

interface EcommerceConfig {
  productSchema: string;
  productMappings: Record<string, string>;
}

interface SerializedCartItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
  subtotal: number;
  addedAt: string;
  variantId?: string;
  variantOptions?: Record<string, string>;
  image?: string;
}

type FirestoreTimestamp = { toDate: () => Date };

function isTimestamp(value: unknown): value is FirestoreTimestamp {
  return typeof value === 'object' && value !== null && 'toDate' in value;
}

function toDateOrString(value: unknown): Date {
  if (isTimestamp(value)) return value.toDate();
  return new Date(value as string | number | Date);
}

function serializeTimestamp(value: unknown): string {
  if (isTimestamp(value)) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}`
    },
    // Fix the expiresAt check
    {
      search: /const expiresAt = existingCart\.expiresAt as any;\s+if \(expiresAt && new Date\(expiresAt\.toDate\?\.\(\) \?\? expiresAt\)/g,
      replace: 'const expiresAt = existingCart.expiresAt;\n    const expiresDate = toDateOrString(expiresAt);\n    if (expiresAt && expiresDate'
    },
    // Fix recalculateCartTotals async
    {
      search: /async function recalculateCartTotals\(cart: Cart\): Promise<void>/g,
      replace: 'function recalculateCartTotals(cart: Cart): void'
    },
    // Fix await recalculateCartTotals
    {
      search: /await recalculateCartTotals\(cart\);/g,
      replace: 'recalculateCartTotals(cart);'
    },
    // Fix saveCart timestamps
    {
      search: /createdAt: \(cart\.createdAt as any\)\.toDate\?\.\(\)\?\.toISOString\(\) \?\? cart\.createdAt,/g,
      replace: 'createdAt: serializeTimestamp(cart.createdAt),'
    },
    {
      search: /updatedAt: \(cart\.updatedAt as any\)\.toDate\?\.\(\)\?\.toISOString\(\) \?\? cart\.updatedAt,/g,
      replace: 'updatedAt: serializeTimestamp(cart.updatedAt),'
    },
    {
      search: /expiresAt: \(cart\.expiresAt as any\)\.toDate\?\.\(\)\?\.toISOString\(\) \?\? cart\.expiresAt,/g,
      replace: 'expiresAt: serializeTimestamp(cart.expiresAt),'
    },
    // Fix serializedItem any
    {
      search: /const serializedItem: any = {/g,
      replace: 'const serializedItem: SerializedCartItem = {'
    },
    {
      search: /addedAt: \(item\.addedAt as any\)\.toDate\?\.\(\)\?\.toISOString\(\) \?\? item\.addedAt,/g,
      replace: 'addedAt: serializeTimestamp(item.addedAt),'
    },
    // Fix getProduct return type
    {
      search: /async function getProduct\(workspaceId: string, productId: string, organizationId\?: string\): Promise<any>/g,
      replace: 'async function getProduct(workspaceId: string, productId: string, organizationId?: string): Promise<ProductData | null>'
    },
    // Fix getProduct casting
    {
      search: /const productSchema = \(ecommerceConfig as any\)\.productSchema;/g,
      replace: 'const config = ecommerceConfig as unknown as EcommerceConfig;\n  const productSchema = config.productSchema;'
    },
    {
      search: /\/\/ Map product fields using productMappings\s+const mappings = \(ecommerceConfig as any\)\.productMappings;/g,
      replace: '// Map product fields using productMappings\n  const mappings = config.productMappings;\n  const productData = product as Record<string, unknown>;'
    },
    {
      search: /return {\s+id: product\.id,\s+name: product\[mappings\.name\],\s+price: parseFloat\(\(product\[mappings\.price\][^\}]+\},\s+stockLevel: product\[mappings\.inventory\],\s+};/gs,
      replace: `return {
    id: productData.id as string,
    name: productData[mappings.name] as string,
    price: parseFloat(String((productData[mappings.price] ?? 0) || 0)),
    description: productData[mappings.description] as string | undefined,
    images: (productData[mappings.images] ?? []) as string[],
    sku: productData[mappings.sku] as string,
    stockLevel: productData[mappings.inventory] as number | undefined,
  };`
    },
    // Fix product not found
    {
      search: /if \(!product\) {\s+throw new Error\('Product not found'\);\s+}/g,
      replace: 'if (!product) {\n    return null;\n  }'
    },
    // Fix getDiscountCode
    {
      search: /async function getDiscountCode\(workspaceId: string, organizationId: string, code: string\): Promise<any>/g,
      replace: 'async function getDiscountCode(workspaceId: string, organizationId: string, code: string): Promise<DiscountData | null>'
    },
    {
      search: /return discounts\.length > 0 \? discounts\[0\] : null;/g,
      replace: `if (discounts.length === 0) return null;
  const d = discounts[0] as Record<string, unknown>;
  return {
    code: d.code as string,
    type: d.type as string,
    value: d.value as number,
    status: d.status as string,
    startsAt: d.startsAt as string | Date | undefined,
    expiresAt: d.expiresAt as string | Date | undefined,
    usageLimit: d.usageLimit as number | undefined,
    usageCount: d.usageCount as number | undefined,
    minPurchaseAmount: d.minPurchaseAmount as number | undefined,
    maxDiscountAmount: d.maxDiscountAmount as number | undefined,
  };`
    },
    // Fix validateDiscount
    {
      search: /function validateDiscount\(discount: any, cart: Cart\): void/g,
      replace: 'function validateDiscount(discount: DiscountData, cart: Cart): void'
    },
    // Fix calculateDiscountAmount
    {
      search: /function calculateDiscountAmount\(discount: any, cart: Cart\): number/g,
      replace: 'function calculateDiscountAmount(discount: DiscountData, cart: Cart): number'
    },
  ],

  'checkout-service.ts': [
    // Fix unused workspaceId
    {
      search: /function generateOrderNumber\(workspaceId: string\): string {/g,
      replace: 'function generateOrderNumber(_workspaceId: string): string {'
    },
    // Fix any types in createOrder
    {
      search: /shipping: any,\s+tax: any,\s+paymentResult: any/g,
      replace: `shipping: ShippingInfo,
  tax: TaxInfo,
  paymentResult: PaymentResultInfo`
    },
    // Add interfaces at top
    {
      search: /import { calculateTax } from '.\/tax-service';/g,
      replace: `import { calculateTax } from './tax-service';

interface ShippingInfo {
  cost: number;
  methodId: string;
  methodName: string;
  carrier?: string;
  service?: string;
  estimatedDelivery?: string;
}

interface TaxInfo {
  amount: number;
  rate: number;
}

interface PaymentResultInfo {
  success: boolean;
  transactionId?: string;
  provider?: string;
  cardLast4?: string;
  cardBrand?: string;
  processingFee?: number;
  error?: string;
}

interface EcommerceConfig {
  productSchema: string;
  productMappings: Record<string, string>;
  inventory?: { trackInventory: boolean; inventoryField: string };
  integration?: {
    createCustomerEntity: boolean;
    customerSchema: string;
    createOrderEntity: boolean;
    orderSchema: string;
    triggerWorkflows: boolean;
  };
  notifications?: {
    customer?: {
      orderConfirmation?: {
        enabled: boolean;
        subject: string;
        body: string;
        fromEmail: string;
        fromName: string;
      };
    };
  };
}

function serializeTimestamp(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}`
    },
    // Fix getProduct
    {
      search: /async function getProduct\(workspaceId: string, organizationId: string, productId: string\): Promise<any>/g,
      replace: 'async function getProduct(workspaceId: string, organizationId: string, productId: string): Promise<Record<string, unknown> | null>'
    },
    // Fix all (ecommerceConfig as any)
    {
      search: /\(ecommerceConfig as any\)/g,
      replace: '(ecommerceConfig as unknown as EcommerceConfig)'
    },
    // Fix updateInventory
    {
      search: /async function updateInventory\(workspaceId: string, organizationId: string, items: any\[\]\): Promise<void>/g,
      replace: 'async function updateInventory(workspaceId: string, organizationId: string, items: Array<{ productId: string; quantity: number }>): Promise<void>'
    },
    // Fix createCustomerEntity
    {
      search: /async function createCustomerEntity\(workspaceId: string, organizationId: string, customer: any, orderId: string\): Promise<void>/g,
      replace: 'async function createCustomerEntity(workspaceId: string, organizationId: string, customer: { firstName: string; lastName: string; email: string; phone?: string }, orderId: string): Promise<void>'
    },
    // Fix order.createdAt serialization
    {
      search: /createdAt: \(order\.createdAt as any\)\.toDate\?\.\(\)\?\.toISOString\(\) \?\? order\.createdAt,/g,
      replace: 'createdAt: serializeTimestamp(order.createdAt),'
    },
    // Fix payment method any
    {
      search: /method: checkoutData\.paymentMethod as any,/g,
      replace: 'method: checkoutData.paymentMethod as OrderPayment["method"],'
    },
  ],

  'mapping-adapter.ts': [
    // Fix handleFieldRename async
    {
      search: /async function handleFieldRename\(/g,
      replace: 'function handleFieldRename('
    },
    {
      search: /\): Promise<boolean> {\s+let updated = false;/g,
      replace: '): boolean {\n  let updated = false;'
    },
    // Fix (mappings as any)[field]
    {
      search: /\(mappings as any\)\[field\] = newFieldKey;/g,
      replace: '(mappings as Record<string, string>)[field] = newFieldKey;'
    },
    {
      search: /\(mappings as any\)\[mappingKey\] = resolved\.fieldKey;/g,
      replace: '(mappings as Record<string, string>)[mappingKey] = resolved.fieldKey;'
    },
    // Fix getEcommerceFieldValue async
    {
      search: /export async function getEcommerceFieldValue\(/g,
      replace: 'export function getEcommerceFieldValue('
    },
    {
      search: /schema\?: any\s*\): Promise<any>/g,
      replace: 'schema?: unknown\n): unknown'
    },
    // Remove all await from non-async calls
    {
      search: /updated = await handleFieldRename\(/g,
      replace: 'updated = handleFieldRename('
    },
  ],

  'payment-providers.ts': [
    // Fix unused providerConfig
    {
      search: /providerConfig: any\s*\): Promise<PaymentResult> {/g,
      replace: '_providerConfig: unknown\n): Promise<PaymentResult> {'
    },
    // Fix all (error: any)
    {
      search: /} catch \(error: any\) {/g,
      replace: '} catch (error: unknown) {\n    const err = error as Error;'
    },
    {
      search: /error\.message/g,
      replace: 'err.message'
    },
  ],

  'payment-service.ts': [
    // Remove unused import
    {
      search: /import type { OrderPayment } from '@\/types\/ecommerce'/g,
      replace: '// OrderPayment type not used directly'
    },
    // Fix metadata any
    {
      search: /metadata\?: Record<string, any>;/g,
      replace: 'metadata?: Record<string, unknown>;'
    },
    // Fix providerConfig
    {
      search: /providerConfig: any\s*\): Promise<PaymentResult> {/g,
      replace: '_providerConfig: unknown\n): Promise<PaymentResult> {'
    },
    // Fix unused e
    {
      search: /} catch \(e\) {/g,
      replace: '} catch {'
    },
    // Fix all (error: any)
    {
      search: /} catch \(error: any\) {/g,
      replace: '} catch (error: unknown) {\n      const err = error as Error;'
    },
    {
      search: /error\.message/g,
      replace: 'err.message'
    },
  ],

  'product-service.ts': [
    // Remove COLLECTIONS import
    {
      search: /import { FirestoreService, COLLECTIONS } from '@\/lib\/db\/firestore-service';/g,
      replace: "import { FirestoreService } from '@/lib/db/firestore-service';"
    },
    // Fix customFields any
    {
      search: /customFields\?: Record<string, any>;/g,
      replace: 'customFields?: Record<string, unknown>;'
    },
    // Fix createdAt any
    {
      search: /createdAt: any;/g,
      replace: 'createdAt: Date | string;'
    },
    {
      search: /updatedAt\?: any;/g,
      replace: 'updatedAt?: Date | string;'
    },
    // Fix non-null assertions
    {
      search: /filter\(p => p\.price >= filters\.minPrice!\);/g,
      replace: 'filter(p => filters.minPrice !== undefined && p.price >= filters.minPrice);'
    },
    {
      search: /filter\(p => p\.price <= filters\.maxPrice!\);/g,
      replace: 'filter(p => filters.maxPrice !== undefined && p.price <= filters.maxPrice);'
    },
    // Fix all (error: any)
    {
      search: /} catch \(error: any\) {/g,
      replace: '} catch (error: unknown) {\n    const err = error as Error;'
    },
    {
      search: /error\.message/g,
      replace: 'err.message'
    },
  ],

  'shipping-service.ts': [
    // Fix (ecommerceConfig as any)
    {
      search: /const shippingConfig = \(ecommerceConfig as any\)\.shipping;/g,
      replace: 'const shippingConfig = (ecommerceConfig as Record<string, unknown>).shipping as Record<string, unknown> | undefined;'
    },
    // Fix calculateMethodCost async
    {
      search: /async function calculateMethodCost\(/g,
      replace: 'function calculateMethodCost('
    },
    {
      search: /\): Promise<ShippingCalculation> {/g,
      replace: '): ShippingCalculation {'
    },
    // Fix method: any
    {
      search: /method: any,/g,
      replace: 'method: Record<string, unknown>,'
    },
    // Fix estimateCalculatedShipping
    {
      search: /function estimateCalculatedShipping\(method: any,/g,
      replace: 'function estimateCalculatedShipping(_method: Record<string, unknown>,'
    },
    // Fix unused address
    {
      search: /address: Address\): number {/g,
      replace: '_address: Address\): number {'
    },
  ],

  'tax-service.ts': [
    // Fix (ecommerceConfig as any)
    {
      search: /const taxConfig = \(ecommerceConfig as any\)\.tax;/g,
      replace: 'const taxConfig = (ecommerceConfig as Record<string, unknown>).tax as Record<string, unknown> | undefined;'
    },
    // Fix all taxConfig: any
    {
      search: /taxConfig: any,/g,
      replace: 'taxConfig: Record<string, unknown>,'
    },
  ],
};

// Apply fixes
Object.entries(fixes).forEach(([filename, replacements]) => {
  const filePath = path.join(ecommercePath, filename);
  console.log(`Fixing ${filename}...`);

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changeCount = 0;

    replacements.forEach(({ search, replace }) => {
      const matches = content.match(search);
      if (matches) {
        content = content.replace(search, replace);
        changeCount += matches.length;
      }
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Applied ${changeCount} changes to ${filename}\n`);
  } catch (error) {
    console.error(`  ✗ Error fixing ${filename}:`, error.message, '\n');
  }
});

console.log('Comprehensive fix completed!');
console.log('\nRun: npx eslint "src/lib/ecommerce/**" to verify fixes\n');
