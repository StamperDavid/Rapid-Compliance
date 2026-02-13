'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

export default function CheckoutCancelledPage() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.colors.background.main,
      color: theme.colors.text.primary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '600px', padding: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto' }}>
            <circle cx="12" cy="12" r="10" stroke={theme.colors.warning.main} strokeWidth="2" />
            <path d="M12 8v4" stroke={theme.colors.warning.main} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill={theme.colors.warning.main} />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Payment Cancelled
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: theme.colors.text.secondary,
          marginBottom: '0.5rem',
        }}>
          Your payment was not completed, but don&apos;t worry.
        </p>
        <p style={{
          fontSize: '1rem',
          color: theme.colors.text.secondary,
          marginBottom: '2rem',
        }}>
          Your cart items are still saved and ready when you are.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/store/checkout')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: theme.colors.primary.main,
              color: theme.colors.primary.contrast,
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => router.push('/store/cart')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border.main}`,
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            Return to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
