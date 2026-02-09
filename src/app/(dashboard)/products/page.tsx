'use client';


/**
 * Admin Product Management
 * Workspace page for managing products
 */

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, deleteProduct } from '@/lib/ecommerce/product-service';
import { usePagination } from '@/hooks/usePagination'
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

export default function ProductManagementPage() {
  const router = useRouter();
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch function with pagination using service layer
  const fetchProducts = useCallback(async (lastDoc?: QueryDocumentSnapshot) => {
    return getProducts(
      'default',
      undefined,
      { pageSize: 50, lastDoc }
    );
  }, []);

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
    void refresh();
  }, [refresh]);

  const handleDeleteClick = (productId: string) => {
    setDeletingId(productId);
  };

  const confirmDelete = () => {
    if (!deletingId) {
      return;
    }

    void (async () => {
      try {
        await deleteProduct(deletingId, 'default');
        toast.success('Product deleted successfully');
        await refresh(); // Refresh pagination after delete
      } catch (error) {
        logger.error('Error deleting product:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
        toast.error('Failed to delete product');
      } finally {
        setDeletingId(null);
      }
    })();
  };

  const cancelDelete = () => {
    setDeletingId(null);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Products</h1>
        <button onClick={() => router.push(`/products/new`)} className="px-4 py-2 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">
          + Add Product
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 border rounded-lg text-error" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)', borderColor: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      {products.length === 0 && !loading ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          <p>No products yet. Click &quot;Add Product&quot; to create your first product.</p>
        </div>
      ) : (
        <div className="bg-surface-paper rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="text-left p-4 text-[var(--color-text-primary)]">Product</th>
                <th className="text-left p-4 text-[var(--color-text-primary)]">SKU</th>
                <th className="text-left p-4 text-[var(--color-text-primary)]">Price</th>
                <th className="text-left p-4 text-[var(--color-text-primary)]">Stock</th>
                <th className="text-left p-4 text-[var(--color-text-primary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-t border-border-light hover:bg-surface-elevated">
                  <td className="p-4">
                    <div className="font-medium text-[var(--color-text-primary)]">{product.name}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{product.category}</div>
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">{product.sku}</td>
                  <td className="p-4 text-[var(--color-text-primary)]">${product.price?.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${product.inStock ? 'text-success' : 'text-error'}`} style={{ backgroundColor: product.inStock ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'color-mix(in srgb, var(--color-error) 15%, transparent)' }}>
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => router.push(`/products/${product.id}/edit`)} className="text-primary hover:from-primary-light mr-3">Edit</button>
                    <button onClick={() => handleDeleteClick(product.id)} className="text-error hover:text-error">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="p-4 border-t border-border-light flex justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-surface-elevated text-[var(--color-text-primary)] rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${products.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-surface-paper flex items-center justify-center z-50">
          <div className="bg-surface-paper border border-border-light rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">Delete Product</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={cancelDelete} className="px-4 py-2 bg-surface-elevated rounded-lg hover:bg-surface-elevated text-[var(--color-text-primary)]">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
