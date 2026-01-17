'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export default function NewProductPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [product, setProduct] = useState({
    name: '',
    description: '',
    price: 0,
    category: '',
    sku: '',
    inStock: true,
    images: [] as string[],
    features: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const productId = `prod-${Date.now()}`;
      
      await FirestoreService.set(
        `organizations/${orgId}/workspaces/default/entities/products/records`,
        productId,
        {
          ...product,
          id: productId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        false
      );
      
      router.push(`/workspace/${orgId}/products`);
    } catch (error) {
      logger.error('Error creating product:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      alert('Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Add New Product</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Product Name *</label>
                <input type="text" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea value={product.description} onChange={(e) => setProduct({...product, description: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" rows={4} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price ($) *</label>
                  <input type="number" step="0.01" value={product.price} onChange={(e) => setProduct({...product, price: parseFloat(e.target.value)})} required className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">SKU</label>
                  <input type="text" value={product.sku} onChange={(e) => setProduct({...product, sku: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <input type="text" value={product.category} onChange={(e) => setProduct({...product, category: e.target.value})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Stock Status</label>
                  <select value={product.inStock ? 'in_stock' : 'out_of_stock'} onChange={(e) => setProduct({...product, inStock: e.target.value === 'in_stock'})} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {saving ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




