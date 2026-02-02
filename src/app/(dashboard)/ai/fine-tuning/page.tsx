'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { usePagination } from '@/hooks/usePagination';
import { orderBy, type QueryConstraint, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

interface FineTuningJob {
  id: string;
  modelName: string;
  baseModel: string;
  datasetSize?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export default function FineTuningPage() {
  const router = useRouter();
  const orgId = DEFAULT_ORG_ID;

  // Fetch function with pagination
  const fetchJobs = useCallback(async (lastDoc?: QueryDocumentSnapshot<DocumentData>): Promise<{
    data: FineTuningJob[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> => {
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];

    const result = await FirestoreService.getAllPaginated(
      `organizations/${orgId}/fineTuningJobs`,
      constraints,
      50,
      lastDoc
    );
    return {
      data: result.data as FineTuningJob[],
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  }, [orgId]);

  const {
    data: jobs,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<FineTuningJob, QueryDocumentSnapshot<DocumentData>>({ fetchFn: fetchJobs });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fine-Tuning Jobs</h1>
        <button onClick={() => router.push(`/ai/fine-tuning/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Start Fine-Tuning</button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {jobs.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg"><p className="text-gray-400 mb-4">No fine-tuning jobs yet. Create custom AI models!</p><button onClick={() => router.push(`/ai/fine-tuning/new`)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start Fine-Tuning</button></div>
      ) : (
        <>
          <div className="grid gap-4">
            {jobs.map((job) => {
              const datasetSize = job.datasetSize ?? 0;
              const statusClass =
                job.status === 'completed' ? 'bg-green-900 text-green-300' :
                job.status === 'running' ? 'bg-blue-900 text-blue-300' :
                job.status === 'failed' ? 'bg-red-900 text-red-300' :
                'bg-gray-700 text-gray-300';

              return (
                <div key={job.id} className="bg-gray-900 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{job.modelName}</h3>
                      <div className="flex gap-4 text-sm text-gray-400 mb-3">
                        <span>Base: {job.baseModel}</span><span>•</span><span>Dataset: {datasetSize} examples</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`}>{job.status}</span>
                    </div>
                    <div>{job.status === 'completed' && <button className="px-3 py-1.5 bg-blue-900 text-blue-300 rounded hover:bg-blue-800 text-sm font-medium">Deploy Model</button>}</div>
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
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${jobs.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
