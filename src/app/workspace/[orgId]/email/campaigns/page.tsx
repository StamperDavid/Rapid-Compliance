'use client';

/**
 * Email Campaigns List
 * Admin page for viewing and managing email campaigns
 */

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCampaigns, deleteCampaign } from '@/lib/email/campaign-service';
import { usePagination } from '@/hooks/usePagination'
import { logger } from '@/lib/logger/logger';;

export default function EmailCampaignsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination using service layer
  const fetchCampaigns = useCallback(async (lastDoc?: any) => {
    return await getCampaigns(
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

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Delete this campaign?')) return;
    
    try {
      await deleteCampaign(orgId, campaignId);
      await refresh(); // Refresh pagination after delete
    } catch (error) {
      logger.error('Error deleting campaign:', error, { file: 'page.tsx' });
      alert('Failed to delete campaign');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Email Campaigns</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/email/campaigns/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Create Campaign
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {campaigns.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <p className="text-gray-400 mb-4">No campaigns yet. Create your first email campaign!</p>
          <button onClick={() => router.push(`/workspace/${orgId}/email/campaigns/new`)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Create Campaign
          </button>
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
                      <span className={`px-2 py-1 rounded text-xs font-medium ${campaign.status === 'sent' ? 'bg-green-900 text-green-300' : campaign.status === 'scheduled' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>
                        {campaign.status}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-3">{campaign.subject}</p>
                    <div className="flex gap-4 text-sm text-gray-400">
                      {campaign.stats && (
                        <>
                          <span>Sent: {campaign.stats.sent || 0}</span>
                          <span>•</span>
                          <span>Opened: {campaign.stats.opened || 0} ({campaign.stats.openRate || 0}%)</span>
                          <span>•</span>
                          <span>Clicked: {campaign.stats.clicked || 0}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/workspace/${orgId}/email/campaigns/${campaign.id}`)} className="px-3 py-1.5 bg-blue-900 text-blue-300 rounded hover:bg-blue-800 text-sm font-medium">
                      View
                    </button>
                    <button onClick={() => handleDelete(campaign.id)} className="px-3 py-1.5 bg-red-900 text-red-300 rounded hover:bg-red-800 text-sm font-medium">
                      Delete
                    </button>
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
