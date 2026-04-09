'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';

import type { CheckoutCart } from './checkout-types';

interface ChargebeeCheckoutFormProps {
  cart: CheckoutCart;
  /** Chargebee hosted page URL from /api/checkout/initiate or subscription checkout */
  redirectUrl?: string;
  sessionId?: string;
  onBack: () => void;
}

// ─── Chargebee.js type definitions ───────────────────────────────────────────

interface ChargebeeCheckoutCallbacks {
  hostedPage: () => Promise<{ url: string }>;
  success: (hostedPageId: string) => void;
  close: () => void;
}

interface ChargebeeInstance {
  openCheckout: (callbacks: ChargebeeCheckoutCallbacks) => void;
  closeAll: () => void;
}

interface ChargebeeGlobal {
  init: (config: { site: string; isItemsModel?: boolean }) => ChargebeeInstance;
}

declare global {
  interface Window {
    Chargebee?: ChargebeeGlobal;
  }
}

export default function ChargebeeCheckoutForm({
  cart,
  redirectUrl,
  sessionId,
  onBack,
}: ChargebeeCheckoutFormProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [cbReady, setCbReady] = useState(false);

  const handleSuccess = useCallback((hostedPageId: string) => {
    localStorage.removeItem('cartSessionId');
    router.push(`/store/checkout/success?provider=chargebee&session_id=${hostedPageId}`);
  }, [router]);

  useEffect(() => {
    // Load Chargebee.js from CDN
    const script = document.createElement('script');
    script.src = 'https://js.chargebee.com/v2/chargebee.js';
    script.async = true;
    script.onload = () => {
      setLoading(false);
      setCbReady(true);
    };
    script.onerror = () => {
      setLoading(false);
      toast.error('Failed to load Chargebee. Please try again.');
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const openChargebeeCheckout = useCallback(() => {
    if (!window.Chargebee) {
      toast.error('Chargebee is not loaded yet.');
      return;
    }

    if (!redirectUrl) {
      toast.error('Checkout URL not available.');
      return;
    }

    try {
      const cbInstance = window.Chargebee.init({
        site: process.env.NEXT_PUBLIC_CHARGEBEE_SITE ?? '',
        isItemsModel: true,
      });

      cbInstance.openCheckout({
        hostedPage: () => Promise.resolve({ url: redirectUrl }),
        success: (hostedPageId: string) => {
          handleSuccess(hostedPageId);
        },
        close: () => {
          // User closed checkout modal without completing
        },
      });
    } catch (error) {
      logger.error('Chargebee checkout open error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'ChargebeeCheckoutForm.tsx',
      });
      toast.error('Failed to open Chargebee checkout.');
    }
  }, [redirectUrl, handleSuccess]);

  // If we have a redirectUrl but no Chargebee.js modal support, redirect directly
  const handleDirectRedirect = useCallback(() => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }, [redirectUrl]);

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
          Subscription Checkout
        </h2>

        <p style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
          Chargebee manages your subscription billing securely.
          {sessionId ? ` Session: ${sessionId.substring(0, 8)}...` : ''}
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
              Loading Chargebee...
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
          onClick={cbReady ? openChargebeeCheckout : handleDirectRedirect}
          disabled={!redirectUrl && !cbReady}
          style={{
            flex: 2,
            padding: '1rem',
            backgroundColor: (!redirectUrl && !cbReady)
              ? theme.colors.border.strong
              : theme.colors.primary.main,
            color: theme.colors.primary.contrast,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: (!redirectUrl && !cbReady) ? 'not-allowed' : 'pointer',
            fontSize: '1.125rem',
            fontWeight: '600',
          }}
        >
          {loading ? 'Loading...' : `Subscribe — $${cart.total.toFixed(2)}`}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
