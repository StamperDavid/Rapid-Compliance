'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePagination } from '@/hooks/usePagination';

interface Lead {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  score?: number;
  status?: string;
}

export default function LeadsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [filter, setFilter] = useState('all');

  // Fetch function with pagination using API route
  const fetchLeads = useCallback(async (lastDoc?: any) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '50',
    });
    
    if (filter !== 'all') {
      searchParams.set('status', filter);
    }
    
    if (lastDoc) {
      searchParams.set('lastDoc', lastDoc);
    }

    const response = await fetch(`/api/workspace/${orgId}/leads?${searchParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch leads');
    }
    
    return response.json();
  }, [orgId, filter]);

  const {
    data: leads,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Lead>({ fetchFn: fetchLeads });

  // Refresh when filter changes
  useEffect(() => {
    refresh();
  }, [filter, refresh]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Leads</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/leads/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Lead</button>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'new', 'contacted', 'qualified', 'converted'].map(status => (
          <button key={status} onClick={() => setFilter(status)} className={`px-4 py-2 rounded-lg capitalize ${filter === status ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{status}</button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Company</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Phone</th>
              <th className="text-left p-4">Tier</th>
              <th className="text-left p-4">Score</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">
                  No leads found. Click &quot;+ Add Lead&quot; to create your first lead.
                </td>
              </tr>
            ) : (
              leads.map(lead => (
                <tr key={lead.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                  <td className="p-4 font-medium">{(lead.name !== '' && lead.name != null) ? lead.name : `${lead.firstName  } ${  lead.lastName}`}</td>
                  <td className="p-4 text-gray-400">{(lead.company !== '' && lead.company != null) ? lead.company : lead.companyName}</td>
                  <td className="p-4 text-gray-400">{lead.email}</td>
                  <td className="p-4 text-gray-400">{(lead.phone !== '' && lead.phone != null) ? lead.phone : 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      (lead.score ?? 50) >= 75 ? 'bg-red-600 text-white' : 
                      (lead.score ?? 50) >= 50 ? 'bg-orange-500 text-white' : 
                      'bg-blue-500 text-white'
                    }`}>
                      {(lead.score ?? 50) >= 75 ? '🔥 HOT' : (lead.score ?? 50) >= 50 ? '☀️ WARM' : '❄️ COLD'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${(lead.score ?? 0) >= 80 ? 'bg-green-900 text-green-300' : (lead.score ?? 0) >= 60 ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                      {lead.score ?? 50}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded text-xs bg-blue-900 text-blue-300 capitalize">{(lead.status !== '' && lead.status != null) ? lead.status : 'new'}</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => router.push(`/workspace/${orgId}/leads/${lead.id}`)} className="text-blue-400 hover:text-blue-300">View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {(hasMore || loading) && (
          <div className="p-4 border-t border-gray-800 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loading || !hasMore}
              className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : hasMore ? `Load More (Showing ${leads.length})` : 'All loaded'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

