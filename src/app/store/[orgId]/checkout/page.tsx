'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrCreateCart } from '@/lib/ecommerce/cart-service';
import { processCheckout } from '@/lib/ecommerce/checkout-service';
import { useTheme } from '@/contexts/ThemeContext'
import { logger } from '@/lib/logger/logger';;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const orgId = params.orgId as string;

  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
  });

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const sessionId = localStorage.getItem('cartSessionId');
      if (!sessionId) {
        router.push(`/store/${orgId}/cart`);
        return;
      }
      
      const cartData = await getOrCreateCart(sessionId, 'default');
      if (!cartData.items || cartData.items.length === 0) {
        router.push(`/store/${orgId}/cart`);
        return;
      }
      
      setCart(cartData);
    } catch (error) {
      logger.error('Error loading cart:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cart) return;
    
    try {
      setProcessing(true);
      
      const sessionId = localStorage.getItem('cartSessionId')!;
      const order = await processCheckout({
        sessionId,
        workspaceId: 'default',
        customerInfo: {
          name: formData.name,
          email: formData.email,
          address: {
            line1: formData.address,
            city: formData.city,
            state: formData.state,
            postal_code: formData.zip,
            country: formData.country,
          },
        },
        paymentMethod: {
          type: 'card',
          card: {
            number: formData.cardNumber,
            exp_month: parseInt(formData.cardExpiry.split('/')[0]),
            exp_year: parseInt('20' + formData.cardExpiry.split('/')[1]),
            cvc: formData.cardCvc,
          },
        },
      });
      
      // Clear cart and redirect to success
      localStorage.removeItem('cartSessionId');
      router.push(`/store/${orgId}/checkout/success?orderId=${order.id}`);
    } catch (error: any) {
      logger.error('Checkout error:', error, { file: 'page.tsx' });
      alert(error.message || 'Checkout failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !cart) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background.main, color: theme.colors.text.primary }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.colors.background.main, color: theme.colors.text.primary }}>
      <header style={{ borderBottom: `1px solid ${theme.colors.border.main}`, padding: '1.5rem 0', backgroundColor: theme.colors.background.paper }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Checkout</h1>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Checkout Form */}
          <div>
            <div style={{ backgroundColor: theme.colors.background.paper, border: `1px solid ${theme.colors.border.main}`, borderRadius: '0.75rem', padding: '2rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Contact Information</h2>
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required style={{ width: '100%', padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem', marginBottom: '1rem' }} />
              <input type="text" placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem' }} />
            </div>

            <div style={{ backgroundColor: theme.colors.background.paper, border: `1px solid ${theme.colors.border.main}`, borderRadius: '0.75rem', padding: '2rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Shipping Address</h2>
              <input type="text" placeholder="Address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} required style={{ width: '100%', padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem', marginBottom: '1rem' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <input type="text" placeholder="City" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} required style={{ padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem' }} />
                <input type="text" placeholder="State" value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} required style={{ padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem' }} />
              </div>
              <input type="text" placeholder="ZIP Code" value={formData.zip} onChange={(e) => setFormData({...formData, zip: e.target.value})} required style={{ width: '100%', padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem' }} />
            </div>

            <div style={{ backgroundColor: theme.colors.background.paper, border: `1px solid ${theme.colors.border.main}`, borderRadius: '0.75rem', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Payment Information</h2>
              <input type="text" placeholder="Card Number" value={formData.cardNumber} onChange={(e) => setFormData({...formData, cardNumber: e.target.value})} required style={{ width: '100%', padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem', marginBottom: '1rem' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <input type="text" placeholder="MM/YY" value={formData.cardExpiry} onChange={(e) => setFormData({...formData, cardExpiry: e.target.value})} required style={{ padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem' }} />
                <input type="text" placeholder="CVC" value={formData.cardCvc} onChange={(e) => setFormData({...formData, cardCvc: e.target.value})} required style={{ padding: '0.75rem', backgroundColor: theme.colors.background.elevated, color: theme.colors.text.primary, border: `1px solid ${theme.colors.border.light}`, borderRadius: '0.5rem' }} />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div style={{ backgroundColor: theme.colors.background.paper, border: `1px solid ${theme.colors.border.main}`, borderRadius: '0.75rem', padding: '1.5rem', position: 'sticky', top: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Order Summary</h2>
              {cart.items.map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: `1px solid ${theme.colors.border.main}` }}>
                  <div>
                    <div style={{ fontWeight: '500' }}>{item.productName}</div>
                    <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>Qty: {item.quantity}</div>
                  </div>
                  <div>${item.subtotal.toFixed(2)}</div>
                </div>
              ))}
              
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: theme.colors.text.secondary }}>
                  <span>Subtotal</span>
                  <span>${cart.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: theme.colors.text.secondary }}>
                  <span>Tax</span>
                  <span>${cart.tax.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: `1px solid ${theme.colors.border.light}`, color: theme.colors.text.secondary }}>
                  <span>Shipping</span>
                  <span>${cart.shipping.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                  <span>Total</span>
                  <span style={{ color: theme.colors.primary.main }}>${cart.total.toFixed(2)}</span>
                </div>
              </div>

              <button type="submit" disabled={processing} style={{ width: '100%', padding: '1rem', backgroundColor: theme.colors.primary.main, color: theme.colors.primary.contrast, border: 'none', borderRadius: '0.5rem', cursor: processing ? 'not-allowed' : 'pointer', fontSize: '1.125rem', fontWeight: '600', marginTop: '1.5rem' }}>
                {processing ? 'Processing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

