'use client';

/**
 * Services Catalog
 *
 * Lists catalog items with category "service". Uses the same product service
 * and data model — services are products with category=service.
 * Accessible via the Catalog hub's "Services" tab.
 */

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, deleteProduct, type Product } from '@/lib/ecommerce/product-service';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

export default function ServicesCatalogPage() {
  const router = useRouter();
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchServices = useCallback(
    async (lastDoc?: QueryDocumentSnapshot) => {
      return getProducts(
        { category: 'service' },
        { pageSize: 50, lastDoc }
      );
    },
    [],
  );

  const {
    data: services,
    loading,
    hasMore,
    loadMore,
    refresh,
  } = usePagination<Product, QueryDocumentSnapshot>({ fetchFn: fetchServices });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) { return; }
    try {
      await deleteProduct(deletingId);
      toast.success('Service deleted');
      void refresh();
    } catch (error) {
      logger.error('Failed to delete service', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to delete service');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Services
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Manage your service offerings — consultations, packages, recurring services.
          </p>
        </div>
        <button
          onClick={() => router.push('/products/new?type=service')}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          + Add Service
        </button>
      </div>

      {loading && services.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          Loading services...
        </div>
      ) : services.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{
            borderColor: 'var(--color-border-light)',
            backgroundColor: 'var(--color-bg-elevated)',
          }}
        >
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No services yet
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Add your first service to start selling consultations, packages, or recurring services.
          </p>
          <button
            onClick={() => router.push('/products/new?type=service')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            + Add Service
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-4 rounded-lg border"
                style={{
                  borderColor: 'var(--color-border-light)',
                  backgroundColor: 'var(--color-bg-elevated)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {service.name}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {service.description ?? 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                    ${((service.price ?? 0) / 100).toFixed(2)}
                  </span>
                  <button
                    onClick={() => router.push(`/products/${service.id}/edit`)}
                    className="px-3 py-1.5 rounded text-xs font-medium border"
                    style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }}
                  >
                    Edit
                  </button>
                  {deletingId === service.id ? (
                    <button
                      onClick={() => void confirmDelete()}
                      className="px-3 py-1.5 rounded text-xs font-medium"
                      style={{ color: 'var(--color-error)' }}
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteClick(service.id)}
                      className="px-3 py-1.5 rounded text-xs font-medium"
                      style={{ color: 'var(--color-error)' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={() => void loadMore()}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }}
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
