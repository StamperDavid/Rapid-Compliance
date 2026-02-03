'use client';

/**
 * Public Product Catalog
 * Customer-facing product listing page with organization branding
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FirestoreService } from '@/lib/db/firestore-service';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  inStock: boolean;
  sku: string;
}

export default function ProductCatalogPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const orgId = DEFAULT_ORG_ID;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);

      // Load products from Firestore (org-level collection)
      const productsData = await FirestoreService.getAll(
        `organizations/${orgId}/products`,
        []
      );

      setProducts(productsData as Product[]);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(
          (productsData as Product[])
            .map((p) => p.category)
            .filter((cat): cat is string => Boolean(cat))
        )
      );
      setCategories(uniqueCategories);
    } catch (error) {
      logger.error('Error loading products:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesCategory && matchesSearch;
  });

  const handleProductClick = (productId: string) => {
    router.push(`/store/products/${productId}`);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background.main,
        color: theme.colors.text.primary
      }}>
        <div>Loading products...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.colors.background.main,
      color: theme.colors.text.primary
    }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${theme.colors.border.main}`,
        padding: '1.5rem 0',
        backgroundColor: theme.colors.background.paper
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {theme.branding.logoUrl && (
                <div style={{ position: 'relative', height: '40px', width: '120px' }}>
                  <Image
                    src={theme.branding.logoUrl}
                    alt={theme.branding.companyName}
                    fill
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                {theme.branding.companyName}
              </h1>
            </div>
            <button
              onClick={() => router.push('/store/cart')}
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: theme.colors.primary.main,
                color: theme.colors.primary.contrast,
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🛒 Cart
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Search and Filters */}
        <div style={{ marginBottom: '2rem' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: theme.colors.background.paper,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.border.light}`,
              borderRadius: '0.5rem',
              fontSize: '1rem',
              marginBottom: '1rem'
            }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: selectedCategory === 'all' ? theme.colors.primary.main : theme.colors.background.paper,
                color: selectedCategory === 'all' ? theme.colors.primary.contrast : theme.colors.text.primary,
                border: `1px solid ${theme.colors.border.light}`,
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              All Products
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: selectedCategory === category ? theme.colors.primary.main : theme.colors.background.paper,
                  color: selectedCategory === category ? theme.colors.primary.contrast : theme.colors.text.primary,
                  border: `1px solid ${theme.colors.border.light}`,
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 0',
            color: theme.colors.text.secondary
          }}>
            <p>No products found</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => handleProductClick(product.id)}
                style={{
                  backgroundColor: theme.colors.background.paper,
                  border: `1px solid ${theme.colors.border.main}`,
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = theme.colors.primary.main;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = theme.colors.border.main;
                }}
              >
                {/* Product Image */}
                <div style={{
                  width: '100%',
                  height: '200px',
                  backgroundColor: theme.colors.background.elevated,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {product.images?.[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '3rem' }}>📦</span>
                  )}
                </div>

                {/* Product Info */}
                <div style={{ padding: '1rem' }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    margin: '0 0 0.5rem 0',
                    color: theme.colors.text.primary
                  }}>
                    {product.name}
                  </h3>

                  <p style={{
                    fontSize: '0.875rem',
                    color: theme.colors.text.secondary,
                    margin: '0 0 1rem 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {product.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: theme.colors.primary.main
                    }}>
                      ${product.price.toFixed(2)}
                    </span>

                    {!product.inStock && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: theme.colors.error.main,
                        fontWeight: '500'
                      }}>
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: `1px solid ${theme.colors.border.main}`,
        marginTop: '4rem',
        padding: '2rem 0',
        textAlign: 'center',
        color: theme.colors.text.secondary,
        fontSize: '0.875rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          {theme.branding.showPoweredBy && (
            <p>Powered by SalesVelocity</p>
          )}
          <p>© {new Date().getFullYear()} {theme.branding.companyName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}




