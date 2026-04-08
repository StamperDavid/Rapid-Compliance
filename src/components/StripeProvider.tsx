'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { useTheme } from '@/contexts/ThemeContext';
import { auth } from '@/lib/firebase/config';

/**
 * Module-level cache for the Stripe instance.
 * loadStripe() should only be called once per publishable key.
 */
let cachedStripePromise: Promise<Stripe | null> | null = null;
let cachedPublishableKey: string | null = null;

function getStripePromise(publishableKey: string): Promise<Stripe | null> {
  if (cachedStripePromise && cachedPublishableKey === publishableKey) {
    return cachedStripePromise;
  }
  cachedPublishableKey = publishableKey;
  cachedStripePromise = loadStripe(publishableKey);
  return cachedStripePromise;
}

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export default function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  const { theme } = useTheme();
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) {return;}
    fetchedRef.current = true;

    async function fetchKey() {
      try {
        const token = await auth?.currentUser?.getIdToken();
        const res = await fetch('/api/checkout/provider-config', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          setError('Failed to load payment configuration.');
          return;
        }

        const data = (await res.json()) as { success: boolean; clientKey?: string };
        if (data.success && data.clientKey) {
          setPublishableKey(data.clientKey);
        } else {
          setError('Stripe is not configured. Please add your Stripe publishable key in Settings > API Keys.');
        }
      } catch {
        setError('Failed to load payment configuration.');
      }
    }

    void fetchKey();
  }, []);

  const stripePromise = useMemo(
    () => (publishableKey ? getStripePromise(publishableKey) : null),
    [publishableKey],
  );

  const options: StripeElementsOptions = useMemo(() => ({
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: theme.colors.primary.main,
        colorBackground: theme.colors.background.elevated,
        colorText: theme.colors.text.primary,
        colorTextSecondary: theme.colors.text.secondary,
        colorDanger: theme.colors.error.main,
        borderRadius: '0.5rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: `1px solid ${theme.colors.border.light}`,
          backgroundColor: theme.colors.background.elevated,
          color: theme.colors.text.primary,
          padding: '0.75rem',
        },
        '.Input:focus': {
          border: `1px solid ${theme.colors.primary.main}`,
          boxShadow: `0 0 0 1px ${theme.colors.primary.main}`,
        },
        '.Label': {
          color: theme.colors.text.secondary,
          fontSize: '0.875rem',
          fontWeight: '500',
        },
        '.Tab': {
          border: `1px solid ${theme.colors.border.light}`,
          backgroundColor: theme.colors.background.paper,
        },
        '.Tab--selected': {
          border: `1px solid ${theme.colors.primary.main}`,
          backgroundColor: theme.colors.background.elevated,
        },
      },
    },
  }), [clientSecret, theme]);

  if (error) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: theme.colors.error.dark,
        border: `1px solid ${theme.colors.error.main}`,
        borderRadius: '0.75rem',
        color: theme.colors.error.light ?? theme.colors.text.primary,
        fontSize: '0.875rem',
      }}>
        {error}
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: theme.colors.background.paper,
        border: `1px solid ${theme.colors.border.main}`,
        borderRadius: '0.75rem',
        color: theme.colors.text.secondary,
        fontSize: '0.875rem',
        textAlign: 'center',
      }}>
        Loading payment form...
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
