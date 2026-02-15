'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { getOrCreateCart } from '@/lib/ecommerce/cart-service';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { auth } from '@/lib/firebase/config';
import StripeProvider from '@/components/StripeProvider';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

type CheckoutStep = 'info' | 'payment';

// ─── Payment Form (mounted inside StripeProvider) ─────────────────────────────

interface PaymentFormProps {
  cart: Cart;
  formData: {
    email: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  onBack: () => void;
}

function PaymentForm({ cart, formData, onBack }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { theme } = useTheme();
  const [processing, setProcessing] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    try {
      setProcessing(true);

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {
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
          },
          return_url: `${window.location.origin}/store/checkout/success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast.error(error.message ?? 'Payment failed. Please try again.');
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Complete the order server-side
        const token = await auth?.currentUser?.getIdToken();
        const completeRes = await fetch('/api/checkout/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            orderData: {
              customerEmail: formData.email,
              customerName: formData.name,
              shippingAddress: {
                address1: formData.address,
                city: formData.city,
                state: formData.state,
                zip: formData.zip,
                country: formData.country,
              },
            },
          }),
        });

        const completeData = await completeRes.json() as {
          success: boolean;
          orderId?: string;
          error?: string;
        };

        if (completeData.success && completeData.orderId) {
          localStorage.removeItem('cartSessionId');
          router.push(
            `/store/checkout/success?orderId=${completeData.orderId}&payment_intent=${paymentIntent.id}`
          );
        } else {
          // Payment succeeded but order creation failed — redirect anyway
          localStorage.removeItem('cartSessionId');
          router.push(
            `/store/checkout/success?payment_intent=${paymentIntent.id}&redirect_status=succeeded`
          );
        }
      }
    } catch (error) {
      logger.error('Payment error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'checkout/page.tsx',
      });
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div
        style={{
          backgroundColor: theme.colors.background.paper,
          border: `1px solid ${theme.colors.border.main}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
          Payment
        </h2>
        <PaymentElement
          onReady={() => setPaymentReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: 1,
            padding: '1rem',
            backgroundColor: 'transparent',
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.main}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={processing || !stripe || !paymentReady}
          style={{
            flex: 2,
            padding: '1rem',
            backgroundColor:
              processing || !stripe || !paymentReady
                ? theme.colors.border.strong
                : theme.colors.primary.main,
            color: theme.colors.primary.contrast,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: processing || !stripe || !paymentReady ? 'not-allowed' : 'pointer',
            fontSize: '1.125rem',
            fontWeight: '600',
          }}
        >
          {processing ? 'Processing...' : `Pay $${cart.total.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

// ─── Main Checkout Page ───────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('info');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });

  const loadCart = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem('cartSessionId');
      if (!sessionId) {
        router.push('/store/cart');
        return;
      }

      const cartData = await getOrCreateCart(sessionId, PLATFORM_ID);
      if (!cartData.items || cartData.items.length === 0) {
        router.push('/store/cart');
        return;
      }

      setCart(cartData as unknown as Cart);
    } catch (error) {
      logger.error(
        'Error loading cart:',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'checkout/page.tsx' }
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) {
      return;
    }

    try {
      setCreatingIntent(true);

      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/checkout/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: cart.total,
          currency: 'usd',
          metadata: {
            customerEmail: formData.email,
            customerName: formData.name,
          },
        }),
      });

      const data = await response.json() as {
        success: boolean;
        clientSecret?: string;
        error?: string;
      };

      if (data.success && data.clientSecret) {
        setClientSecret(data.clientSecret);
        setStep('payment');
      } else {
        toast.error(data.error ?? 'Failed to initialize payment. Please try again.');
      }
    } catch (error) {
      logger.error(
        'Payment intent creation error:',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'checkout/page.tsx' }
      );
      toast.error('Failed to initialize payment. Please try again.');
    } finally {
      setCreatingIntent(false);
    }
  };

  if (loading || !cart) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background.main,
          color: theme.colors.text.primary,
        }}
      >
        Loading...
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: theme.colors.background.elevated,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: '0.5rem',
    fontSize: '1rem',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.colors.background.main, color: theme.colors.text.primary }}>
      <header
        style={{
          borderBottom: `1px solid ${theme.colors.border.main}`,
          padding: '1.5rem 0',
          backgroundColor: theme.colors.background.paper,
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Checkout</h1>
          {/* Step indicator */}
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              marginTop: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: step === 'info' ? theme.colors.primary.main : theme.colors.text.secondary,
                fontWeight: step === 'info' ? '600' : '400',
              }}
            >
              <span
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  backgroundColor:
                    step === 'info' ? theme.colors.primary.main : theme.colors.border.light,
                  color:
                    step === 'info' ? theme.colors.primary.contrast : theme.colors.text.secondary,
                }}
              >
                1
              </span>
              Information
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color:
                  step === 'payment' ? theme.colors.primary.main : theme.colors.text.secondary,
                fontWeight: step === 'payment' ? '600' : '400',
              }}
            >
              <span
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  backgroundColor:
                    step === 'payment' ? theme.colors.primary.main : theme.colors.border.light,
                  color:
                    step === 'payment'
                      ? theme.colors.primary.contrast
                      : theme.colors.text.secondary,
                }}
              >
                2
              </span>
              Payment
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Left Column - Form */}
          <div>
            {step === 'info' && (
              <form onSubmit={(e) => void handleContinueToPayment(e)}>
                <div
                  style={{
                    backgroundColor: theme.colors.background.paper,
                    border: `1px solid ${theme.colors.border.main}`,
                    borderRadius: '0.75rem',
                    padding: '2rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                    Contact Information
                  </h2>
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    style={{ ...inputStyle, marginBottom: '1rem' }}
                  />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    backgroundColor: theme.colors.background.paper,
                    border: `1px solid ${theme.colors.border.main}`,
                    borderRadius: '0.75rem',
                    padding: '2rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                    Shipping Address
                  </h2>
                  <input
                    type="text"
                    placeholder="Address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    style={{ ...inputStyle, marginBottom: '1rem' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                      style={inputStyle}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="ZIP Code"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingIntent}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: creatingIntent
                      ? theme.colors.border.strong
                      : theme.colors.primary.main,
                    color: theme.colors.primary.contrast,
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: creatingIntent ? 'not-allowed' : 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                  }}
                >
                  {creatingIntent ? 'Preparing Payment...' : 'Continue to Payment'}
                </button>
              </form>
            )}

            {step === 'payment' && clientSecret && (
              <StripeProvider clientSecret={clientSecret}>
                <PaymentForm
                  cart={cart}
                  formData={formData}
                  onBack={() => setStep('info')}
                />
              </StripeProvider>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <div
              style={{
                backgroundColor: theme.colors.background.paper,
                border: `1px solid ${theme.colors.border.main}`,
                borderRadius: '0.75rem',
                padding: '1.5rem',
                position: 'sticky',
                top: '2rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                Order Summary
              </h2>
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: `1px solid ${theme.colors.border.main}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500' }}>{item.productName}</div>
                    <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                      Qty: {item.quantity}
                    </div>
                  </div>
                  <div>${item.subtotal.toFixed(2)}</div>
                </div>
              ))}

              <div style={{ marginTop: '1.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    color: theme.colors.text.secondary,
                  }}
                >
                  <span>Subtotal</span>
                  <span>${cart.subtotal.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    color: theme.colors.text.secondary,
                  }}
                >
                  <span>Tax</span>
                  <span>${cart.tax.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: `1px solid ${theme.colors.border.light}`,
                    color: theme.colors.text.secondary,
                  }}
                >
                  <span>Shipping</span>
                  <span>${cart.shipping.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                  }}
                >
                  <span>Total</span>
                  <span style={{ color: theme.colors.primary.main }}>
                    ${cart.total.toFixed(2)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '0.75rem',
                  backgroundColor: theme.colors.background.elevated,
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: theme.colors.text.secondary,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Payments are securely processed by Stripe
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
