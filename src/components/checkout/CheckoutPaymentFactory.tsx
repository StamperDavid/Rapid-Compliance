'use client';

import dynamic from 'next/dynamic';
import { useTheme } from '@/contexts/ThemeContext';

// ─── Lazy-loaded provider forms (code-split per provider) ────────────────────

const StripeCheckoutForm = dynamic(
  () => import('@/components/checkout/StripeCheckoutForm'),
  { ssr: false },
);

const RedirectCheckoutForm = dynamic(
  () => import('@/components/checkout/RedirectCheckoutForm'),
  { ssr: false },
);

const PaddleCheckoutForm = dynamic(
  () => import('@/components/checkout/PaddleCheckoutForm'),
  { ssr: false },
);

const AdyenCheckoutForm = dynamic(
  () => import('@/components/checkout/AdyenCheckoutForm'),
  { ssr: false },
);

const ChargebeeCheckoutForm = dynamic(
  () => import('@/components/checkout/ChargebeeCheckoutForm'),
  { ssr: false },
);

const HyperswitchCheckoutForm = dynamic(
  () => import('@/components/checkout/HyperswitchCheckoutForm'),
  { ssr: false },
);

// ─── Types ───────────────────────────────────────────────────────────────────

import type { CheckoutCart, CheckoutFormData } from './checkout-types';

interface CheckoutPaymentFactoryProps {
  provider: string;
  cart: CheckoutCart;
  formData: CheckoutFormData;
  clientSecret?: string;
  redirectUrl?: string;
  sessionId?: string;
  onBack: () => void;
}

// ─── Redirect-based providers ────────────────────────────────────────────────

const REDIRECT_PROVIDERS = new Set(['paypal', 'mollie', '2checkout']);

// ─── Factory ─────────────────────────────────────────────────────────────────

export default function CheckoutPaymentFactory({
  provider,
  cart,
  formData,
  clientSecret,
  redirectUrl,
  sessionId,
  onBack,
}: CheckoutPaymentFactoryProps) {
  const { theme } = useTheme();

  // Stripe — client-side PaymentElement
  if (provider === 'stripe' && clientSecret) {
    return (
      <StripeCheckoutForm
        cart={cart}
        formData={formData}
        clientSecret={clientSecret}
        onBack={onBack}
      />
    );
  }

  // Adyen — Drop-in component
  if (provider === 'adyen') {
    return (
      <AdyenCheckoutForm
        cart={cart}
        formData={formData}
        sessionId={sessionId}
        clientSecret={clientSecret}
        onBack={onBack}
      />
    );
  }

  // Paddle — overlay checkout
  if (provider === 'paddle') {
    return (
      <PaddleCheckoutForm
        cart={cart}
        formData={formData}
        sessionId={sessionId}
        onBack={onBack}
      />
    );
  }

  // Hyperswitch — UnifiedCheckout (Stripe-compatible)
  if (provider === 'hyperswitch' && clientSecret) {
    return (
      <HyperswitchCheckoutForm
        cart={cart}
        formData={formData}
        clientSecret={clientSecret}
        sessionId={sessionId}
        onBack={onBack}
      />
    );
  }

  // Chargebee — hosted page modal (subscription billing only)
  if (provider === 'chargebee') {
    return (
      <ChargebeeCheckoutForm
        cart={cart}
        redirectUrl={redirectUrl}
        sessionId={sessionId}
        onBack={onBack}
      />
    );
  }

  // Redirect-based providers (PayPal, Mollie, 2Checkout)
  if (REDIRECT_PROVIDERS.has(provider) && redirectUrl) {
    return (
      <RedirectCheckoutForm
        provider={provider}
        redirectUrl={redirectUrl}
        onBack={onBack}
      />
    );
  }

  // Square — server-side payment, show confirmation
  if (provider === 'square') {
    return (
      <div
        style={{
          backgroundColor: theme.colors.background.paper,
          border: `1px solid ${theme.colors.border.main}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Payment via Square
        </h2>
        <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
          Your payment is being processed via Square. You will be redirected once confirmed.
        </p>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: 'transparent',
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.main}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  // Authorize.Net — server-side tokenization, similar pattern
  if (provider === 'authorizenet') {
    return (
      <div
        style={{
          backgroundColor: theme.colors.background.paper,
          border: `1px solid ${theme.colors.border.main}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Payment via Authorize.Net
        </h2>
        <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
          Your payment is being processed. You will be redirected once confirmed.
        </p>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: 'transparent',
            color: theme.colors.text.primary,
            border: `1px solid ${theme.colors.border.main}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  // Fallback — unsupported provider
  return (
    <div
      style={{
        backgroundColor: theme.colors.background.paper,
        border: `1px solid ${theme.colors.error.main}`,
        borderRadius: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: theme.colors.error.main }}>
        Payment Provider Not Available
      </h2>
      <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
        The payment provider &ldquo;{provider}&rdquo; is not yet configured for checkout.
        Please contact support or try a different payment method.
      </p>
      <button
        type="button"
        onClick={onBack}
        style={{
          padding: '0.75rem 2rem',
          backgroundColor: 'transparent',
          color: theme.colors.text.primary,
          border: `1px solid ${theme.colors.border.main}`,
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Back
      </button>
    </div>
  );
}
