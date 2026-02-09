/**
 * Stripe Card Input Component
 * Wraps Stripe Elements CardElement for easy credit card collection
 */

'use client';

import { CardElement } from '@stripe/react-stripe-js';
import type { StripeCardElementOptions } from '@stripe/stripe-js';

interface StripeCardInputProps {
  onReady?: () => void;
  disabled?: boolean;
}

const cardElementOptions: StripeCardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: 'var(--color-text-primary)',
      '::placeholder': {
        color: 'var(--color-text-secondary)',
      },
      backgroundColor: 'var(--color-bg-main)',
    },
    invalid: {
      color: 'var(--color-error)',
    },
  },
  hidePostalCode: false,
};

export default function StripeCardInput({ onReady, disabled }: StripeCardInputProps) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'var(--color-bg-main)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: '0.5rem',
      }}
    >
      <CardElement 
        options={cardElementOptions}
        onReady={onReady}
      />
      {disabled && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            cursor: 'not-allowed',
          }}
        />
      )}
    </div>
  );
}

