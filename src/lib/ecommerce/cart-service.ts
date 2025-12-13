/**
 * Shopping Cart Service
 * Manages shopping cart operations
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Cart, CartItem, AppliedDiscount } from '@/types/ecommerce';
import { Timestamp } from 'firebase/firestore';

/**
 * Get or create cart for session
 */
export async function getOrCreateCart(
  sessionId: string,
  workspaceId: string,
  userId?: string
): Promise<Cart> {
  // Try to get existing cart
  const existingCart = await FirestoreService.get<Cart>(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/carts`,
    sessionId
  );
  
  if (existingCart) {
    // Check if cart is expired
    const expiresAt = existingCart.expiresAt as any;
    if (expiresAt && new Date(expiresAt.toDate?.() || expiresAt) < new Date()) {
      // Cart expired, create new one
      return createCart(sessionId, workspaceId, userId);
    }
    return existingCart;
  }
  
  // Create new cart
  return createCart(sessionId, workspaceId, userId);
}

/**
 * Create new cart
 */
async function createCart(
  sessionId: string,
  workspaceId: string,
  userId?: string
): Promise<Cart> {
  const now = Timestamp.now();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expire after 7 days
  
  const cart: Cart = {
    id: sessionId,
    sessionId,
    userId,
    workspaceId,
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
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/carts`,
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
  workspaceId: string,
  productId: string,
  quantity: number = 1,
  variantId?: string,
  variantOptions?: Record<string, string>
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId, workspaceId);
  
  // Get product details (from CRM entity)
  const product = await getProduct(workspaceId, productId);
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Check if item already in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.productId === productId && 
            item.variantId === variantId &&
            JSON.stringify(item.variantOptions) === JSON.stringify(variantOptions)
  );
  
  if (existingItemIndex >= 0) {
    // Update quantity
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].subtotal = 
      cart.items[existingItemIndex].price * cart.items[existingItemIndex].quantity;
  } else {
    // Add new item
    const item: CartItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId,
      productName: product.name,
      sku: product.sku,
      variantId,
      variantOptions,
      price: product.price,
      quantity,
      subtotal: product.price * quantity,
      image: product.images?.[0],
      addedAt: Timestamp.now(),
    };
    
    cart.items.push(item);
  }
  
  // Recalculate totals
  await recalculateCartTotals(cart);
  
  // Save cart
  await saveCart(cart);
  
  return cart;
}

/**
 * Remove item from cart
 */
export async function removeFromCart(
  sessionId: string,
  workspaceId: string,
  itemId: string
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId, workspaceId);
  
  cart.items = cart.items.filter(item => item.id !== itemId);
  
  // Recalculate totals
  await recalculateCartTotals(cart);
  
  // Save cart
  await saveCart(cart);
  
  return cart;
}

/**
 * Update item quantity
 */
export async function updateCartItemQuantity(
  sessionId: string,
  workspaceId: string,
  itemId: string,
  quantity: number
): Promise<Cart> {
  if (quantity <= 0) {
    return removeFromCart(sessionId, workspaceId, itemId);
  }
  
  const cart = await getOrCreateCart(sessionId, workspaceId);
  
  const item = cart.items.find(i => i.id === itemId);
  if (!item) {
    throw new Error('Item not found in cart');
  }
  
  item.quantity = quantity;
  item.subtotal = item.price * quantity;
  
  // Recalculate totals
  await recalculateCartTotals(cart);
  
  // Save cart
  await saveCart(cart);
  
  return cart;
}

/**
 * Apply discount code
 */
export async function applyDiscountCode(
  sessionId: string,
  workspaceId: string,
  code: string
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId, workspaceId);
  
  // Get discount code
  const discount = await getDiscountCode(workspaceId, code);
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
  const appliedDiscount: AppliedDiscount = {
    code: discount.code,
    type: discount.type,
    value: discount.value,
    amount: discountAmount,
  };
  
  cart.discountCodes.push(appliedDiscount);
  
  // Recalculate totals
  await recalculateCartTotals(cart);
  
  // Save cart
  await saveCart(cart);
  
  return cart;
}

/**
 * Remove discount code
 */
export async function removeDiscountCode(
  sessionId: string,
  workspaceId: string,
  code: string
): Promise<Cart> {
  const cart = await getOrCreateCart(sessionId, workspaceId);
  
  cart.discountCodes = cart.discountCodes.filter(dc => dc.code !== code);
  
  // Recalculate totals
  await recalculateCartTotals(cart);
  
  // Save cart
  await saveCart(cart);
  
  return cart;
}

/**
 * Recalculate cart totals
 */
async function recalculateCartTotals(cart: Cart): Promise<void> {
  // Calculate subtotal
  cart.subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Calculate discount
  cart.discount = cart.discountCodes.reduce((sum, dc) => sum + dc.amount, 0);
  
  // Calculate tax (will be calculated during checkout with address)
  // For now, keep existing tax or 0
  
  // Calculate shipping (will be calculated during checkout with address)
  // For now, keep existing shipping or 0
  
  // Calculate total
  cart.total = cart.subtotal - cart.discount + cart.tax + cart.shipping;
  
  // Update timestamp
  cart.updatedAt = Timestamp.now();
}

/**
 * Save cart to Firestore
 */
async function saveCart(cart: Cart): Promise<void> {
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${cart.workspaceId}/carts`,
    cart.id,
    {
      ...cart,
      createdAt: (cart.createdAt as any).toDate?.()?.toISOString() || cart.createdAt,
      updatedAt: (cart.updatedAt as any).toDate?.()?.toISOString() || cart.updatedAt,
      expiresAt: (cart.expiresAt as any).toDate?.()?.toISOString() || cart.expiresAt,
      items: cart.items.map(item => ({
        ...item,
        addedAt: (item.addedAt as any).toDate?.()?.toISOString() || item.addedAt,
      })),
    },
    false
  );
}

/**
 * Get product from CRM
 */
async function getProduct(workspaceId: string, productId: string): Promise<any> {
  // Get e-commerce config to find product schema
  const orgId = workspaceId.split('/')[0]; // Extract org ID from path if needed
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    throw new Error('E-commerce not configured for this workspace');
  }
  
  const productSchema = (ecommerceConfig as any).productSchema;
  
  // Get product entity
  const product = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/entities/${productSchema}`,
    productId
  );
  
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Map product fields using productMappings
  const mappings = (ecommerceConfig as any).productMappings;
  return {
    id: product.id,
    name: product[mappings.name],
    price: parseFloat(product[mappings.price] || 0),
    description: product[mappings.description],
    images: product[mappings.images] || [],
    sku: product[mappings.sku],
    stockLevel: product[mappings.inventory],
  };
}

/**
 * Get discount code
 */
async function getDiscountCode(workspaceId: string, code: string): Promise<any> {
  const { where } = await import('firebase/firestore');
  const discounts = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/discountCodes`,
    [where('code', '==', code.toUpperCase())]
  );
  
  return discounts.length > 0 ? discounts[0] : null;
}

/**
 * Validate discount code
 */
function validateDiscount(discount: any, cart: Cart): void {
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
  if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
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
function calculateDiscountAmount(discount: any, cart: Cart): number {
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
  sessionId: string,
  workspaceId: string
): Promise<void> {
  await FirestoreService.delete(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/carts`,
    sessionId
  );
}













