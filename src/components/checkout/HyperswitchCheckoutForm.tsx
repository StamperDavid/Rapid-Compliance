'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';
import { auth } from '@/lib/firebase/config';
import { buildOrderData, type CheckoutCart, type CheckoutFormData } from './checkout-types';

interface HyperswitchCheckoutFormProps {
  cart: CheckoutCart;
  formData: CheckoutFormData;
  /** Hyperswitch client_secret for UnifiedCheckout */
  clientSecret?: string;
  sessionId?: string;
  onBack: () => void;
}

export default function HyperswitchCheckoutForm({
  cart,
  formData,
  clientSecret,
  sessionId,
  onBack,
}: HyperswitchCheckoutFormProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const handlePaymentComplete = useCallback(async (paymentId: string) => {
    try {
      setProcessing(true);
      const token = await auth?.currentUser?.getIdToken();
      const completeRes = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: 'hyperswitch',
          paymentIntentId: paymentId,
          orderData: buildOrderData(cart, formData),
        }),
      });

      const data = (await completeRes.json()) as {
        success: boolean;
        orderId?: string;
      };

      if (data.success && data.orderId) {
        localStorage.removeItem('cartSessionId');
        router.push(`/store/checkout/success?orderId=${data.orderId}&provider=hyperswitch`);
      } else {
        localStorage.removeItem('cartSessionId');
        router.push('/store/checkout/success?provider=hyperswitch&redirect_status=succeeded');
      }
    } catch (error) {
      logger.error('Hyperswitch completion error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'HyperswitchCheckoutForm.tsx',
      });
      toast.error('Order processing failed. Please contact support.');
    } finally {
      setProcessing(false);
    }
  }, [cart, formData, router]);

  useEffect(() => {
    // Load Hyperswitch SDK from CDN
    const script = document.createElement('script');
    script.src = 'https://beta.hyperswitch.io/v1/HyperLoader.js';
    script.async = true;
    script.onload = () => {
      setLoading(false);
      setSdkReady(true);
    };
    script.onerror = () => {
      setLoading(false);
      toast.error('Failed to load Hyperswitch checkout.');
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const handleConfirmPayment = useCallback(async () => {
    if (!clientSecret || !sdkReady) {
      return;
    }

    try {
      setProcessing(true);

      // Use the Hyperswitch global to confirm
      const hyper = (window as unknown as Record<string, unknown>).Hyper as
        | { confirmPayment?: (opts: { clientSecret: string; confirmParams: { return_url: string } }) => Promise<{ error?: { message?: string }; status?: string }> }
        | undefined;

      if (!hyper?.confirmPayment) {
        // Fallback — redirect to success page and let the server verify
        if (sessionId) {
          void handlePaymentComplete(sessionId);
        }
        return;
      }

      const result = await hyper.confirmPayment({
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/store/checkout/success?provider=hyperswitch`,
        },
      });

      if (result.error) {
        toast.error(result.error.message ?? 'Payment failed. Please try again.');
        setProcessing(false);
      } else if (result.status === 'succeeded' || result.status === 'processing') {
        if (sessionId) {
          void handlePaymentComplete(sessionId);
        }
      }
    } catch (error) {
      logger.error('Hyperswitch confirm error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'HyperswitchCheckoutForm.tsx',
      });
      toast.error('Payment error. Please try again.');
      setProcessing(false);
    }
  }, [clientSecret, sdkReady, sessionId, handlePaymentComplete]);

  return (
    <div>
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

        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                margin: '0 auto',
                border: `3px solid ${theme.colors.border.light}`,
                borderTopColor: theme.colors.primary.main,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
              Loading payment options...
            </p>
          </div>
        )}

        {!loading && sdkReady && (
          <div style={{ padding: '1rem 0' }}>
            <p style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '1rem' }}>
              Your payment will be securely routed through the best available processor.
            </p>
            {/* Hyperswitch UnifiedCheckout renders embedded form here when SDK is fully integrated */}
            <div id="hyperswitch-unified-checkout" />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          style={{
            flex: 1,
            padding: '1rem',
            backgroundColor: 'transparent',
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.main}`,
            borderRadius: '0.5rem',
            cursor: processing ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            opacity: processing ? 0.5 : 1,
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void handleConfirmPayment()}
          disabled={processing || !sdkReady || !clientSecret}
          style={{
            flex: 2,
            padding: '1rem',
            backgroundColor:
              processing || !sdkReady || !clientSecret
                ? theme.colors.border.strong
                : theme.colors.primary.main,
            color: theme.colors.primary.contrast,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: processing || !sdkReady || !clientSecret ? 'not-allowed' : 'pointer',
            fontSize: '1.125rem',
            fontWeight: '600',
          }}
        >
          {processing ? 'Processing...' : `Pay $${cart.total.toFixed(2)}`}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
