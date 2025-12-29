'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePagination } from '@/hooks/usePagination';

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

interface Deal {
  id: string;
  name: string;
  company?: string;
  companyName?: string;
  value?: number;
  stage?: string;
  probability?: number;
}

export default function DealsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');

  // Fetch function with pagination using API route
  const fetchDeals = useCallback(async (lastDoc?: any) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '100'
    });
    
    if (lastDoc) {
      searchParams.set('lastDoc', lastDoc);
    }

    const response = await fetch(`/api/workspace/${orgId}/deals?${searchParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch deals');
    }
    
    return await response.json();
  }, [orgId]);

  const {
    data: deals,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Deal>({ fetchFn: fetchDeals });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage);

  if (loading && deals.length === 0) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Deals Pipeline</h1>
        <div className="flex gap-3">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button onClick={() => setView('pipeline')} className={`px-4 py-2 rounded ${view === 'pipeline' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Pipeline</button>
            <button onClick={() => setView('list')} className={`px-4 py-2 rounded ${view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>List</button>
          </div>
          <button onClick={() => router.push(`/workspace/${orgId}/deals/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Deal</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {view === 'pipeline' ? (
        <>
          <div className="grid grid-cols-6 gap-4">
            {DEAL_STAGES.map(stage => {
              const stageDeals = getDealsByStage(stage);
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
              
              return (
                <div key={stage} className="bg-gray-900 rounded-lg p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold capitalize text-sm mb-1">{stage.replace('_', ' ')}</h3>
                    <div className="text-xs text-gray-400">{stageDeals.length} deals • ${stageValue.toLocaleString()}</div>
                  </div>
                  <div className="space-y-2">
                    {stageDeals.map(deal => (
                      <div key={deal.id} onClick={() => router.push(`/workspace/${orgId}/deals/${deal.id}`)} className="bg-gray-800 rounded p-3 cursor-pointer hover:bg-gray-700 transition">
                        <div className="font-medium text-sm mb-1">{deal.name}</div>
                        <div className="text-xs text-gray-400 mb-2">{deal.company || deal.companyName}</div>
                        <div className="text-sm font-semibold text-green-400">${(deal.value || 0).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More for Pipeline View */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More Deals (Showing ${deals.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left p-4">Deal</th>
                <th className="text-left p-4">Company</th>
                <th className="text-left p-4">Value</th>
                <th className="text-left p-4">Stage</th>
                <th className="text-left p-4">Probability</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No deals found. Click &quot;+ New Deal&quot; to create your first deal.
                  </td>
                </tr>
              ) : (
                deals.map(deal => (
                  <tr key={deal.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4 font-medium">{deal.name}</td>
                    <td className="p-4 text-gray-400">{deal.company || deal.companyName}</td>
                    <td className="p-4 text-green-400 font-semibold">${(deal.value || 0).toLocaleString()}</td>
                    <td className="p-4"><span className="px-2 py-1 rounded text-xs bg-blue-900 text-blue-300 capitalize">{deal.stage?.replace('_', ' ')}</span></td>
                    <td className="p-4 text-gray-400">{deal.probability || 0}%</td>
                    <td className="p-4">
                      <button onClick={() => router.push(`/workspace/${orgId}/deals/${deal.id}`)} className="text-blue-400 hover:text-blue-300">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination for List View */}
          {(hasMore || loading) && (
            <div className="p-4 border-t border-gray-800 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${deals.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
