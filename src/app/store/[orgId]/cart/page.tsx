'use client';

/**
 * Shopping Cart Page
 * Customer-facing cart with quantity management
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getOrCreateCart, removeFromCart, updateCartItemQuantity } from '@/lib/ecommerce/cart-service';
import { useTheme } from '@/contexts/ThemeContext'
import { logger } from '@/lib/logger/logger';;

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export default function ShoppingCartPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const orgId = params.orgId as string;

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      const sessionId = localStorage.getItem('cartSessionId') ?? `session-${Date.now()}`;
      localStorage.setItem('cartSessionId', sessionId);

      const cartData = await getOrCreateCart(sessionId, 'default', orgId);
      setCart(cartData as unknown as Cart);
    } catch (error) {
      logger.error('Error loading cart:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1 || !cart) {return;}

    try {
      setUpdating(true);
      const sessionId = localStorage.getItem('cartSessionId');
      if (!sessionId) {
        toast.error('Session not found');
        return;
      }
      await updateCartItemQuantity(sessionId, 'default', orgId, itemId, newQuantity);
      await loadCart();
    } catch (error) {
      logger.error('Error updating quantity:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to update quantity');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!cart) {return;}

    try {
      setUpdating(true);
      const sessionId = localStorage.getItem('cartSessionId');
      if (!sessionId) {
        toast.error('Session not found');
        return;
      }
      await removeFromCart(sessionId, 'default', orgId, itemId);
      await loadCart();
    } catch (error) {
      logger.error('Error removing item:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to remove item');
    } finally {
      setUpdating(false);
    }
  };

  const handleCheckout = () => {
    router.push(`/store/${orgId}/checkout`);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: theme.colors.background.main,
        color: theme.colors.text.primary
      }}>
        <div>Loading cart...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: theme.colors.background.main,
      color: theme.colors.text.primary
    }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${theme.colors.border.main}`,
        padding: '1.5rem 0',
        backgroundColor: theme.colors.background.paper
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
              Shopping Cart
            </h1>
            <button
              onClick={() => router.push(`/store/${orgId}/products`)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: theme.colors.text.secondary,
                border: `1px solid ${theme.colors.border.light}`,
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {!cart || cart.items.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '4rem 0',
            color: theme.colors.text.secondary
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Your cart is empty</h2>
            <p style={{ marginBottom: '2rem' }}>Add some products to get started!</p>
            <button
              onClick={() => router.push(`/store/${orgId}/products`)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: theme.colors.primary.main,
                color: theme.colors.primary.contrast,
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500'
              }}
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
            {/* Cart Items */}
            <div>
              {cart.items.map(item => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: theme.colors.background.paper,
                    border: `1px solid ${theme.colors.border.main}`,
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    marginBottom: '1rem',
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr auto',
                    gap: '1.5rem',
                    alignItems: 'center'
                  }}
                >
                  {/* Product Image */}
                  <div style={{
                    width: '100px',
                    height: '100px',
                    backgroundColor: theme.colors.background.elevated,
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {item.image ? (
                      <Image src={item.image} alt={item.productName} fill style={{ objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '2rem' }}>📦</span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {item.productName}
                    </h3>
                    <p style={{ color: theme.colors.text.secondary, fontSize: '0.875rem', marginBottom: '1rem' }}>
                      ${item.price.toFixed(2)} each
                    </p>
                    
                    {/* Quantity Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => void handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={updating || item.quantity <= 1}
                        style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: theme.colors.background.elevated,
                          border: `1px solid ${theme.colors.border.light}`,
                          borderRadius: '0.25rem',
                          cursor: item.quantity > 1 && !updating ? 'pointer' : 'not-allowed',
                          opacity: item.quantity > 1 ? 1 : 0.5
                        }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: '40px', textAlign: 'center', fontWeight: '500' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => void handleQuantityChange(item.id, item.quantity + 1)}
                        disabled={updating}
                        style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: theme.colors.background.elevated,
                          border: `1px solid ${theme.colors.border.light}`,
                          borderRadius: '0.25rem',
                          cursor: updating ? 'not-allowed' : 'pointer'
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => void handleRemoveItem(item.id)}
                        disabled={updating}
                        style={{
                          marginLeft: '1rem',
                          padding: '0.5rem 1rem',
                          backgroundColor: 'transparent',
                          color: theme.colors.error.main,
                          border: 'none',
                          cursor: updating ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Item Total */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: theme.colors.primary.main }}>
                      ${item.subtotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div>
              <div style={{
                backgroundColor: theme.colors.background.paper,
                border: `1px solid ${theme.colors.border.main}`,
                borderRadius: '0.75rem',
                padding: '1.5rem',
                position: 'sticky',
                top: '2rem'
              }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Order Summary
                </h2>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ color: theme.colors.text.secondary }}>Subtotal</span>
                    <span>${cart.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ color: theme.colors.text.secondary }}>Tax</span>
                    <span>${cart.tax.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: theme.colors.text.secondary }}>Shipping</span>
                    <span>{cart.shipping > 0 ? `$${cart.shipping.toFixed(2)}` : 'Calculated at checkout'}</span>
                  </div>
                  
                  <div style={{ 
                    borderTop: `1px solid ${theme.colors.border.light}`, 
                    paddingTop: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.25rem',
                    fontWeight: 'bold'
                  }}>
                    <span>Total</span>
                    <span style={{ color: theme.colors.primary.main }}>
                      ${cart.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={updating}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: theme.colors.primary.main,
                    color: theme.colors.primary.contrast,
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    marginTop: '1rem'
                  }}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}




