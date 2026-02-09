'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  category?: string;
  inStock: boolean;
  updatedAt?: Timestamp;
}

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
      const data = await FirestoreService.get(`${getSubCollection('workspaces')}/default/entities/products/records`, productId);
      setProduct(data as Product);
    } catch (error) {
      logger.error('Error loading product:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [productId]);

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
      await FirestoreService.update(`${getSubCollection('workspaces')}/default/entities/products/records`, productId, { ...product, updatedAt: Timestamp.now() });
      toast.success('Product updated successfully');
      router.push(`/products`);
    } catch (error) {
      logger.error('Error updating product:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !product) {
    return <div className="p-8 text-[var(--color-text-primary)]">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Edit Product</h1>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="bg-surface-paper rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Product Name *</label><input type="text" value={product?.name ?? ''} onChange={(e) => setProduct({...product, name: e.target.value})} required className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]" /></div>
              <div><label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Description</label><textarea value={product?.description ?? ''} onChange={(e) => setProduct({...product, description: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]" rows={4} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Price ($) *</label><input type="number" step="0.01" value={product?.price ?? 0} onChange={(e) => setProduct({...product, price: parseFloat(e.target.value)})} required className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]" /></div>
                <div><label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">SKU</label><input type="text" value={product?.sku ?? ''} onChange={(e) => setProduct({...product, sku: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Category</label><input type="text" value={product?.category ?? ''} onChange={(e) => setProduct({...product, category: e.target.value})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]" /></div>
                <div><label className="block text-sm font-medium mb-2 text-[var(--color-text-secondary)]">Stock Status</label><select value={product?.inStock ? 'in_stock' : 'out_of_stock'} onChange={(e) => setProduct({...product, inStock: e.target.value === 'in_stock'})} className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)]"><option value="in_stock">In Stock</option><option value="out_of_stock">Out of Stock</option></select></div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-surface-elevated rounded-lg hover:bg-surface-elevated text-[var(--color-text-primary)]">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




