'use client';

/**
 * Product Detail Page
 * Customer-facing product details with add to cart
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { FirestoreService } from '@/lib/db/firestore-service';
import { addToCart } from '@/lib/ecommerce/cart-service';
import { useTheme } from '@/contexts/ThemeContext'
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
  features?: string[];
  specifications?: Record<string, string>;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const orgId = DEFAULT_ORG_ID;
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      const productData = await FirestoreService.get(
        `organizations/${orgId}/products`,
        productId
      );
      setProduct(productData as Product);
    } catch (error) {
      logger.error('Error loading product:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [orgId, productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleAddToCart = async () => {
    if (!product) {return;}

    try {
      setAdding(true);

      // Get or create cart session
      const sessionId = localStorage.getItem('cartSessionId') ?? `session-${Date.now()}`;
      localStorage.setItem('cartSessionId', sessionId);

      await addToCart(sessionId, 'default', orgId, productId, quantity);

      // Show success and redirect to cart
      toast.success('Added to cart!');
      router.push('/store/cart');
    } catch (error) {
      logger.error('Error adding to cart:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  if (loading || !product) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background.main,
        color: theme.colors.text.primary
      }}>
        <div>Loading...</div>
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
            <button
              onClick={() => router.push('/store/products')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: theme.colors.text.secondary,
                border: `1px solid ${theme.colors.border.light}`,
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              ← Back to Products
            </button>
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

      {/* Product Detail */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          {/* Image Gallery */}
          <div>
            <div style={{
              width: '100%',
              height: '400px',
              backgroundColor: theme.colors.background.paper,
              borderRadius: '0.75rem',
              overflow: 'hidden',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {product.images?.[selectedImage] ? (
                <Image
                  src={product.images[selectedImage]}
                  alt={product.name}
                  fill
                  style={{ objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: '6rem' }}>📦</span>
              )}
            </div>

            {(product.images?.length ?? 0) > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {product.images?.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    style={{
                      width: '80px',
                      height: '80px',
                      backgroundColor: theme.colors.background.paper,
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: selectedImage === idx ? `2px solid ${theme.colors.primary.main}` : 'none',
                      position: 'relative'
                    }}
                  >
                    <Image src={img} alt="" fill style={{ objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {product.name}
            </h1>

            {product.category ? (
              <p style={{
                fontSize: '0.875rem',
                color: theme.colors.text.secondary,
                marginBottom: '1rem'
              }}>
                {product.category}
              </p>
            ) : null}

            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: theme.colors.primary.main, marginBottom: '1.5rem' }}>
              ${product.price.toFixed(2)}
            </div>

            <p style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '2rem', color: theme.colors.text.secondary }}>
              {product.description}
            </p>

            {/* Quantity Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Quantity
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: theme.colors.background.paper,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '1.25rem'
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: '80px',
                    padding: '0.5rem',
                    textAlign: 'center',
                    backgroundColor: theme.colors.background.paper,
                    color: theme.colors.text.primary,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: '0.375rem',
                    fontSize: '1rem'
                  }}
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: theme.colors.background.paper,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '1.25rem'
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={() => void handleAddToCart()}
              disabled={!product.inStock || adding}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: product.inStock ? theme.colors.primary.main : theme.colors.neutral[600],
                color: theme.colors.primary.contrast,
                border: 'none',
                borderRadius: '0.5rem',
                cursor: product.inStock ? 'pointer' : 'not-allowed',
                fontSize: '1.125rem',
                fontWeight: '600',
                marginBottom: '1rem'
              }}
            >
              {adding ? 'Adding...' : !product.inStock ? 'Out of Stock' : 'Add to Cart'}
            </button>

            {/* Features */}
            {(product.features?.length ?? 0) > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Features
                </h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {product.features?.map((feature, idx) => (
                    <li key={idx} style={{ marginBottom: '0.5rem', color: theme.colors.text.secondary }}>
                      ✓ {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specifications */}
            {(Object.keys(product.specifications ?? {}).length) > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Specifications
                </h3>
                <div style={{
                  backgroundColor: theme.colors.background.paper,
                  borderRadius: '0.5rem',
                  padding: '1rem'
                }}>
                  {Object.entries(product.specifications ?? {}).map(([key, value]) => (
                    <div key={key} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      borderBottom: `1px solid ${theme.colors.border.main}`
                    }}>
                      <span style={{ fontWeight: '500' }}>{key}</span>
                      <span style={{ color: theme.colors.text.secondary }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}




