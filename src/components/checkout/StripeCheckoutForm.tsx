'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';
import { auth } from '@/lib/firebase/config';
import StripeProvider from '@/components/StripeProvider';
import { buildOrderData, type CheckoutCart, type CheckoutFormData } from './checkout-types';

interface StripeCheckoutFormProps {
  cart: CheckoutCart;
  formData: CheckoutFormData;
  clientSecret: string;
  onBack: () => void;
}

// ─── Inner form (mounted inside StripeProvider/Elements) ─────────────────────

interface InnerFormProps {
  cart: CheckoutCart;
  formData: CheckoutFormData;
  onBack: () => void;
}

function StripePaymentForm({ cart, formData, onBack }: InnerFormProps) {
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
        const token = await auth?.currentUser?.getIdToken();
        const completeRes = await fetch('/api/checkout/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            provider: 'stripe',
            paymentIntentId: paymentIntent.id,
            orderData: buildOrderData(cart, formData),
          }),
        });

        const completeData = (await completeRes.json()) as {
          success: boolean;
          orderId?: string;
          error?: string;
        };

        if (completeData.success && completeData.orderId) {
          localStorage.removeItem('cartSessionId');
          router.push(
            `/store/checkout/success?orderId=${completeData.orderId}&payment_intent=${paymentIntent.id}`,
          );
        } else {
          localStorage.removeItem('cartSessionId');
          router.push(
            `/store/checkout/success?payment_intent=${paymentIntent.id}&redirect_status=succeeded`,
          );
        }
      }
    } catch (error) {
      logger.error('Payment error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'StripeCheckoutForm.tsx',
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
          options={{ layout: 'tabs' }}
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

// ─── Wrapper that provides Stripe context ────────────────────────────────────

export default function StripeCheckoutForm({
  cart,
  formData,
  clientSecret,
  onBack,
}: StripeCheckoutFormProps) {
  return (
    <StripeProvider clientSecret={clientSecret}>
      <StripePaymentForm cart={cart} formData={formData} onBack={onBack} />
    </StripeProvider>
  );
}
