'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SubpageNav from '@/components/ui/SubpageNav';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { usePagination } from '@/hooks/usePagination';
import { orderBy, type QueryConstraint, type DocumentData, type QueryDocumentSnapshot, type Timestamp } from 'firebase/firestore';

interface Dataset {
  id: string;
  name: string;
  exampleCount?: number;
  createdAt?: Timestamp;
}

export default function DatasetsPage() {
  const router = useRouter();

  // Fetch function with pagination
  const fetchDatasets = useCallback(async (lastDoc?: QueryDocumentSnapshot<DocumentData>): Promise<{
    data: Dataset[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> => {
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];

    const result = await FirestoreService.getAllPaginated(
      getSubCollection('trainingDatasets'),
      constraints,
      50,
      lastDoc
    );
    return {
      data: result.data as Dataset[],
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  }, []);

  const {
    data: datasets,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Dataset, QueryDocumentSnapshot<DocumentData>>({ fetchFn: fetchDatasets });

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
        <SubpageNav items={[
          { label: 'Datasets', href: '/ai/datasets' },
          { label: 'Fine-Tuning', href: '/ai/fine-tuning' },
        ]} />
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
              const createdDate = dataset.createdAt && 'toDate' in dataset.createdAt
                ? new Date(dataset.createdAt.toDate()).toLocaleDateString()
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
