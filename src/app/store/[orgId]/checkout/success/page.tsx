'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

export default function OrderSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  const orgId = params.orgId as string;
  const orderId = searchParams.get('orderId');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.colors.background.main, color: theme.colors.text.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: '600px', padding: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Order Confirmed!</h1>
        <p style={{ fontSize: '1.125rem', color: theme.colors.text.secondary, marginBottom: '2rem' }}>
          Thank you for your purchase. Your order has been successfully placed.
        </p>
        {orderId && (
          <div style={{ backgroundColor: theme.colors.background.paper, border: `1px solid ${theme.colors.border.main}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.875rem', color: theme.colors.text.secondary, marginBottom: '0.25rem' }}>Order ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{orderId}</div>
          </div>
        )}
        <p style={{ marginBottom: '2rem', color: theme.colors.text.secondary }}>
          You&apos;ll receive an email confirmation shortly with your order details.
        </p>
        <button onClick={() => router.push(`/store/${orgId}/products`)} style={{ padding: '0.75rem 1.5rem', backgroundColor: theme.colors.primary.main, color: theme.colors.primary.contrast, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '500' }}>
          Continue Shopping
        </button>
      </div>
    </div>
  );
}




