'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface RedirectCheckoutFormProps {
  provider: string;
  redirectUrl: string;
  onBack: () => void;
}

/** Human-readable display names for redirect-based providers */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  paypal: 'PayPal',
  mollie: 'Mollie',
  '2checkout': '2Checkout',
  paddle: 'Paddle',
};

export default function RedirectCheckoutForm({
  provider,
  redirectUrl,
  onBack,
}: RedirectCheckoutFormProps) {
  const { theme } = useTheme();
  const [redirecting, setRedirecting] = useState(false);
  const displayName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;

  useEffect(() => {
    // Auto-redirect after a short delay so the user sees the message
    const timer = setTimeout(() => {
      setRedirecting(true);
      window.location.href = redirectUrl;
    }, 1500);

    return () => clearTimeout(timer);
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
          Payment
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '2rem 0',
          }}
        >
          {/* Spinner */}
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              border: `3px solid ${theme.colors.border.light}`,
              borderTopColor: theme.colors.primary.main,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />

          <p style={{ fontSize: '1.125rem', color: theme.colors.text.primary }}>
            {redirecting
              ? `Redirecting to ${displayName}...`
              : `Preparing ${displayName} checkout...`}
          </p>

          <p style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>
            You will be redirected to {displayName} to complete your payment securely.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          disabled={redirecting}
          style={{
            flex: 1,
            padding: '1rem',
            backgroundColor: 'transparent',
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.main}`,
            borderRadius: '0.5rem',
            cursor: redirecting ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            opacity: redirecting ? 0.5 : 1,
          }}
        >
          Back
        </button>
        <a
          href={redirectUrl}
          style={{
            flex: 2,
            padding: '1rem',
            backgroundColor: theme.colors.primary.main,
            color: theme.colors.primary.contrast,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1.125rem',
            fontWeight: '600',
            textAlign: 'center',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Continue to {displayName}
        </a>
      </div>

      {/* CSS keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
