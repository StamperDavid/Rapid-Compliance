/**
 * Shopping Cart Service
 * Manages shopping cart operations
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Cart, CartItem, AppliedDiscount } from '@/types/ecommerce';
import { Timestamp, runTransaction, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { getEcommerceConfig } from './types';

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
  docId: string;
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
  if (isTimestamp(value)) {return value.toDate();}
  return new Date(value as string | number | Date);
}

function serializeTimestamp(value: unknown): string {
  if (isTimestamp(value)) {return value.toDate().toISOString();}
  if (typeof value === 'string') {return value;}
  return new Date().toISOString();
}

/**
 * Get or create cart for session
 */
export async function getOrCreateCart(
  sessionId: string,
  userId?: string
): Promise<Cart> {
  // Try to get existing cart
  const existingCart = await FirestoreService.get<Cart>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/carts`,
    sessionId
  );

  if (existingCart) {
    // Check if cart is expired
    const expiresAt = existingCart.expiresAt;
    const expiresDate = toDateOrString(expiresAt);
    if (expiresAt && expiresDate < new Date()) {
      // Cart expired, create new one
      return createCart(sessionId, userId);
    }
    return existingCart;
  }

  // Create new cart
  return createCart(sessionId, userId);
}

/**
 * Create new cart
 */
async function createCart(
  sessionId: string,
  userId?: string
): Promise<Cart> {
  const now = Timestamp.now();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expire after 7 days

  const cart: Cart = {
    id: sessionId,
    sessionId,
    ...(userId && { userId }), // Only include userId if defined
    items: [],
    subtotal: 0,
    tax: 0,
    shipping: 0,
    discount: 0,
    total: 0,
    discountCodes: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: Timestamp.fromDate(expiresAt),
    status: 'active',
  };

  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/carts`,
    sessionId,
    {
      ...cart,
      createdAt: cart.createdAt.toDate().toISOString(),
      updatedAt: cart.updatedAt.toDate().toISOString(),
      expiresAt: cart.expiresAt.toDate().toISOString(),
    },
    false
  );

  return cart;
}

/**
 * Add item to cart
 */
export async function addToCart(
  sessionId: string,
  productId: string,
  quantity: number = 1,
  variantId?: string,
  variantOptions?: Record<string, string>
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId);

  // Get product details (from CRM entity)
  const product = await getProduct(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Check if item already in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.productId === productId && 
            (item.variantId ?? null) === (variantId ?? null) &&
            JSON.stringify(item.variantOptions ?? {}) === JSON.stringify(variantOptions ?? {})
  );
  
  if (existingItemIndex >= 0) {
    // Update quantity
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].subtotal = 
      cart.items[existingItemIndex].price * cart.items[existingItemIndex].quantity;
  } else {
    // Add new item
    const productPrice = typeof product.price === 'number' ? product.price : 0;
    const item: CartItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId,
      productName: product.name,
      sku: product.sku,
      ...(variantId && { variantId }), // Only include if defined
      ...(variantOptions && { variantOptions }), // Only include if defined
      price: productPrice,
      quantity,
      subtotal: productPrice * quantity,
      image: product.images?.[0],
      addedAt: Timestamp.now(),
    };
    
    cart.items.push(item);
  }
  
  // Recalculate totals
  recalculateCartTotals(cart);
  
  // Save cart
  await saveCart(cart);
  
  return cart;
}

/**
 * Remove item from cart
 */
export async function removeFromCart(
  sessionId: string,
  itemId: string
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId);

  cart.items = cart.items.filter(item => item.id !== itemId);

  // Recalculate totals
  recalculateCartTotals(cart);

  // Save cart
  await saveCart(cart);

  return cart;
}

/**
 * Update item quantity
 */
export async function updateCartItemQuantity(
  sessionId: string,
  itemId: string,
  quantity: number
): Promise<Cart> {
  if (quantity <= 0) {
    return removeFromCart(sessionId, itemId);
  }

  const cart = await getOrCreateCart(sessionId);

  const item = cart.items.find(i => i.id === itemId);
  if (!item) {
    throw new Error('Item not found in cart');
  }

  item.quantity = quantity;
  item.subtotal = item.price * quantity;

  // Recalculate totals
  recalculateCartTotals(cart);

  // Save cart
  await saveCart(cart);

  return cart;
}

/**
 * Apply discount code
 */
export async function applyDiscountCode(
  sessionId: string,
  code: string
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId);

  // Get discount code
  const discount = await getDiscountCode(code);
  if (!discount) {
    throw new Error('Invalid discount code');
  }

  // Check if already applied
  if (cart.discountCodes.some(dc => dc.code === code)) {
    throw new Error('Discount code already applied');
  }

  // Validate discount
  validateDiscount(discount, cart);

  // Calculate discount amount
  const discountAmount = calculateDiscountAmount(discount, cart);

  // Add to applied discounts
  const discountType = discount.type as 'percentage' | 'fixed' | 'free_shipping';
  const appliedDiscount: AppliedDiscount = {
    code: discount.code,
    type: discountType,
    value: discount.value,
    amount: discountAmount,
  };

  cart.discountCodes.push(appliedDiscount);

  // Recalculate totals
  recalculateCartTotals(cart);

  // Save cart
  await saveCart(cart);

  // Atomically check limit and increment usage count to prevent race conditions
  if (discount.usageLimit && db) {
    try {
      const discountPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/discountCodes`;
      const discountRef = doc(db, discountPath, discount.docId);

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(discountRef);
        if (!snapshot.exists()) {
          throw new Error('Discount code no longer exists');
        }
        const data = snapshot.data();
        const currentCount = (data?.usageCount as number) ?? 0;
        const usageLimit = (data?.usageLimit as number) ?? 0;

        if (currentCount >= usageLimit) {
          throw new Error('Discount code usage limit reached');
        }

        transaction.update(discountRef, { usageCount: currentCount + 1 });
      });
    } catch (error) {
      // If the transaction fails due to limit, remove the discount from the cart
      if (error instanceof Error && error.message.includes('usage limit')) {
        cart.discountCodes = cart.discountCodes.filter(dc => dc.code !== code);
        recalculateCartTotals(cart);
        await saveCart(cart);
        throw error;
      }
      // Log but don't fail for other errors — the discount is already applied
      logger.error('Failed to increment discount usage count', undefined, { code: discount.code, docId: discount.docId });
    }
  }

  return cart;
}

/**
 * Remove discount code
 */
export async function removeDiscountCode(
  sessionId: string,
  code: string
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId);

  cart.discountCodes = cart.discountCodes.filter(dc => dc.code !== code);

  // Recalculate totals
  recalculateCartTotals(cart);

  // Save cart
  await saveCart(cart);

  // Decrement discount usage count when removed from cart
  try {
    const discount = await getDiscountCode(code);
    if (discount?.usageLimit && (discount.usageCount ?? 0) > 0) {
      const discountPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/discountCodes`;
      await FirestoreService.update(discountPath, discount.docId, {
        usageCount: (discount.usageCount ?? 1) - 1,
      });
    }
  } catch {
    logger.error('Failed to decrement discount usage count', undefined, { code });
  }

  return cart;
}

/**
 * Recalculate cart totals
 */
function recalculateCartTotals(cart: Cart): void {
  // Calculate subtotal
  cart.subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Calculate discount
  cart.discount = cart.discountCodes.reduce((sum, dc) => sum + dc.amount, 0);
  
  // Calculate tax (will be calculated during checkout with address)
  // For now, keep existing tax or 0
  
  // Calculate shipping (will be calculated during checkout with address)
  // For now, keep existing shipping or 0
  
  // Calculate total (floor at zero to prevent negative totals from stacked discounts)
  cart.total = Math.max(0, cart.subtotal - cart.discount + cart.tax + cart.shipping);
  
  // Update timestamp
  cart.updatedAt = Timestamp.now();
}

/**
 * Save cart to Firestore
 */
async function saveCart(cart: Cart): Promise<void> {
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/carts`,
    cart.id,
    {
      ...cart,
      createdAt: serializeTimestamp(cart.createdAt),
      updatedAt: serializeTimestamp(cart.updatedAt),
      expiresAt: serializeTimestamp(cart.expiresAt),
      items: cart.items.map(item => {
        const serializedItem: SerializedCartItem = {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku ?? '',
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          addedAt: serializeTimestamp(item.addedAt),
        };

        // Only include optional fields if they are defined
        if (item.variantId !== undefined) {serializedItem.variantId = item.variantId;}
        if (item.variantOptions !== undefined) {serializedItem.variantOptions = item.variantOptions;}
        if (item.image !== undefined && item.image !== null) {serializedItem.image = item.image;}

        return serializedItem;
      }),
    },
    false
  );
}

/**
 * Get product from CRM
 */
async function getProduct(productId: string): Promise<ProductData | null> {
  const config = await getEcommerceConfig();
  if (!config) {
    throw new Error('E-commerce not configured');
  }

  const productSchema = config.productSchema;

  // Get product entity from records collection
  const product = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/entities/${productSchema}/records`,
    productId
  );

  if (!product) {
    return null;
  }

  // Map product fields using productMappings
  const mappings = config.productMappings;
  const productRecord = product as Record<string, unknown>;
  return {
    id: productRecord.id as string,
    name: productRecord[mappings.name] as string,
    price: parseFloat(String((productRecord[mappings.price] !== '' && productRecord[mappings.price] != null) ? productRecord[mappings.price] : 0)),
    description: mappings.description ? productRecord[mappings.description] as string | undefined : undefined,
    images: mappings.images ? (productRecord[mappings.images] as string[] | undefined) ?? [] : [],
    sku: mappings.sku ? productRecord[mappings.sku] as string : '',
    stockLevel: mappings.inventory ? productRecord[mappings.inventory] as number | undefined : undefined,
  };
}

/**
 * Get discount code
 */
async function getDiscountCode(code: string): Promise<DiscountData | null> {
  const { where } = await import('firebase/firestore');
  const discounts = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/discountCodes`,
    [where('code', '==', code.toUpperCase())]
  );

  if (discounts.length === 0) {return null;}
  const d = discounts[0] as Record<string, unknown>;
  return {
    docId: d.id as string,
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
  };
}

/**
 * Validate discount code
 */
function validateDiscount(discount: DiscountData, cart: Cart): void {
  const now = new Date();
  
  // Check status
  if (discount.status !== 'active') {
    throw new Error('Discount code is not active');
  }
  
  // Check date range
  if (discount.startsAt && new Date(discount.startsAt) > now) {
    throw new Error('Discount code not yet valid');
  }
  
  if (discount.expiresAt && new Date(discount.expiresAt) < now) {
    throw new Error('Discount code has expired');
  }
  
  // Check usage limit
  if (discount.usageLimit && (discount.usageCount ?? 0) >= discount.usageLimit) {
    throw new Error('Discount code usage limit reached');
  }
  
  // Check min purchase amount
  if (discount.minPurchaseAmount && cart.subtotal < discount.minPurchaseAmount) {
    throw new Error(`Minimum purchase amount of ${discount.minPurchaseAmount} required`);
  }
}

/**
 * Calculate discount amount
 */
function calculateDiscountAmount(discount: DiscountData, cart: Cart): number {
  let amount = 0;
  
  switch (discount.type) {
    case 'percentage':
      amount = (cart.subtotal * discount.value) / 100;
      if (discount.maxDiscountAmount) {
        amount = Math.min(amount, discount.maxDiscountAmount);
      }
      break;
    
    case 'fixed':
      amount = discount.value;
      break;
    
    case 'free_shipping':
      // Will be applied during checkout
      amount = 0;
      break;
  }
  
  return Math.min(amount, cart.subtotal); // Can't discount more than subtotal
}

/**
 * Clear cart
 */
export async function clearCart(
  sessionId: string
): Promise<void> {
  await FirestoreService.delete(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/carts`,
    sessionId
  );
}






















