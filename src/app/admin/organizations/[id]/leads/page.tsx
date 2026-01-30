'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Users,
  Search,
  Eye,
  Flame,
  Sun,
  Snowflake,
  Loader2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

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

/**
 * Admin Support View: Organization Leads
 * View and manage leads for any tenant organization.
 */
export default function AdminOrgLeadsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const canManageOrg = hasPermission('canEditOrganizations');

  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  useEffect(() => {
    async function loadOrganization() {
      try {
        setOrgLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        setOrganization(org);
      } catch (error) {
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/leads/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  const fetchLeads = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '50',
    });

    if (filter !== 'all') {
      searchParams.set('status', filter);
    }

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const response = await fetch(`/api/workspace/${orgId}/leads?${searchParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch leads');
    }

    return response.json() as Promise<{ data: Lead[]; lastDoc: unknown; hasMore: boolean }>;
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
    void refresh();
  }, [filter, refresh]);

  const getLeadName = (lead: Lead) => {
    if (lead.name) {return lead.name;}
    if (lead.firstName ?? lead.lastName) {
      return `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
    }
    return 'Unknown';
  };

  const getLeadCompany = (lead: Lead) => lead.company ?? lead.companyName ?? '-';

  const getTierBadge = (score: number) => {
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
          <Flame className="w-3 h-3" /> HOT
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
          <Sun className="w-3 h-3" /> WARM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
        <Snowflake className="w-3 h-3" /> COLD
      </span>
    );
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) {return true;}
    const name = getLeadName(lead).toLowerCase();
    const company = getLeadCompany(lead).toLowerCase();
    const email = (lead.email ?? '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) ||
           company.includes(searchQuery.toLowerCase()) ||
           email.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link
          href={`/admin/organizations/${orgId}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organization
        </Link>

        {/* God Mode Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#1a1a2e',
            border: `1px solid ${primaryColor}40`,
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.5rem',
              backgroundColor: `${primaryColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>
              Admin Support View
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              Viewing leads for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
            </div>
          </div>
          {canManageOrg && (
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">
              Full Access
            </div>
          )}
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Leads</h1>
              <p className="text-gray-400">
                {leads.length} leads in pipeline
              </p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-wrap gap-4"
        >
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-12 pr-4 py-3 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors"
              style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-4 py-2.5 rounded-xl font-medium transition-all"
                style={{
                  backgroundColor: filter === f.key ? primaryColor : bgPaper,
                  border: `1px solid ${filter === f.key ? primaryColor : borderColor}`,
                  color: filter === f.key ? '#fff' : '#9ca3af',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
          >
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && leads.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Leads Table */}
        {leads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Lead</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Company</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Score</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    style={{ borderBottom: idx < filteredLeads.length - 1 ? `1px solid ${borderColor}` : 'none' }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{getLeadName(lead)}</div>
                      <div className="text-sm text-gray-500">{lead.email ?? '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{getLeadCompany(lead)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize" style={{
                        backgroundColor: '#ffffff10',
                        border: '1px solid #ffffff20',
                        color: '#fff'
                      }}>
                        {lead.status ?? 'new'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {lead.score !== undefined && getTierBadge(lead.score)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/workspace/${orgId}/leads/${lead.id}`)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Load More */}
            {hasMore && (
              <div className="p-4 text-center border-t" style={{ borderColor }}>
                <button
                  onClick={() => void loadMore()}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                  style={{ backgroundColor: '#ffffff10', border: '1px solid #ffffff20', color: '#fff' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Load More
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && leads.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}10`, border: '1px solid #ffffff10' }}
            >
              <Users className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No leads found</div>
            <div className="text-gray-400">This organization has no leads yet.</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
