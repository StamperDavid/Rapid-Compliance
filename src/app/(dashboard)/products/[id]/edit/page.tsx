'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProduct, updateProduct, type Product } from '@/lib/ecommerce/product-service';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProduct = useCallback(async () => {
    try {
      const data = await getProduct(productId);
      setProduct(data);
    } catch (error) {
      logger.error('Error loading product:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId, toast]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) {
      return;
    }
    try {
      setSaving(true);
      await updateProduct(productId, {
        name: product.name,
        description: product.description,
        price: product.price,
        sku: product.sku,
        category: product.category,
        inStock: product.inStock,
      });
      toast.success('Product updated successfully');
      router.push('/products');
    } catch (error) {
      logger.error('Error updating product:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8">
        <div className="bg-surface-paper rounded-lg p-6 text-center">
          <p className="text-error mb-4">Product not found</p>
          <button
            onClick={() => router.push('/products')}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Edit Product</h1>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Product Name *</label>
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => setProduct({ ...product, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Description</label>
                <textarea
                  value={product.description ?? ''}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={product.price}
                    onChange={(e) => setProduct({ ...product, price: parseFloat(e.target.value) })}
                    required
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">SKU</label>
                  <input
                    type="text"
                    value={product.sku ?? ''}
                    onChange={(e) => setProduct({ ...product, sku: e.target.value })}
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Category</label>
                  <input
                    type="text"
                    value={product.category ?? ''}
                    onChange={(e) => setProduct({ ...product, category: e.target.value })}
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Stock Status</label>
                  <select
                    value={product.inStock ? 'in_stock' : 'out_of_stock'}
                    onChange={(e) => setProduct({ ...product, inStock: e.target.value === 'in_stock' })}
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Stock Quantity</label>
                  <input
                    type="number"
                    value={product.stockQuantity ?? 0}
                    onChange={(e) => setProduct({ ...product, stockQuantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Compare At Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={product.compareAtPrice ?? ''}
                    onChange={(e) => setProduct({ ...product, compareAtPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Original price for sale display"
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-main text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
