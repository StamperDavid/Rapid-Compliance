/**
 * Checkout Service
 * Handles checkout process and order creation
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { getOrCreateCart, clearCart } from './cart-service';
import type { Cart, Order, Address, OrderPayment, OrderShipping } from '@/types/ecommerce';
import { Timestamp } from 'firebase/firestore';
import { processPayment } from './payment-service';
import { calculateShipping } from './shipping-service';
import { calculateTax } from './tax-service';

export interface CheckoutData {
  cartId: string;
  organizationId: string;
  workspaceId: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  billingAddress: Address;
  shippingAddress: Address;
  shippingMethodId?: string;
  paymentMethod: string;
  paymentToken?: string; // For Stripe, etc.
  notes?: string;
  giftMessage?: string;
}

/**
 * Process checkout
 */
export async function processCheckout(checkoutData: CheckoutData): Promise<Order> {
  // Get cart
  const cart = await getOrCreateCart(checkoutData.cartId, checkoutData.workspaceId, checkoutData.organizationId);
  
  if (cart.items.length === 0) {
    throw new Error('Cart is empty');
  }
  
  // Validate cart
  await validateCart(cart);
  
  // Calculate shipping
  const shipping = await calculateShipping(
    checkoutData.workspaceId,
    checkoutData.organizationId,
    cart,
    checkoutData.shippingAddress,
    checkoutData.shippingMethodId
  );
  
  // Calculate tax
  const tax = await calculateTax(
    checkoutData.workspaceId,
    checkoutData.organizationId,
    cart,
    checkoutData.billingAddress,
    checkoutData.shippingAddress
  );
  
  // Update cart totals
  cart.shipping = shipping.cost;
  cart.tax = tax.amount;
  cart.total = cart.subtotal - cart.discount + cart.tax + cart.shipping;
  
  // Process payment
  const paymentResult = await processPayment({
    workspaceId: checkoutData.workspaceId,
    organizationId: checkoutData.organizationId,
    amount: cart.total,
    currency: 'USD', // Default currency - clients can configure per-org in settings
    paymentMethod: checkoutData.paymentMethod,
    paymentToken: checkoutData.paymentToken,
    customer: checkoutData.customer,
  });
  
  if (!paymentResult.success) {
    throw new Error(`Payment failed: ${paymentResult.error}`);
  }
  
  // Create order
  const order = await createOrder(cart, checkoutData, shipping, tax, paymentResult);
  
  // Update inventory
  await updateInventory(checkoutData.workspaceId, checkoutData.organizationId, cart.items);
  
  // Clear cart
  await clearCart(checkoutData.cartId, checkoutData.workspaceId, checkoutData.organizationId);
  
  // Trigger workflows
  await triggerOrderWorkflows(checkoutData.workspaceId, checkoutData.organizationId, order);
  
  // Send confirmation email
  await sendOrderConfirmation(checkoutData.workspaceId, checkoutData.organizationId, order);
  
  return order;
}

/**
 * Validate cart before checkout
 */
async function validateCart(cart: Cart): Promise<void> {
  // Check if cart is empty
  if (cart.items.length === 0) {
    throw new Error('Cart is empty');
  }
  
  // Validate each item
  for (const item of cart.items) {
    // Check if product still exists
    const product = await getProduct(cart.workspaceId, cart.organizationId, item.productId);
    if (!product) {
      throw new Error(`Product ${item.productName} is no longer available`);
    }
    
    // Check inventory
    if (product.stockLevel !== undefined && product.stockLevel < item.quantity) {
      throw new Error(`Insufficient stock for ${item.productName}`);
    }
    
    // Check if price changed
    if (product.price !== item.price) {
      throw new Error(`Price for ${item.productName} has changed. Please refresh your cart.`);
    }
  }
}

/**
 * Create order
 */
async function createOrder(
  cart: Cart,
  checkoutData: CheckoutData,
  shipping: any,
  tax: any,
  paymentResult: any
): Promise<Order> {
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const orderNumber = generateOrderNumber(checkoutData.workspaceId);
  
  // Build order items
  const orderItems = cart.items.map(item => ({
    id: `oi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    variantId: item.variantId,
    variantOptions: item.variantOptions,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.subtotal,
    tax: (item.subtotal * tax.rate) / 100,
    discount: 0, // Item-level discounts
    total: item.subtotal + (item.subtotal * tax.rate) / 100,
    fulfillmentStatus: 'unfulfilled' as const,
    quantityFulfilled: 0,
    image: item.image,
    refunded: false,
  }));
  
  // Build payment info
  const payment: OrderPayment = {
    method: checkoutData.paymentMethod as any,
    provider: paymentResult.provider,
    transactionId: paymentResult.transactionId,
    status: 'captured',
    cardLast4: paymentResult.cardLast4,
    cardBrand: paymentResult.cardBrand,
    processedAt: Timestamp.now(),
    capturedAt: Timestamp.now(),
    amountCharged: cart.total,
    amountRefunded: 0,
    processingFee: paymentResult.processingFee,
  };
  
  // Build shipping info
  const orderShipping: OrderShipping = {
    method: shipping.methodName,
    methodId: shipping.methodId,
    carrier: shipping.carrier,
    service: shipping.service,
    cost: shipping.cost,
    estimatedDelivery: shipping.estimatedDelivery ? Timestamp.fromDate(new Date(shipping.estimatedDelivery)) : undefined,
  };
  
  // Create order
  const order: Order = {
    id: orderId,
    orderNumber,
    workspaceId: checkoutData.workspaceId,
    customerEmail: checkoutData.customer.email,
    customer: {
      firstName: checkoutData.customer.firstName,
      lastName: checkoutData.customer.lastName,
      email: checkoutData.customer.email,
      phone: checkoutData.customer.phone,
    },
    items: orderItems,
    billingAddress: checkoutData.billingAddress,
    shippingAddress: checkoutData.shippingAddress,
    subtotal: cart.subtotal,
    tax: cart.tax,
    shipping: cart.shipping,
    discount: cart.discount,
    total: cart.total,
    payment,
    shippingInfo: orderShipping,
    status: 'processing',
    fulfillmentStatus: 'unfulfilled',
    paymentStatus: 'captured',
    customerNotes: checkoutData.notes,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    source: 'web',
  };
  
  // Save order
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${checkoutData.organizationId}/workspaces/${checkoutData.workspaceId}/orders`,
    orderId,
    {
      ...order,
      createdAt: order.createdAt.toDate().toISOString(),
      updatedAt: order.updatedAt.toDate().toISOString(),
      items: order.items.map(item => ({
        ...item,
      })),
      payment: {
        ...order.payment,
        processedAt: order.payment.processedAt?.toDate().toISOString(),
        capturedAt: order.payment.capturedAt?.toDate().toISOString(),
      },
      shipping: {
        ...orderShipping,
        estimatedDelivery: orderShipping.estimatedDelivery?.toDate().toISOString(),
      },
    },
    false
  );
  
  // Create customer entity if configured
  await createCustomerEntity(checkoutData.workspaceId, checkoutData.organizationId, checkoutData.customer, order.id);
  
  // Create order entity if configured
  await createOrderEntity(checkoutData.workspaceId, checkoutData.organizationId, order);
  
  return order;
}

/**
 * Generate order number
 */
function generateOrderNumber(workspaceId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * Get product (helper)
 */
async function getProduct(workspaceId: string, organizationId: string, productId: string): Promise<any> {
  // Similar to cart-service implementation
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    throw new Error('E-commerce not configured');
  }
  
  const productSchema = (ecommerceConfig as any).productSchema;
  const product = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/${productSchema}/records`,
    productId
  );
  
  if (!product) {
    return null;
  }
  
  const mappings = (ecommerceConfig as any).productMappings;
  return {
    id: product.id,
    name: product[mappings.name],
    price: parseFloat(product[mappings.price] || 0),
    stockLevel: product[mappings.inventory],
  };
}

/**
 * Update inventory
 */
async function updateInventory(workspaceId: string, organizationId: string, items: any[]): Promise<void> {
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig || !(ecommerceConfig as any).inventory?.trackInventory) {
    return; // Inventory tracking disabled
  }
  
  const productSchema = (ecommerceConfig as any).productSchema;
  const inventoryField = (ecommerceConfig as any).inventory.inventoryField;
  
  for (const item of items) {
    const product = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/${productSchema}/records`,
      item.productId
    );
    
    if (product && product[inventoryField] !== undefined) {
      const newStock = Math.max(0, product[inventoryField] - item.quantity);
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/${productSchema}/records`,
        item.productId,
        {
          [inventoryField]: newStock,
        },
        true // Update only
      );
    }
  }
}

/**
 * Create customer entity
 */
async function createCustomerEntity(workspaceId: string, organizationId: string, customer: any, orderId: string): Promise<void> {
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig || !(ecommerceConfig as any).integration?.createCustomerEntity) {
    return;
  }
  
  const customerSchema = (ecommerceConfig as any).integration.customerSchema || 'contacts';
  
  // Check if customer already exists
  const { where } = await import('firebase/firestore');
  const existing = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/${customerSchema}/records`,
    [where('email', '==', customer.email)]
  );
  
  if (existing.length > 0) {
    return; // Customer already exists
  }
  
  // Create customer
  const customerId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/${customerSchema}/records`,
    customerId,
    {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      source: 'ecommerce',
      firstOrderId: orderId,
      createdAt: new Date().toISOString(),
    },
    false
  );
}

/**
 * Create order entity
 */
async function createOrderEntity(workspaceId: string, organizationId: string, order: Order): Promise<void> {
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig || !(ecommerceConfig as any).integration?.createOrderEntity) {
    return;
  }
  
  const orderSchema = (ecommerceConfig as any).integration.orderSchema || 'orders';
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/${orderSchema}/records`,
    order.id,
    {
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      total: order.total,
      status: order.status,
      createdAt: (order.createdAt as any).toDate?.()?.toISOString() || order.createdAt,
    },
    false
  );
}

/**
 * Trigger order workflows
 */
async function triggerOrderWorkflows(workspaceId: string, organizationId: string, order: Order): Promise<void> {
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig || !(ecommerceConfig as any).integration?.triggerWorkflows) {
    return;
  }
  
  // Trigger entity.created workflow for order
  const { handleEntityChange } = await import('@/lib/workflows/triggers/firestore-trigger');
  
  await handleEntityChange(
    organizationId,
    workspaceId,
    'orders', // Order schema
    'created',
    order.id,
    order
  );
}

/**
 * Send order confirmation email
 */
async function sendOrderConfirmation(workspaceId: string, organizationId: string, order: Order): Promise<void> {
  const ecommerceConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/ecommerce`,
    'config'
  );
  
  if (!ecommerceConfig) {
    return;
  }
  
  const notifications = (ecommerceConfig as any).notifications;
  if (!notifications?.customer?.orderConfirmation?.enabled) {
    return;
  }
  
  const template = notifications.customer.orderConfirmation;
  
  // Build email body with order details
  let body = template.body;
  body = body.replace(/\{\{orderNumber\}\}/g, order.orderNumber);
  body = body.replace(/\{\{total\}\}/g, `$${order.total.toFixed(2)}`);
  body = body.replace(/\{\{customerName\}\}/g, `${order.customer.firstName} ${order.customer.lastName}`);
  
  // Send email
  const { sendEmail } = await import('@/lib/email/email-service');
  await sendEmail({
    to: order.customerEmail,
    subject: template.subject,
    html: body,
    from: template.fromEmail,
    fromName: template.fromName,
  });
}


