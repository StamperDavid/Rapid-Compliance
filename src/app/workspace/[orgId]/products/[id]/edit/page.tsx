'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const productId = params.id as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProduct();
  }, []);

  const loadProduct = async () => {
    try {
      const data = await FirestoreService.get(`organizations/${orgId}/workspaces/default/entities/products/records`, productId);
      setProduct(data);
    } catch (error) {
      logger.error('Error loading product:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await FirestoreService.update(`organizations/${orgId}/workspaces/default/entities/products/records`, productId, { ...product, updatedAt: Timestamp.now() });
      router.push(`/workspace/${orgId}/products`);
    } catch (error) {
      logger.error('Error updating product:', error, { file: 'page.tsx' });
      alert('Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !product) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Product</h1>
        <form onSubmit={handleSubmit}>
          <div className="bg-gray-900 rounded-lg p-6 mb-4">
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Product Name *</label><input type="text" value={product.name ?? ''} onChange={(e) => setProduct({...product, name: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-2">Description</label><textarea value={product.description ?? ''} onChange={(e) => setProduct({...product, description: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={4} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Price ($) *</label><input type="number" step="0.01" value={product.price ?? 0} onChange={(e) => setProduct({...product, price: parseFloat(e.target.value)})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">SKU</label><input type="text" value={product.sku ?? ''} onChange={(e) => setProduct({...product, sku: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Category</label><input type="text" value={product.category ?? ''} onChange={(e) => setProduct({...product, category: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-2">Stock Status</label><select value={product.inStock ? 'in_stock' : 'out_of_stock'} onChange={(e) => setProduct({...product, inStock: e.target.value === 'in_stock'})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"><option value="in_stock">In Stock</option><option value="out_of_stock">Out of Stock</option></select></div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




