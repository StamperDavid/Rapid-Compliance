'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
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
      getSubCollection('fineTuningJobs'),
      constraints,
      50,
      lastDoc
    );
    return {
      data: result.data as FineTuningJob[],
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  }, []);

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
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Fine-Tuning Jobs</h1>
          <button onClick={() => router.push(`/ai/fine-tuning/new`)} className="px-4 py-2 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">+ Start Fine-Tuning</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 border border-border-light rounded-lg text-error" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          {error}
        </div>
      )}

      {jobs.length === 0 && !loading ? (
        <div className="text-center py-12 bg-surface-paper rounded-lg"><p className="text-[var(--color-text-secondary)] mb-4">No fine-tuning jobs yet. Create custom AI models!</p><button onClick={() => router.push(`/ai/fine-tuning/new`)} className="px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">Start Fine-Tuning</button></div>
      ) : (
        <>
          <div className="grid gap-4">
            {jobs.map((job) => {
              const datasetSize = job.datasetSize ?? 0;
              const statusClass =
                job.status === 'completed' ? 'text-success' :
                job.status === 'running' ? 'text-primary' :
                job.status === 'failed' ? 'text-error' :
                'text-[var(--color-text-secondary)]';
              const statusBg =
                job.status === 'completed' ? 'rgba(var(--color-success-rgb), 0.1)' :
                job.status === 'running' ? 'rgba(var(--color-primary-rgb), 0.1)' :
                job.status === 'failed' ? 'rgba(var(--color-error-rgb), 0.1)' :
                'var(--color-bg-elevated)';

              return (
                <div key={job.id} className="bg-surface-paper rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2 text-[var(--color-text-primary)]">{job.modelName}</h3>
                      <div className="flex gap-4 text-sm text-[var(--color-text-secondary)] mb-3">
                        <span>Base: {job.baseModel}</span><span>•</span><span>Dataset: {datasetSize} examples</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`} style={{ backgroundColor: statusBg }}>{job.status}</span>
                    </div>
                    <div>{job.status === 'completed' && <button className="px-3 py-1.5 text-primary rounded text-sm font-medium" style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)' }}>Deploy Model</button>}</div>
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
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${jobs.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
