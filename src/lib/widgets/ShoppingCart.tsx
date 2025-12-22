/**
 * Shopping Cart Widget Component
 * Embeddable shopping cart with items and checkout
 */

'use client';

import React, { useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  currency?: string;
}

export interface ShoppingCartProps {
  organizationId: string;
  onCheckout?: (items: CartItem[]) => void;
  theme?: {
    primaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
}

export function ShoppingCart({ organizationId, onCheckout, theme }: ShoppingCartProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const primaryColor = theme?.primaryColor || '#6366f1';
  const borderRadius = theme?.borderRadius || '0.5rem';
  const fontFamily = theme?.fontFamily || 'system-ui, sans-serif';

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const response = await fetch(`/api/ecommerce/cart?orgId=${organizationId}`);
      const data = await response.json();
      if (data.success) {
        setCart(data.cart.items || []);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      await removeItem(itemId);
      return;
    }

    try {
      const response = await fetch('/api/ecommerce/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity }),
      });

      if (response.ok) {
        await loadCart();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const response = await fetch('/api/ecommerce/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });

      if (response.ok) {
        await loadCart();
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const formatPrice = (price: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(price / 100);
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout(cart);
    } else {
      window.location.href = '/checkout';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily }}>
        Loading cart...
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          fontFamily,
          color: '#6b7280',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
        <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Your cart is empty
        </div>
        <div style={{ fontSize: '0.875rem' }}>Add some products to get started</div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius,
        fontFamily,
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      {/* Cart Items */}
      <div style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>
          Shopping Cart
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {cart.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
              }}
            >
              {/* Product Image */}
              {item.image && (
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    backgroundImage: `url(${item.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '0.375rem',
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Product Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {formatPrice(item.price, item.currency)}
                </div>
              </div>

              {/* Quantity Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#e5e7eb',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', minWidth: '2rem', textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#e5e7eb',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total and Checkout */}
      <div style={{ borderTop: '1px solid #e5e7eb', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>Total</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: primaryColor }}>
            {formatPrice(getTotal())}
          </span>
        </div>

        <button
          onClick={handleCheckout}
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}



















