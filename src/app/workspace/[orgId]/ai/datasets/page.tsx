'use client';

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { usePagination } from '@/hooks/usePagination';
import { orderBy, type QueryConstraint, type DocumentData, type Timestamp } from 'firebase/firestore';

interface Dataset {
  id: string;
  name: string;
  exampleCount?: number;
  createdAt?: Timestamp;
}

export default function DatasetsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination
  const fetchDatasets = useCallback(async (lastDoc?: DocumentData) => {
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];

    return FirestoreService.getAllPaginated(
      `organizations/${orgId}/trainingDatasets`,
      constraints,
      50,
      lastDoc
    );
  }, [orgId]);

  const {
    data: datasets,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchDatasets });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Training Datasets</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/ai/datasets/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Create Dataset</button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {datasets.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg"><p className="text-gray-400 mb-4">No datasets yet. Upload training data for fine-tuning!</p></div>
      ) : (
        <>
          <div className="grid gap-4">
            {datasets.map((dataset) => {
              const typedDataset = dataset as Dataset;
              const exampleCount = typedDataset.exampleCount ?? 0;
              const createdDate = typedDataset.createdAt && 'toDate' in typedDataset.createdAt
                ? new Date(typedDataset.createdAt.toDate()).toLocaleDateString()
                : 'N/A';

              return (
                <div key={typedDataset.id} className="bg-gray-900 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-2">{typedDataset.name}</h3>
                  <div className="flex gap-4 text-sm text-gray-400">
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
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
