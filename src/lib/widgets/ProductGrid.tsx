/**
 * Product Grid Widget Component
 * Displays multiple products in a grid layout
 */

'use client';

import React from 'react';
import { ProductCard } from './ProductCard';

export interface ProductGridProps {
  products: Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    currency?: string;
  }>;
  columns?: 2 | 3 | 4;
  onAddToCart?: (productId: string) => void;
  theme?: {
    primaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
}

export function ProductGrid({
  products,
  columns = 3,
  onAddToCart,
  theme,
}: ProductGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: '1.5rem',
        padding: '1rem',
      }}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
          theme={theme}
        />
      ))}

      {products.length === 0 && (
        <div
          style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '3rem',
            color: '#6b7280',
          }}
        >
          No products available
        </div>
      )}
    </div>
  );
}


















