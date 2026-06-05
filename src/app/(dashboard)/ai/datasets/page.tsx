'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { usePagination } from '@/hooks/usePagination';

interface Dataset {
  id: string;
  name: string;
  exampleCount?: number;
  createdAt?: unknown;
}

export default function DatasetsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();

  // Fetch function — the API returns the full list in one page.
  const fetchDatasets = useCallback(async (): Promise<{
    data: Dataset[];
    lastDoc: string | null;
    hasMore: boolean;
  }> => {
    const res = await authFetch('/api/ai/datasets');
    const json = (await res.json()) as { success?: boolean; datasets?: Dataset[]; error?: string };
    if (!res.ok || !json.success) {
      throw new Error(json.error ?? 'Failed to load datasets');
    }
    return { data: json.datasets ?? [], lastDoc: null, hasMore: false };
  }, [authFetch]);

  const {
    data: datasets,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Dataset, string>({ fetchFn: fetchDatasets });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Training Datasets</h1>
          <button onClick={() => router.push(`/ai/datasets/new`)} className="px-4 py-2 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">+ Create Dataset</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-border-light rounded-lg text-error" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          {error}
        </div>
      )}

      {datasets.length === 0 && !loading ? (
        <div className="text-center py-12 bg-surface-paper rounded-lg"><p className="text-[var(--color-text-secondary)] mb-4">No datasets yet. Upload training data for fine-tuning!</p></div>
      ) : (
        <>
          <div className="grid gap-4">
            {datasets.map((dataset) => {
              const exampleCount = dataset.exampleCount ?? 0;
              const createdDate = typeof dataset.createdAt === 'string'
                ? new Date(dataset.createdAt).toLocaleDateString()
                : 'N/A';

              return (
                <div key={dataset.id} className="bg-surface-paper rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2 text-[var(--color-text-primary)]">{dataset.name}</h3>
                  <div className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
                    <span>{exampleCount} examples</span><span>•</span><span>Created {createdDate}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-surface-elevated text-white rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${datasets.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
