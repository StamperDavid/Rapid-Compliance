'use client';

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FirestoreService } from '@/lib/db/firestore-service';
import { usePagination } from '@/hooks/usePagination';
import { orderBy, QueryConstraint } from 'firebase/firestore';

export default function CallLogPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination
  const fetchCalls = useCallback(async (lastDoc?: any) => {
    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc')
    ];

    return await FirestoreService.getAllPaginated(
      `organizations/${orgId}/workspaces/default/calls`,
      constraints,
      50,
      lastDoc
    );
  }, [orgId]);

  const {
    data: calls,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchCalls });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Call Log</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/calls/make`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">📞 Make Call</button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {calls.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg"><p className="text-gray-400">No calls yet. Start making calls to see your log here.</p></div>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left p-4">Contact</th>
                <th className="text-left p-4">Number</th>
                <th className="text-left p-4">Duration</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Recording</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                  <td className="p-4 font-medium">{call.contactName}</td>
                  <td className="p-4 text-gray-400">{call.phoneNumber}</td>
                  <td className="p-4 text-gray-400">{call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '-'}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${call.status === 'completed' ? 'bg-green-900 text-green-300' : call.status === 'missed' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>{call.status}</span></td>
                  <td className="p-4 text-gray-400">{call.createdAt ? new Date(call.createdAt).toLocaleString() : '-'}</td>
                  <td className="p-4">{call.recordingUrl && <a href={call.recordingUrl} className="text-blue-400 hover:text-blue-300">🎧 Listen</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="p-4 border-t border-gray-800 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${calls.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
