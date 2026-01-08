'use client';

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getNurtureCampaigns } from '@/lib/outbound/nurture-service';
import { usePagination } from '@/hooks/usePagination';

export default function NurtureCampaignsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination using service layer
  const fetchCampaigns = useCallback(async (lastDoc?: any) => {
    return getNurtureCampaigns(
      orgId,
      undefined,
      { pageSize: 50, lastDoc }
    );
  }, [orgId]);

  const {
    data: campaigns,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchCampaigns });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Lead Nurture Campaigns</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/nurture/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Create Campaign</button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {campaigns.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <p className="text-gray-400 mb-4">No nurture campaigns yet. Create your first automated nurture sequence!</p>
          <button onClick={() => router.push(`/workspace/${orgId}/nurture/new`)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Campaign</button>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800/50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{campaign.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${campaign.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>{campaign.status}</span>
                    </div>
                    <p className="text-gray-400 mb-3">{campaign.description}</p>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>{campaign.steps?.length || 0} steps</span>
                      <span>•</span>
                      <span>{campaign.enrolled ?? 0} leads enrolled</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/workspace/${orgId}/nurture/${campaign.id}`)} className="px-3 py-1.5 bg-blue-900 text-blue-300 rounded hover:bg-blue-800 text-sm font-medium">Edit</button>
                    <button onClick={() => router.push(`/workspace/${orgId}/nurture/${campaign.id}/stats`)} className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 text-sm font-medium">Stats</button>
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
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${campaigns.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
