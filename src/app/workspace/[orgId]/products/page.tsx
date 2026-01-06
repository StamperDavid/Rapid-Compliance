'use client';

/**
 * Admin Product Management
 * Workspace page for managing products
 */

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProducts, deleteProduct } from '@/lib/ecommerce/product-service';
import { usePagination } from '@/hooks/usePagination'
import { logger } from '@/lib/logger/logger';;

export default function ProductManagementPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination using service layer
  const fetchProducts = useCallback(async (lastDoc?: any) => {
    return getProducts(
      orgId,
      'default',
      undefined,
      { pageSize: 50, lastDoc }
    );
  }, [orgId]);

  const {
    data: products,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchProducts });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (productId: string) => {
    if (!confirm('Delete this product?')) {return;}
    
    try {
      await deleteProduct(orgId, productId, 'default');
      await refresh(); // Refresh pagination after delete
    } catch (error) {
      logger.error('Error deleting product:', error, { file: 'page.tsx' });
      alert('Failed to delete product');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/products/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Add Product
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {products.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-400">
          <p>No products yet. Click &quot;Add Product&quot; to create your first product.</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left p-4">Product</th>
                <th className="text-left p-4">SKU</th>
                <th className="text-left p-4">Price</th>
                <th className="text-left p-4">Stock</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                  <td className="p-4">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-gray-400">{product.category}</div>
                  </td>
                  <td className="p-4 text-gray-400">{product.sku}</td>
                  <td className="p-4">${product.price?.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${product.inStock ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => router.push(`/workspace/${orgId}/products/${product.id}/edit`)} className="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
                    <button onClick={() => handleDelete(product.id)} className="text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="p-4 border-t border-gray-800 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${products.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
