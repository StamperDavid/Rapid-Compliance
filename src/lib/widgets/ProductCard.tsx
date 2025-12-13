/**
 * Product Card Widget Component
 * Embeddable product display card
 */

'use client';

import React from 'react';

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    currency?: string;
  };
  onAddToCart?: (productId: string) => void;
  theme?: {
    primaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
}

export function ProductCard({ product, onAddToCart, theme }: ProductCardProps) {
  const primaryColor = theme?.primaryColor || '#6366f1';
  const borderRadius = theme?.borderRadius || '0.5rem';
  const fontFamily = theme?.fontFamily || 'system-ui, sans-serif';

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currency || 'USD',
    }).format(price / 100);
  };

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius,
        overflow: 'hidden',
        fontFamily,
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Product Image */}
      {product.image && (
        <div
          style={{
            width: '100%',
            height: '200px',
            backgroundImage: `url(${product.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Product Info */}
      <div style={{ padding: '1rem' }}>
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '0.5rem',
            lineHeight: '1.4',
          }}
        >
          {product.name}
        </h3>

        {product.description && (
          <p
            style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1rem',
              lineHeight: '1.5',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {product.description}
          </p>
        )}

        {/* Price and Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#111827',
            }}
          >
            {formatPrice(product.price)}
          </span>

          <button
            onClick={() => onAddToCart?.(product.id)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}














