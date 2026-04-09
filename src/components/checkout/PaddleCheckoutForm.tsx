'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';
import { auth } from '@/lib/firebase/config';
import { buildOrderData, type CheckoutCart, type CheckoutFormData } from './checkout-types';

interface PaddleCheckoutFormProps {
  cart: CheckoutCart;
  formData: CheckoutFormData;
  sessionId?: string;
  onBack: () => void;
}

// ─── Paddle.js types ─────────────────────────────────────────────────────────

interface PaddleCheckoutSettings {
  displayMode?: 'overlay' | 'inline';
  frameTarget?: string;
  frameInitialHeight?: number;
  successUrl?: string;
}

interface PaddleCheckoutOpenParams {
  transactionId?: string;
  settings?: PaddleCheckoutSettings;
  customer?: {
    email?: string;
  };
}

interface PaddleEventData {
  transaction_id?: string;
  status?: string;
}

interface PaddleInstance {
  Checkout: {
    open: (params: PaddleCheckoutOpenParams) => void;
  };
  Environment: {
    set: (env: 'sandbox' | 'production') => void;
  };
}

interface PaddleInitOptions {
  token: string;
  eventCallback?: (event: { name: string; data?: PaddleEventData }) => void;
}

interface PaddleGlobal {
  Initialize: (options: PaddleInitOptions) => PaddleInstance;
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PaddleCheckoutForm({
  cart,
  formData,
  sessionId,
  onBack,
}: PaddleCheckoutFormProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [paddleReady, setPaddleReady] = useState(false);

  const handleCheckoutComplete = useCallback(async (transactionId: string) => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      const completeRes = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: 'paddle',
          paymentIntentId: transactionId,
          orderData: buildOrderData(cart, formData),
        }),
      });

      const data = (await completeRes.json()) as {
        success: boolean;
        orderId?: string;
      };

      if (data.success && data.orderId) {
        localStorage.removeItem('cartSessionId');
        router.push(`/store/checkout/success?orderId=${data.orderId}&provider=paddle`);
      } else {
        localStorage.removeItem('cartSessionId');
        router.push('/store/checkout/success?provider=paddle&redirect_status=succeeded');
      }
    } catch (error) {
      logger.error('Paddle completion error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'PaddleCheckoutForm.tsx',
      });
      toast.error('Order processing failed. Please contact support.');
    }
  }, [cart, formData, router]);

  useEffect(() => {
    // Load Paddle.js from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => {
      setLoading(false);
      setPaddleReady(true);
    };
    script.onerror = () => {
      setLoading(false);
      toast.error('Failed to load Paddle checkout. Please try again.');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const openPaddleCheckout = useCallback(() => {
    if (!window.Paddle) {
      toast.error('Paddle is not loaded yet. Please wait.');
      return;
    }

    try {
      const paddle = window.Paddle.Initialize({
        token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '',
        eventCallback: (event) => {
          if (event.name === 'checkout.completed' && event.data?.transaction_id) {
            void handleCheckoutComplete(event.data.transaction_id);
          }
          if (event.name === 'checkout.closed') {
            // User closed the overlay without completing
          }
        },
      });

      paddle.Checkout.open({
        ...(sessionId ? { transactionId: sessionId } : {}),
        settings: {
          displayMode: 'overlay',
          successUrl: `${window.location.origin}/store/checkout/success?provider=paddle`,
        },
        customer: {
          email: formData.email,
        },
      });
    } catch (error) {
      logger.error('Paddle checkout open error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'PaddleCheckoutForm.tsx',
      });
      toast.error('Failed to open Paddle checkout.');
    }
  }, [sessionId, formData.email, handleCheckoutComplete]);

  return (
    <div>
      <div
        style={{
          backgroundColor: theme.colors.background.paper,
          border: `1px solid ${theme.colors.border.main}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Payment via Paddle
        </h2>

        <p style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
          Paddle handles all payment processing, taxes, and invoicing securely.
        </p>

        {loading && (
          <div style={{ padding: '2rem 0' }}>
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
              Loading Paddle...
            </p>
          </div>
        )}
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
          type="button"
          onClick={openPaddleCheckout}
          disabled={!paddleReady}
          style={{
            flex: 2,
            padding: '1rem',
            backgroundColor: !paddleReady
              ? theme.colors.border.strong
              : theme.colors.primary.main,
            color: theme.colors.primary.contrast,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: !paddleReady ? 'not-allowed' : 'pointer',
            fontSize: '1.125rem',
            fontWeight: '600',
          }}
        >
          {loading ? 'Loading...' : `Pay $${cart.total.toFixed(2)} with Paddle`}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
