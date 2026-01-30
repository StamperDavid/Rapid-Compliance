'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Target,
  TrendingUp,
  DollarSign,
  Briefcase,
  Loader2,
  BarChart3
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

interface PipelineData {
  totalValue: number;
  dealsCount: number;
  winRate: number;
  avgDealSize: number;
  avgCycleTime?: number;
  stageBreakdown?: { stage: string; count: number; value: number }[];
}

/**
 * Admin Support View: Pipeline Analytics
 * Detailed pipeline analytics for any tenant organization.
 */
export default function AdminOrgPipelineAnalyticsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/analytics-pipeline/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/pipeline?orgId=${orgId}&period=${selectedPeriod}`);
        const data = await response.json() as { success: boolean; analytics: PipelineData };
        if (data.success) {
          setPipelineData(data.analytics);
        }
      } catch (error) {
        logger.error('Failed to load pipeline:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/analytics-pipeline/page.tsx' });
      } finally {
        setLoading(false);
      }
    };
    void loadPipeline();
  }, [orgId, selectedPeriod]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const periods = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#000' }}>
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link
          href={`/admin/organizations/${orgId}/analytics`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Analytics
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
              Pipeline analytics for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
            </div>
          </div>
          {canManageOrg && (
            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">Full Access</div>
          )}
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#3b82f6' }}>
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Pipeline Analytics</h1>
                <p className="text-gray-400">Deal flow and conversion metrics</p>
              </div>
            </div>

            <div className="flex gap-2">
              {periods.map((period) => (
                <button
                  key={period.key}
                  onClick={() => setSelectedPeriod(period.key as typeof selectedPeriod)}
                  className="px-4 py-2 rounded-xl font-medium transition-all"
                  style={{
                    backgroundColor: selectedPeriod === period.key ? primaryColor : bgPaper,
                    border: `1px solid ${selectedPeriod === period.key ? primaryColor : borderColor}`,
                    color: '#fff'
                  }}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                    <DollarSign className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-sm text-gray-400">Pipeline Value</div>
                </div>
                <div className="text-3xl font-bold text-white">{formatCurrency(pipelineData?.totalValue ?? 0)}</div>
                <div className="text-sm text-gray-500 mt-2">Total in pipeline</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
                    <Briefcase className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-sm text-gray-400">Active Deals</div>
                </div>
                <div className="text-3xl font-bold text-white">{pipelineData?.dealsCount ?? 0}</div>
                <div className="text-sm text-gray-500 mt-2">In progress</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-sm text-gray-400">Win Rate</div>
                </div>
                <div className="text-3xl font-bold text-white">{(pipelineData?.winRate ?? 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-500 mt-2">Conversion rate</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20">
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-sm text-gray-400">Avg Deal Size</div>
                </div>
                <div className="text-3xl font-bold text-white">{formatCurrency(pipelineData?.avgDealSize ?? 0)}</div>
                <div className="text-sm text-gray-500 mt-2">Per deal</div>
              </motion.div>
            </div>

            {/* Stage Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-6 rounded-xl" style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}>
              <h3 className="text-lg font-semibold text-white mb-6">Pipeline by Stage</h3>
              <div className="grid grid-cols-6 gap-4">
                {['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].map((stage) => (
                  <div key={stage} className="text-center p-4 rounded-xl" style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}>
                    <div className="text-lg font-bold text-white mb-1">-</div>
                    <div className="text-xs text-gray-500 capitalize">{stage}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Links */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex gap-4">
              <Link
                href={`/admin/organizations/${orgId}/deals`}
                className="flex-1 p-4 rounded-xl transition-all hover:scale-[1.02] flex items-center gap-4"
                style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
              >
                <Briefcase className="w-8 h-8 text-blue-400" />
                <div>
                  <div className="text-white font-medium">View All Deals</div>
                  <div className="text-sm text-gray-500">See complete pipeline</div>
                </div>
              </Link>
              <Link
                href={`/admin/organizations/${orgId}/leads`}
                className="flex-1 p-4 rounded-xl transition-all hover:scale-[1.02] flex items-center gap-4"
                style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
              >
                <Target className="w-8 h-8 text-purple-400" />
                <div>
                  <div className="text-white font-medium">View Leads</div>
                  <div className="text-sm text-gray-500">Lead to deal conversion</div>
                </div>
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
