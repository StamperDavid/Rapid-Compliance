'use client';

import { useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { useTheme } from '@/contexts/ThemeContext';

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export default function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  const { theme } = useTheme();

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

  if (!stripePromise) {
    return (
      <div style={{
        padding: '1.5rem',
        backgroundColor: theme.colors.error.dark,
        border: `1px solid ${theme.colors.error.main}`,
        borderRadius: '0.75rem',
        color: theme.colors.error.light ?? theme.colors.text.primary,
        fontSize: '0.875rem',
      }}>
        Stripe is not configured. Please add your publishable key to environment variables.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
