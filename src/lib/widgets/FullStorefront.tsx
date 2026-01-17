/**
 * Full Storefront Widget
 * Complete e-commerce store with categories, search, cart
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProductGrid } from './ProductGrid';
import { ShoppingCart } from './ShoppingCart'
import { logger } from '@/lib/logger/logger';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  currency?: string;
  category?: string;
}

export interface FullStorefrontProps {
  organizationId: string;
  theme?: {
    primaryColor?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
}

export function FullStorefront({ organizationId, theme }: FullStorefrontProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);

  const themePrimaryColor = theme?.primaryColor;
  const themeFontFamily = theme?.fontFamily;
  const primaryColor = (themePrimaryColor !== '' && themePrimaryColor != null) ? themePrimaryColor : '#6366f1';
  const fontFamily = (themeFontFamily !== '' && themeFontFamily != null) ? themeFontFamily : 'system-ui, sans-serif';

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch(`/api/ecommerce/products?orgId=${organizationId}`);
      const data = await response.json() as { success?: boolean; products?: Product[] };
      if (data.success && data.products) {
        setProducts(data.products);

        // Extract categories
        const cats = [...new Set(data.products.map((p: Product) => p.category).filter((c): c is string => Boolean(c)))] as string[];
        setCategories(cats);
      }
    } catch (error) {
      logger.error('Error loading products:', error, { file: 'FullStorefront.tsx' });
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const filterProducts = useCallback(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        [
          p.name?.toLowerCase().includes(query),
          p.description?.toLowerCase().includes(query)
        ].some(Boolean)
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    filterProducts();
  }, [filterProducts]);

  const handleAddToCart = async (productId: string) => {
    try {
      await fetch('/api/ecommerce/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      logger.info('Added to cart!', { file: 'FullStorefront.tsx' });
    } catch (error) {
      logger.error('Error adding to cart:', error, { file: 'FullStorefront.tsx' });
    }
  };

  return (
    <div style={{ fontFamily, backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
            Store
          </h1>
          
          <button
            onClick={() => setShowCart(!showCart)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            🛒 Cart
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Search and Filters */}
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            style={{
              flex: 1,
              minWidth: '300px',
              padding: '0.75rem 1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
          />

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '0.75rem 1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              minWidth: '200px',
            }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Products */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Loading products...
          </div>
        ) : (
          <ProductGrid
            products={filteredProducts}
            columns={3}
            onAddToCart={(productId: string) => { void handleAddToCart(productId); }}
            theme={theme}
          />
        )}
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '100%',
            maxWidth: '500px',
            height: '100vh',
            backgroundColor: '#fff',
            boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Shopping Cart</h2>
            <button
              onClick={() => setShowCart(false)}
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.5rem',
              }}
            >
              ×
            </button>
          </div>
          <ShoppingCart organizationId={organizationId} theme={theme} />
        </div>
      )}

      {/* Cart Overlay */}
      {showCart && (
        <div
          onClick={() => setShowCart(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          }}
        />
      )}
    </div>
  );
}

