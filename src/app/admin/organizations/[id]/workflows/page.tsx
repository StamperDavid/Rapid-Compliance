'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Zap,
  Search,
  Eye,
  Play,
  Pause,
  Loader2,
  AlertCircle,
  ChevronDown,
  Clock,
  Archive
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';
import type { Workflow } from '@/types/workflow';

/**
 * Admin Support View: Organization Workflows
 * View and manage workflows for any tenant organization.
 */
export default function AdminOrgWorkflowsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/workflows/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  const fetchWorkflows = useCallback(async (lastDoc?: unknown) => {
    const { getWorkflows } = await import('@/lib/workflows/workflow-service');
    return getWorkflows(orgId, 'default', undefined, { pageSize: 50, lastDoc: lastDoc as undefined });
  }, [orgId]);

  const {
    data: workflows,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Workflow>({ fetchFn: fetchWorkflows });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getStatusBadge = (status: string) => {
    const styles = {
      active: { bg: '#22c55e20', border: '#22c55e40', color: '#4ade80', icon: Play },
      paused: { bg: '#f59e0b20', border: '#f59e0b40', color: '#fbbf24', icon: Pause },
      draft: { bg: '#6b728020', border: '#6b728040', color: '#9ca3af', icon: Clock },
      archived: { bg: '#64748b20', border: '#64748b40', color: '#94a3b8', icon: Archive },
    };
    const style = styles[status as keyof typeof styles] ?? styles.draft;
    const Icon = style.icon;

    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium capitalize"
        style={{ backgroundColor: style.bg, border: `1px solid ${style.border}`, color: style.color }}
      >
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const filteredWorkflows = workflows.filter(workflow => {
    if (!searchQuery) {
      return true;
    }
    return workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (workflow.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
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
          <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', backgroundColor: `${primaryColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Admin Support View</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              Viewing workflows for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
            </div>
          </div>
          {canManageOrg && (
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>
          )}
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#f59e0b' }}>
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Workflows</h1>
              <p className="text-gray-400">{workflows.length} automation workflows</p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-gray-500 focus:outline-none"
              style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
            />
          </div>
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {loading && workflows.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {workflows.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => router.push(`/workspace/${orgId}/workflows/${workflow.id}`)}
                className="p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
                style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20">
                      <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{workflow.name}</div>
                      {workflow.trigger && (
                        <div className="text-xs text-gray-500">Trigger: {workflow.trigger.type}</div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(workflow.status)}
                </div>

                {workflow.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{workflow.description}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>{workflow.actions?.length ?? 0} actions</span>
                    <span>{workflow.stats?.totalRuns ?? 0} runs</span>
                  </div>
                  <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <Eye className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {hasMore && workflows.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center">
            <button
              onClick={() => void loadMore()}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              style={{ backgroundColor: '#ffffff10', border: '1px solid #ffffff20', color: '#fff' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </motion.div>
        )}

        {!loading && workflows.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#f59e0b10', border: '1px solid #ffffff10' }}>
              <Zap className="w-10 h-10 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">No workflows found</div>
            <div className="text-gray-400">This organization has no workflows yet.</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
