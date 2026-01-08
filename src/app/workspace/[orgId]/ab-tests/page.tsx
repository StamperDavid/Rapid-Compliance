'use client';

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { usePagination } from '@/hooks/usePagination';
import type { QueryConstraint } from 'firebase/firestore';
import { orderBy } from 'firebase/firestore';

export default function ABTestsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination
  const fetchTests = useCallback(async (lastDoc?: any) => {
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];

    return FirestoreService.getAllPaginated(
      `organizations/${orgId}/abTests`,
      constraints,
      50,
      lastDoc
    );
  }, [orgId]);

  const {
    data: tests,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchTests });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">A/B Tests</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/ab-tests/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Create Test</button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {tests.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg"><p className="text-gray-400 mb-4">No A/B tests yet. Create your first test!</p><button onClick={() => router.push(`/workspace/${orgId}/ab-tests/new`)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Test</button></div>
      ) : (
        <>
          <div className="grid gap-4">
            {tests.map(test => (
              <div key={test.id} className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800/50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{test.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${test.status === 'running' ? 'bg-green-900 text-green-300' : test.status === 'completed' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>{test.status}</span>
                    </div>
                    <p className="text-gray-400 mb-3">{test.description}</p>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>Variants: {test.variants?.length ?? 0}</span>
                      {test.winner && <><span>•</span><span className="text-green-400">Winner: {test.winner}</span></>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/workspace/${orgId}/ab-tests/${test.id}`)} className="px-3 py-1.5 bg-blue-900 text-blue-300 rounded hover:bg-blue-800 text-sm font-medium">View Results</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
