'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Briefcase,
  LayoutGrid,
  List,
  Eye,
  ChevronDown,
  Loader2,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

interface Deal {
  id: string;
  name: string;
  company?: string;
  companyName?: string;
  value?: number;
  stage?: string;
  probability?: number;
}

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  prospecting: { bg: '#3b82f620', text: '#60a5fa' },
  qualification: { bg: '#8b5cf620', text: '#a78bfa' },
  proposal: { bg: '#f97316​20', text: '#fb923c' },
  negotiation: { bg: '#eab30820', text: '#fbbf24' },
  closed_won: { bg: '#22c55e20', text: '#4ade80' },
  closed_lost: { bg: '#ef444420', text: '#f87171' },
};

/**
 * Admin Support View: Organization Deals
 * View and manage deals pipeline for any tenant organization.
 */
export default function AdminOrgDealsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');

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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/deals/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  const fetchDeals = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '100'
    });

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const response = await fetch(`/api/workspace/${orgId}/deals?${searchParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch deals');
    }

    return response.json() as Promise<{ data: Deal[]; lastDoc: unknown; hasMore: boolean }>;
  }, [orgId]);

  const {
    data: deals,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Deal>({ fetchFn: fetchDeals });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage);
  const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const getCompanyName = (deal: Deal) => deal.company ?? deal.companyName ?? '-';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

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
              Viewing deals for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Deals Pipeline</h1>
                <p className="text-gray-400">
                  {deals.length} deals • {formatCurrency(totalPipelineValue)} total value
                </p>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setView('pipeline')}
                className="px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2"
                style={{
                  backgroundColor: view === 'pipeline' ? primaryColor : bgPaper,
                  border: `1px solid ${view === 'pipeline' ? primaryColor : borderColor}`,
                  color: '#fff'
                }}
              >
                <LayoutGrid className="w-4 h-4" />
                Pipeline
              </button>
              <button
                onClick={() => setView('list')}
                className="px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2"
                style={{
                  backgroundColor: view === 'list' ? primaryColor : bgPaper,
                  border: `1px solid ${view === 'list' ? primaryColor : borderColor}`,
                  color: '#fff'
                }}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>
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
        {loading && deals.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Pipeline View */}
        {view === 'pipeline' && deals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-6 gap-4"
          >
            {DEAL_STAGES.map((stage) => {
              const stageDeals = getDealsByStage(stage);
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
              const colors = STAGE_COLORS[stage] ?? STAGE_COLORS.prospecting;

              return (
                <div
                  key={stage}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
                >
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-white capitalize mb-1">
                      {stage.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stageDeals.length} deals • {formatCurrency(stageValue)}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        onClick={() => router.push(`/workspace/${orgId}/deals/${deal.id}`)}
                        className="p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
                        style={{ backgroundColor: colors.bg, border: `1px solid ${colors.text}30` }}
                      >
                        <div className="text-sm font-medium text-white mb-1">{deal.name}</div>
                        <div className="text-xs text-gray-400 mb-2">{getCompanyName(deal)}</div>
                        <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: colors.text }}>
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(deal.value ?? 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* List View */}
        {view === 'list' && deals.length > 0 && (
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
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Deal</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Company</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Stage</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Value</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal, idx) => {
                  const colors = STAGE_COLORS[deal.stage ?? 'prospecting'] ?? STAGE_COLORS.prospecting;
                  return (
                    <tr
                      key={deal.id}
                      style={{ borderBottom: idx < deals.length - 1 ? `1px solid ${borderColor}` : 'none' }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{deal.name}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{getCompanyName(deal)}</td>
                      <td className="px-6 py-4">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {(deal.stage ?? 'prospecting').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white font-semibold">{formatCurrency(deal.value ?? 0)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => router.push(`/workspace/${orgId}/deals/${deal.id}`)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && deals.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}10`, border: '1px solid #ffffff10' }}
            >
              <Briefcase className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No deals found</div>
            <div className="text-gray-400">This organization has no deals yet.</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
