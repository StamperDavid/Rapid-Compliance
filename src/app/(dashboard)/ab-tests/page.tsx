'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@/components/ui/typography';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
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
      getSubCollection('abTests'),
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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <PageTitle>A/B Tests</PageTitle>
        <button onClick={() => router.push(`/ab-tests/new`)} className="px-4 py-2 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">+ Create Test</button>
      </div>

      {error && (
        <div className="p-4 border border-error/20 rounded-lg text-error bg-error/10">
          {error}
        </div>
      )}

      {tests.length === 0 && !loading ? (
        <div className="text-center py-12 bg-surface-paper rounded-lg">
          <p className="text-muted-foreground mb-4">No A/B tests yet. Create your first test!</p>
          <button onClick={() => router.push(`/ab-tests/new`)} className="px-6 py-3 bg-primary text-white rounded-lg hover:from-primary-light hover:to-secondary-light">Create Test</button>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {tests.map((test) => {
              const statusClass =
                test.status === 'running' ? 'text-success bg-success/10' :
                test.status === 'completed' ? 'text-primary bg-primary/10' :
                'text-muted-foreground bg-surface-elevated';
              const variantCount = test.variants?.length ?? 0;

              return (
                <div key={test.id} className="bg-surface-paper rounded-lg p-6 hover:bg-surface-elevated transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-foreground">{test.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`}>{test.status}</span>
                      </div>
                      <p className="text-muted-foreground mb-3">{test.description}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Variants: {variantCount}</span>
                        {test.winner && <><span>•</span><span className="text-success">Winner: {test.winner}</span></>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => router.push(`/ab-tests/${test.id}`)} className="px-3 py-1.5 bg-primary/15 text-primary rounded hover:bg-primary/25 text-sm font-medium">View Results</button>
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
                className="px-6 py-2 bg-surface-elevated text-foreground rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
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
