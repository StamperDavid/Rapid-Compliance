/**
 * Checkout Flow Widget
 * Multi-step checkout with Stripe integration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js'
import { logger } from '@/lib/logger/logger';;

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export interface CheckoutFlowProps {
  organizationId: string;
  onComplete?: (orderId: string) => void;
  theme?: {
    primaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
}

export function CheckoutFlow({ organizationId, onComplete, theme }: CheckoutFlowProps) {
  const [step, setStep] = useState<'info' | 'payment' | 'complete'>('info');
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });

  const primaryColor = theme?.primaryColor || '#6366f1';
  const fontFamily = theme?.fontFamily || 'system-ui, sans-serif';

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    const response = await fetch(`/api/ecommerce/cart?orgId=${organizationId}`);
    const data = await response.json();
    if (data.success) {
      setCart(data.cart);
    }
  };

  const handleSubmitInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Create Stripe checkout session
      const response = await fetch('/api/ecommerce/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: organizationId,
          customerInfo,
        }),
      });

      const { sessionId } = await response.json();
      
      // Redirect to Stripe
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      logger.error('Payment error:', error, { file: 'CheckoutFlow.tsx' });
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const getTotal = () => {
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
  };

  if (step === 'complete') {
    return (
      <div style={{ fontFamily, maxWidth: '600px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Order Complete!
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          Thank you for your purchase. You'll receive a confirmation email shortly.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily, maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      {/* Progress Steps */}
      <div style={{ display: 'flex', marginBottom: '3rem', justifyContent: 'center', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: step === 'info' ? primaryColor : '#e5e7eb',
            color: step === 'info' ? '#fff' : '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
          }}>
            1
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Information</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: step === 'payment' ? primaryColor : '#e5e7eb',
            color: step === 'payment' ? '#fff' : '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
          }}>
            2
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Payment</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
        {/* Main Content */}
        <div>
          {step === 'info' && (
            <form onSubmit={handleSubmitInfo}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                Contact Information
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                  type="email"
                  required
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  placeholder="Email"
                  style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                />
                
                <input
                  type="text"
                  required
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  placeholder="Full Name"
                  style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                />
                
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  placeholder="Phone (optional)"
                  style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                />

                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '1rem' }}>
                  Shipping Address
                </h3>

                <input
                  type="text"
                  required
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  placeholder="Street Address"
                  style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <input
                    type="text"
                    required
                    value={customerInfo.city}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })}
                    placeholder="City"
                    style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  />
                  <input
                    type="text"
                    required
                    value={customerInfo.state}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, state: e.target.value })}
                    placeholder="State"
                    style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <input
                    type="text"
                    required
                    value={customerInfo.zip}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, zip: e.target.value })}
                    placeholder="ZIP Code"
                    style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  />
                  <input
                    type="text"
                    required
                    value={customerInfo.country}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, country: e.target.value })}
                    placeholder="Country"
                    style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: primaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Continue to Payment
                </button>
              </div>
            </form>
          )}

          {step === 'payment' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                Payment
              </h2>
              
              <div style={{ padding: '2rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                  You'll be redirected to Stripe to complete your payment securely.
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Your order will be processed after payment confirmation.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setStep('info')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    backgroundColor: '#e5e7eb',
                    color: '#111827',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: '1rem',
                    backgroundColor: loading ? '#9ca3af' : primaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Processing...' : `Pay ${formatPrice(getTotal())}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '0.5rem', position: 'sticky', top: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Order Summary
            </h3>

            {cart && cart.items && cart.items.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <span>{item.name} × {item.quantity}</span>
                <span style={{ fontWeight: '600' }}>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <span>Total</span>
                <span style={{ color: primaryColor }}>{formatPrice(getTotal())}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



















