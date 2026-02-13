'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';

interface OrderItem {
  name?: string;
  productName?: string;
  quantity: number;
  price: number;
  subtotal?: number;
}

interface OrderData {
  id: string;
  status: string;
  amount?: number;
  currency?: string;
  customerEmail?: string;
  items?: OrderItem[];
  shippingAddress?: {
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  createdAt?: string;
}

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const orderId = searchParams.get('orderId');
  const paymentIntent = searchParams.get('payment_intent');
  const redirectStatus = searchParams.get('redirect_status');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(!!orderId);
  const [completingOrder, setCompletingOrder] = useState(false);

  // If we arrived via Stripe redirect (3DS) without an orderId, complete the order first
  useEffect(() => {
    const completeRedirectOrder = async () => {
      if (!orderId && paymentIntent && redirectStatus === 'succeeded') {
        setCompletingOrder(true);
        try {
          const token = await auth?.currentUser?.getIdToken();
          const res = await fetch('/api/checkout/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ paymentIntentId: paymentIntent }),
          });

          const data = await res.json() as { success: boolean; orderId?: string };
          if (data.success && data.orderId) {
            setOrder({ id: data.orderId, status: 'processing' });
          }
        } catch (error) {
          logger.error(
            'Failed to complete redirect order',
            error instanceof Error ? error : new Error(String(error)),
            { file: 'success/page.tsx' }
          );
        } finally {
          setCompletingOrder(false);
        }
      }
    };
    void completeRedirectOrder();
  }, [orderId, paymentIntent, redirectStatus]);

  // Fetch order details if we have an orderId
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        return;
      }
      try {
        const token = await auth?.currentUser?.getIdToken();
        const res = await fetch(`/api/ecommerce/orders/${orderId}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await res.json() as { success: boolean; order?: OrderData };
        if (data.success && data.order) {
          setOrder(data.order);
        }
      } catch (error) {
        logger.error(
          'Failed to fetch order',
          error instanceof Error ? error : new Error(String(error)),
          { file: 'success/page.tsx' }
        );
      } finally {
        setLoading(false);
      }
    };
    void fetchOrder();
  }, [orderId]);

  const formatAmount = (amount: number, currency?: string) => {
    const divisor = currency === 'usd' ? 100 : 1;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency ?? 'usd').toUpperCase(),
    }).format(amount / divisor);
  };

  const displayOrderId = order?.id ?? orderId;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.background.main,
        color: theme.colors.text.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '700px', padding: '2rem', width: '100%' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto' }}>
            <circle cx="12" cy="12" r="10" stroke={theme.colors.success.main} strokeWidth="2" />
            <path d="M8 12l2.5 2.5L16 9" stroke={theme.colors.success.main} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Order Confirmed!
        </h1>
        <p
          style={{
            fontSize: '1.125rem',
            color: theme.colors.text.secondary,
            marginBottom: '2rem',
          }}
        >
          Thank you for your purchase. Your order has been successfully placed.
        </p>

        {(loading || completingOrder) && (
          <div
            style={{
              padding: '1.5rem',
              color: theme.colors.text.secondary,
              marginBottom: '2rem',
            }}
          >
            Loading order details...
          </div>
        )}

        {displayOrderId && (
          <div
            style={{
              backgroundColor: theme.colors.background.paper,
              border: `1px solid ${theme.colors.border.main}`,
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '2rem',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: `1px solid ${theme.colors.border.light}`,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: theme.colors.text.secondary,
                    marginBottom: '0.25rem',
                  }}
                >
                  Order ID
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {displayOrderId}
                </div>
              </div>
              {order?.status && (
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: theme.colors.success.dark ?? 'rgba(76,175,80,0.15)',
                    color: theme.colors.success.main,
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                  }}
                >
                  {order.status}
                </span>
              )}
            </div>

            {order?.amount != null && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.75rem',
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                }}
              >
                <span>Total</span>
                <span style={{ color: theme.colors.primary.main }}>
                  {formatAmount(order.amount, order.currency)}
                </span>
              </div>
            )}

            {order?.items && order.items.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: theme.colors.text.secondary,
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                  }}
                >
                  Items
                </div>
                {order.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      fontSize: '0.875rem',
                      borderBottom:
                        i < (order.items?.length ?? 0) - 1
                          ? `1px solid ${theme.colors.border.light}`
                          : 'none',
                    }}
                  >
                    <span>
                      {item.productName ?? item.name} x{item.quantity}
                    </span>
                    <span style={{ color: theme.colors.text.secondary }}>
                      ${((item.subtotal ?? item.price * item.quantity) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {order?.customerEmail && (
              <div
                style={{
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: `1px solid ${theme.colors.border.light}`,
                  fontSize: '0.875rem',
                }}
              >
                <span style={{ color: theme.colors.text.secondary }}>Confirmation sent to: </span>
                <span>{order.customerEmail}</span>
              </div>
            )}
          </div>
        )}

        <p style={{ marginBottom: '2rem', color: theme.colors.text.secondary }}>
          You&apos;ll receive an email confirmation shortly with your order details.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/store/products')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: theme.colors.primary.main,
              color: theme.colors.primary.contrast,
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
