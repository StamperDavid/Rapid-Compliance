'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getOrCreateCart } from '@/lib/ecommerce/cart-service';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { auth } from '@/lib/firebase/config';
import CheckoutPaymentFactory from '@/components/checkout/CheckoutPaymentFactory';

interface CartItem {
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

interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

type CheckoutStep = 'info' | 'payment';

/** Response shape from /api/checkout/initiate */
interface InitiateResponse {
  success: boolean;
  provider?: string;
  clientSecret?: string;
  redirectUrl?: string;
  sessionId?: string;
  error?: string;
}

// ─── Main Checkout Page ───────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('info');
  const [creatingIntent, setCreatingIntent] = useState(false);

  // Provider-agnostic payment state
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });

  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);

  const loadCart = useCallback(async () => {
    try {
      const cartSessionId = localStorage.getItem('cartSessionId');
      if (!cartSessionId) {
        router.push('/store/cart');
        return;
      }

      const cartData = await getOrCreateCart(cartSessionId, PLATFORM_ID);
      if (!cartData.items || cartData.items.length === 0) {
        router.push('/store/cart');
        return;
      }

      setCart(cartData as unknown as Cart);
    } catch (error) {
      logger.error(
        'Error loading cart:',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'checkout/page.tsx' },
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      return;
    }
    try {
      setApplyingDiscount(true);
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch('/api/ecommerce/cart/discount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: discountCode.trim() }),
      });
      const data = (await res.json()) as { success: boolean; cart?: Cart; error?: string };
      if (data.success && data.cart) {
        setCart(data.cart);
        setAppliedCodes((prev) => [...prev, discountCode.trim().toUpperCase()]);
        setDiscountCode('');
        toast.success('Discount applied!');
      } else {
        toast.error(data.error ?? 'Invalid discount code');
      }
    } catch {
      toast.error('Failed to apply discount code');
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = async (code: string) => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch(`/api/ecommerce/cart/discount?code=${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = (await res.json()) as { success: boolean; cart?: Cart; error?: string };
      if (data.success && data.cart) {
        setCart(data.cart);
        setAppliedCodes((prev) => prev.filter((c) => c !== code));
        toast.success('Discount removed');
      }
    } catch {
      toast.error('Failed to remove discount');
    }
  };

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) {
      return;
    }

    try {
      setCreatingIntent(true);

      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/checkout/initiate', {
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

      const data = (await response.json()) as InitiateResponse;

      if (data.success && data.provider) {
        setPaymentProvider(data.provider);
        setClientSecret(data.clientSecret ?? null);
        setRedirectUrl(data.redirectUrl ?? null);
        setSessionId(data.sessionId ?? null);
        setStep('payment');
      } else {
        toast.error(data.error ?? 'Failed to initialize payment. Please try again.');
      }
    } catch (error) {
      logger.error(
        'Checkout initiation error:',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'checkout/page.tsx' },
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

            {step === 'payment' && paymentProvider && (
              <CheckoutPaymentFactory
                provider={paymentProvider}
                cart={cart}
                formData={formData}
                clientSecret={clientSecret ?? undefined}
                redirectUrl={redirectUrl ?? undefined}
                sessionId={sessionId ?? undefined}
                onBack={() => setStep('info')}
              />
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
                    marginBottom: '0.5rem',
                    color: theme.colors.text.secondary,
                  }}
                >
                  <span>Shipping</span>
                  <span>${cart.shipping.toFixed(2)}</span>
                </div>
                {cart.discount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      color: theme.colors.success?.main ?? '#22c55e',
                    }}
                  >
                    <span>Discount</span>
                    <span>-${cart.discount.toFixed(2)}</span>
                  </div>
                )}

                {/* Applied discount codes */}
                {appliedCodes.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    {appliedCodes.map((code) => (
                      <div
                        key={code}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.125rem 0.5rem',
                          backgroundColor: theme.colors.background.elevated,
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          color: theme.colors.text.secondary,
                          marginRight: '0.25rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {code}
                        <button
                          type="button"
                          onClick={() => void handleRemoveDiscount(code)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: theme.colors.text.secondary,
                            fontSize: '0.875rem',
                            lineHeight: 1,
                            padding: '0 0.125rem',
                          }}
                          aria-label={`Remove discount ${code}`}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Discount code input */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: `1px solid ${theme.colors.border.light}`,
                  }}
                >
                  <input
                    type="text"
                    placeholder="Discount code"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleApplyDiscount(); } }}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      backgroundColor: theme.colors.background.elevated,
                      color: theme.colors.text.primary,
                      border: `1px solid ${theme.colors.border.light}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleApplyDiscount()}
                    disabled={applyingDiscount || !discountCode.trim()}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'transparent',
                      color: theme.colors.primary.main,
                      border: `1px solid ${theme.colors.primary.main}`,
                      borderRadius: '0.375rem',
                      cursor: applyingDiscount || !discountCode.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      opacity: applyingDiscount || !discountCode.trim() ? 0.5 : 1,
                    }}
                  >
                    {applyingDiscount ? '...' : 'Apply'}
                  </button>
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
                Payments are securely processed
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
