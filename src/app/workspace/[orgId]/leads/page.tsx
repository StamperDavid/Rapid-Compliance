'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Flame,
  Sun,
  Snowflake,
  Loader2,
  AlertCircle,
  ChevronDown,
  UserPlus
} from 'lucide-react';

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

const STATUS_FILTERS = [
  { key: 'all', label: 'All Leads' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'converted', label: 'Converted' },
];

export default function LeadsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  useEffect(() => {
    refresh();
  }, [filter, refresh]);

  const getLeadName = (lead: Lead) => {
    if (lead.name) return lead.name;
    if (lead.firstName || lead.lastName) {
      return `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    }
    return 'Unknown';
  };

  const getLeadCompany = (lead: Lead) => {
    return lead.company || lead.companyName || '-';
  };

  const getTierBadge = (score: number) => {
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-300">
          <Flame className="w-3 h-3" />
          HOT
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 text-orange-300">
          <Sun className="w-3 h-3" />
          WARM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-300">
        <Snowflake className="w-3 h-3" />
        COLD
      </span>
    );
  };

  const getScoreBadge = (score: number) => {
    const colorClass = score >= 80
      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
      : score >= 60
      ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
      : 'bg-gray-500/20 border-gray-500/30 text-gray-300';

    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-mono border ${colorClass}`}>
        {score}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      new: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
      contacted: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
      qualified: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
      converted: 'bg-green-500/20 border-green-500/30 text-green-300',
    };

    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${statusColors[status] || statusColors.new}`}>
        {status || 'new'}
      </span>
    );
  };

  // Filter leads by search query
  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = getLeadName(lead).toLowerCase();
    const company = getLeadCompany(lead).toLowerCase();
    const email = (lead.email || '').toLowerCase();
    return name.includes(query) || company.includes(query) || email.includes(query);
  });

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Leads</h1>
            <p className="text-gray-400 text-sm">{leads.length} total leads</p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/workspace/${orgId}/leads/new`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
        >
          <Plus className="w-5 h-5" />
          Add Lead
        </button>
      </motion.div>

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col md:flex-row gap-4 mb-6"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status.key}
              onClick={() => setFilter(status.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                filter === status.key
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
        </motion.div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Name</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Company</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Email</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Phone</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Tier</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Score</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Status</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                        <UserPlus className="w-8 h-8 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">No leads found</p>
                        <p className="text-gray-500 text-sm">Click &quot;Add Lead&quot; to create your first lead</p>
                      </div>
                      <button
                        onClick={() => router.push(`/workspace/${orgId}/leads/new`)}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Lead
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead, idx) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-t border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="p-4">
                      <span className="font-medium text-white">{getLeadName(lead)}</span>
                    </td>
                    <td className="p-4 text-gray-400">{getLeadCompany(lead)}</td>
                    <td className="p-4 text-gray-400">{lead.email || '-'}</td>
                    <td className="p-4 text-gray-400">{lead.phone || '-'}</td>
                    <td className="p-4">{getTierBadge(lead.score ?? 50)}</td>
                    <td className="p-4">{getScoreBadge(lead.score ?? 50)}</td>
                    <td className="p-4">{getStatusBadge(lead.status || 'new')}</td>
                    <td className="p-4">
                      <button
                        onClick={() => router.push(`/workspace/${orgId}/leads/${lead.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 text-gray-400 hover:text-white rounded-lg transition-all text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(hasMore || loading) && (
          <div className="p-4 border-t border-white/10 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loading || !hasMore}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : hasMore ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Load More ({filteredLeads.length} shown)
                </>
              ) : (
                'All leads loaded'
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
