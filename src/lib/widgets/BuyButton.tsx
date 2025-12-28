/**
 * Buy Button Widget Component
 * Simple buy button that can be embedded anywhere
 */

'use client';

import React, { useState } from 'react'
import { logger } from '@/lib/logger/logger';;

export interface BuyButtonProps {
  productId: string;
  productName: string;
  price: number;
  currency?: string;
  buttonText?: string;
  onCheckout?: (productId: string) => void;
  theme?: {
    primaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
    size?: 'small' | 'medium' | 'large';
  };
}

export function BuyButton({
  productId,
  productName,
  price,
  currency = 'USD',
  buttonText = 'Buy Now',
  onCheckout,
  theme,
}: BuyButtonProps) {
  const [loading, setLoading] = useState(false);

  const primaryColor = theme?.primaryColor || '#6366f1';
  const borderRadius = theme?.borderRadius || '0.375rem';
  const fontFamily = theme?.fontFamily || 'system-ui, sans-serif';
  const size = theme?.size || 'medium';

  const sizes = {
    small: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
    medium: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
    large: { padding: '1rem 2rem', fontSize: '1.125rem' },
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount / 100);
  };

  const handleClick = async () => {
    setLoading(true);
    try {
      if (onCheckout) {
        await onCheckout(productId);
      } else {
        // Default behavior: Add to cart and redirect to checkout
        const response = await fetch('/api/ecommerce/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, quantity: 1 }),
        });

        if (response.ok) {
          window.location.href = '/checkout';
        }
      }
    } catch (error) {
      logger.error('Error processing purchase:', error, { file: 'BuyButton.tsx' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        ...sizes[size],
        backgroundColor: loading ? '#9ca3af' : primaryColor,
        color: '#fff',
        border: 'none',
        borderRadius,
        fontFamily,
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.opacity = '0.9';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      {loading ? (
        <>
          <span>Processing...</span>
          <svg
            style={{ animation: 'spin 1s linear infinite', width: '1rem', height: '1rem' }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              style={{ opacity: 0.25 }}
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              style={{ opacity: 0.75 }}
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </>
      ) : (
        <>
          <span>{buttonText}</span>
          <span>•</span>
          <span>{formatPrice(price)}</span>
        </>
      )}
    </button>
  );
}






















