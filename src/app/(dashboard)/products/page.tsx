'use client';


/**
 * Admin Product Management
 * Workspace page for managing products
 */

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATALOG_TYPE_LABELS, type Product } from '@/lib/ecommerce/product-service';
import { PageTitle } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';

export default function ProductManagementPage() {
  const router = useRouter();
  const toast = useToast();
  const authFetch = useAuthFetch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/products');
      const json = (await res.json()) as { success?: boolean; products?: Product[]; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to load products');
      }
      setProducts(json.products ?? []);
    } catch (err: unknown) {
      logger.error('Error loading products:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

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
        const res = await authFetch(`/api/products/${deletingId}`, { method: 'DELETE' });
        const json = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to delete product');
        }
        toast.success('Product deleted successfully');
        await refresh();
      } catch (err) {
        logger.error('Error deleting product:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <PageTitle>Products</PageTitle>
        <button onClick={() => router.push(`/products/new`)} className="px-4 py-2 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">
          + Add Product
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-error/30 rounded-lg text-error bg-error/10">
          {error}
        </div>
      )}

      {products.length === 0 && !loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No products yet. Click &quot;Add Product&quot; to create your first product.</p>
        </div>
      ) : (
        <div className="bg-surface-paper rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="text-left p-4 text-foreground">Product</th>
                <th className="text-left p-4 text-foreground">Type</th>
                <th className="text-left p-4 text-foreground">SKU</th>
                <th className="text-left p-4 text-foreground">Price</th>
                <th className="text-left p-4 text-foreground">Stock</th>
                <th className="text-left p-4 text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-t border-border-light hover:bg-surface-elevated">
                  <td className="p-4">
                    <div className="font-medium text-foreground">{product.name}</div>
                    <div className="text-sm text-muted-foreground">{product.category}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                      {CATALOG_TYPE_LABELS[product.type ?? 'product'] ?? 'Product'}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">{product.sku}</td>
                  <td className="p-4 text-foreground">${product.price?.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${product.inStock ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
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

          {loading && (
            <div className="p-4 border-t border-border-light flex justify-center text-muted-foreground">
              Loading...
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border-light rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4 text-foreground">Delete Product</h2>
            <p className="text-muted-foreground mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={cancelDelete} className="px-4 py-2 bg-surface-elevated rounded-lg hover:bg-surface-elevated text-foreground">
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
