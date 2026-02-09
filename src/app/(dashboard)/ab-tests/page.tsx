'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { usePagination } from '@/hooks/usePagination';
import { orderBy, type QueryConstraint, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed';
  variants?: Array<{ name: string }>;
  winner?: string;
}

export default function ABTestsPage() {
  const router = useRouter();

  // Fetch function with pagination
  const fetchTests = useCallback(async (lastDoc?: QueryDocumentSnapshot<DocumentData>): Promise<{
    data: ABTest[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> => {
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];

    const result = await FirestoreService.getAllPaginated(
      `organizations/${DEFAULT_ORG_ID}/abTests`,
      constraints,
      50,
      lastDoc
    );
    return {
      data: result.data as ABTest[],
      lastDoc: result.lastDoc,
      hasMore: result.hasMore,
    };
  }, []);

  const {
    data: tests,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<ABTest, QueryDocumentSnapshot<DocumentData>>({ fetchFn: fetchTests });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">A/B Tests</h1>
        <button onClick={() => router.push(`/ab-tests/new`)} className="px-4 py-2 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">+ Create Test</button>
      </div>

      {error && (
        <div className="mb-4 p-4 border rounded-lg text-error" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {tests.length === 0 && !loading ? (
        <div className="text-center py-12 bg-surface-paper rounded-lg"><p className="text-[var(--color-text-secondary)] mb-4">No A/B tests yet. Create your first test!</p><button onClick={() => router.push(`/ab-tests/new`)} className="px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">Create Test</button></div>
      ) : (
        <>
          <div className="grid gap-4">
            {tests.map((test) => {
              const statusClass =
                test.status === 'running' ? 'text-success' :
                test.status === 'completed' ? 'text-primary' :
                'text-[var(--color-text-secondary)]';
              const statusBg =
                test.status === 'running' ? 'rgba(16, 185, 129, 0.1)' :
                test.status === 'completed' ? 'rgba(99, 102, 241, 0.1)' :
                'var(--color-bg-elevated)';
              const variantCount = test.variants?.length ?? 0;

              return (
                <div key={test.id} className="bg-surface-paper rounded-lg p-6 hover:bg-surface-elevated transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{test.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`} style={{ backgroundColor: statusBg }}>{test.status}</span>
                      </div>
                      <p className="text-[var(--color-text-secondary)] mb-3">{test.description}</p>
                      <div className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
                        <span>Variants: {variantCount}</span>
                        {test.winner && <><span>•</span><span className="text-success">Winner: {test.winner}</span></>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => router.push(`/ab-tests/${test.id}`)} className="px-3 py-1.5 bg-primary text-white rounded hover:from-primary-light hover:to-secondary-light text-sm font-medium" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }}>View Results</button>
                    </div>
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
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${tests.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
