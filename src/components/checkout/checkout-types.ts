/**
 * Shared types and helpers for checkout form components.
 * All forms that call /api/checkout/complete should use buildOrderData()
 * to produce a canonical order shape matching types/ecommerce.ts → Order.
 */

export interface CheckoutCartItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
  sku?: string;
  variantId?: string;
  image?: string;
}

export interface CheckoutCart {
  items: CheckoutCartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

export interface CheckoutFormData {
  email: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/**
 * Build the `orderData` payload for POST /api/checkout/complete.
 * Ensures every provider's complete call produces a canonical Order shape.
 */
export function buildOrderData(
  cart: CheckoutCart,
  formData: CheckoutFormData,
): Record<string, unknown> {
  const nameParts = formData.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const address = {
    firstName,
    lastName,
    address1: formData.address,
    city: formData.city,
    state: formData.state,
    zip: formData.zip,
    country: formData.country,
  };

  return {
    customerEmail: formData.email,
    customerFirstName: firstName,
    customerLastName: lastName,
    items: cart.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      variantId: item.variantId,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      image: item.image,
    })),
    subtotal: cart.subtotal,
    tax: cart.tax,
    shipping: cart.shipping,
    discount: cart.discount,
    total: cart.total,
    billingAddress: address,
    shippingAddress: address,
  };
}
