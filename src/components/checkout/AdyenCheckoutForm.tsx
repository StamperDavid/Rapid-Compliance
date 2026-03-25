'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';
import { auth } from '@/lib/firebase/config';

interface CartShape {
  total: number;
}

interface FormDataShape {
  email: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface AdyenCheckoutFormProps {
  cart: CartShape;
  formData: FormDataShape;
  /** Adyen session ID from /api/checkout/initiate */
  sessionId?: string;
  /** Adyen sessionData for Drop-in initialization */
  clientSecret?: string;
  onBack: () => void;
}

/** Minimal type for the Adyen Drop-in mount/unmount lifecycle */
interface AdyenDropinHandle {
  unmount: () => void;
}

export default function AdyenCheckoutForm({
  cart,
  formData,
  sessionId,
  clientSecret,
  onBack,
}: AdyenCheckoutFormProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const dropinContainerRef = useRef<HTMLDivElement>(null);
  const dropinRef = useRef<AdyenDropinHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const handlePaymentComplete = useCallback(async (transactionRef: string) => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      const completeRes = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: 'adyen',
          paymentIntentId: transactionRef,
          orderData: {
            customerEmail: formData.email,
            customerName: formData.name,
          },
        }),
      });

      const data = (await completeRes.json()) as {
        success: boolean;
        orderId?: string;
      };

      if (data.success && data.orderId) {
        localStorage.removeItem('cartSessionId');
        router.push(`/store/checkout/success?orderId=${data.orderId}&provider=adyen`);
      } else {
        localStorage.removeItem('cartSessionId');
        router.push('/store/checkout/success?provider=adyen&redirect_status=succeeded');
      }
    } catch (error) {
      logger.error('Adyen completion error:', error instanceof Error ? error : new Error(String(error)), {
        file: 'AdyenCheckoutForm.tsx',
      });
      toast.error('Order processing failed. Please contact support.');
    }
  }, [formData, router]);

  useEffect(() => {
    if (!sessionId || !clientSecret || !dropinContainerRef.current || mounted) {
      return;
    }

    const initDropin = async () => {
      try {
        // Dynamically import Adyen Web SDK (v6 uses named exports)
        const adyenModule = await import('@adyen/adyen-web');

        // AdyenCheckout is the factory function
        const AdyenCheckoutFactory = adyenModule.AdyenCheckout;
        const DropinComponent = adyenModule.Dropin;

        const checkout = await AdyenCheckoutFactory({
          environment: 'test',
          clientKey: process.env.NEXT_PUBLIC_ADYEN_CLIENT_KEY ?? '',
          session: {
            id: sessionId,
            sessionData: clientSecret,
          },
          onPaymentCompleted: (result: { resultCode?: string }) => {
            if (result.resultCode === 'Authorised' || result.resultCode === 'Received') {
              void handlePaymentComplete(sessionId);
            } else {
              toast.error(`Payment ${result.resultCode ?? 'failed'}. Please try again.`);
            }
          },
          onError: (error: { message?: string }) => {
            logger.error('Adyen Drop-in error:', new Error(error.message ?? 'Unknown Adyen error'), {
              file: 'AdyenCheckoutForm.tsx',
            });
            toast.error('Payment error. Please try again.');
          },
        });

        if (dropinContainerRef.current) {
          const dropin = new DropinComponent(checkout);
          dropin.mount(dropinContainerRef.current);
          dropinRef.current = dropin as unknown as AdyenDropinHandle;
          setMounted(true);
        }
      } catch (error) {
        logger.error('Adyen Drop-in init error:', error instanceof Error ? error : new Error(String(error)), {
          file: 'AdyenCheckoutForm.tsx',
        });
        toast.error('Failed to load payment form. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void initDropin();

    return () => {
      if (dropinRef.current) {
        try {
          dropinRef.current.unmount();
        } catch {
          // Ignore unmount errors
        }
        dropinRef.current = null;
      }
    };
  }, [sessionId, clientSecret, mounted, handlePaymentComplete]);

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
              Loading payment methods...
            </p>
          </div>
        )}

        {/* Adyen Drop-in mounts here */}
        <div ref={dropinContainerRef} />
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
        <div
          style={{
            flex: 2,
            padding: '1rem',
            textAlign: 'center',
            fontSize: '1.125rem',
            fontWeight: '600',
            color: theme.colors.text.secondary,
          }}
        >
          Total: ${cart.total.toFixed(2)}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
