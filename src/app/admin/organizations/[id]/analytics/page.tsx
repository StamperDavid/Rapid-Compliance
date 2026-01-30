'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  BarChart3,
  DollarSign,
  TrendingUp,
  Target,
  ShoppingCart,
  Zap,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import type { Organization } from '@/types/organization';

interface RevenueAnalytics {
  totalRevenue: number;
  growth: number;
}

interface PipelineAnalytics {
  totalValue: number;
  dealsCount: number;
  winRate: number;
  avgDealSize: number;
}

interface EcommerceAnalytics {
  totalOrders: number;
  totalRevenue: number;
}

interface WorkflowsAnalytics {
  totalRuns: number;
  successRate: number;
}

interface AnalyticsData {
  revenue: RevenueAnalytics | null;
  pipeline: PipelineAnalytics | null;
  ecommerce: EcommerceAnalytics | null;
  workflows: WorkflowsAnalytics | null;
}

interface ApiResponse<T> {
  success: boolean;
  analytics: T;
}

/**
 * Admin Support View: Organization Analytics
 * View analytics dashboard for any tenant organization.
 */
export default function AdminOrgAnalyticsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
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
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/analytics/page.tsx' });
      } finally {
        setOrgLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const [revenue, pipeline, ecommerce, workflows] = await Promise.all([
          fetch(`/api/analytics/revenue?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()) as Promise<ApiResponse<RevenueAnalytics>>,
          fetch(`/api/analytics/pipeline?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()) as Promise<ApiResponse<PipelineAnalytics>>,
          fetch(`/api/analytics/ecommerce?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()) as Promise<ApiResponse<EcommerceAnalytics>>,
          fetch(`/api/analytics/workflows?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()) as Promise<ApiResponse<WorkflowsAnalytics>>,
        ]);

        setAnalytics({
          revenue: revenue.success ? revenue.analytics : null,
          pipeline: pipeline.success ? pipeline.analytics : null,
          ecommerce: ecommerce.success ? ecommerce.analytics : null,
          workflows: workflows.success ? workflows.analytics : null,
        });
      } catch (error) {
        logger.error('Failed to load analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/analytics/page.tsx' });
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();
  }, [orgId, selectedPeriod]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const periods = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: 'all', label: 'All Time' },
  ];

  const analyticsCards = [
    {
      title: 'Revenue',
      icon: DollarSign,
      color: '#10b981',
      href: `/admin/organizations/${orgId}/analytics-revenue`,
      value: analytics?.revenue ? formatCurrency(analytics.revenue.totalRevenue) : '-',
      change: analytics?.revenue?.growth ?? 0,
    },
    {
      title: 'Pipeline',
      icon: Target,
      color: '#3b82f6',
      href: `/admin/organizations/${orgId}/analytics-pipeline`,
      value: analytics?.pipeline ? formatCurrency(analytics.pipeline.totalValue) : '-',
      subtitle: analytics?.pipeline ? `${analytics.pipeline.dealsCount} deals` : undefined,
    },
    {
      title: 'Win Rate',
      icon: TrendingUp,
      color: '#8b5cf6',
      value: analytics?.pipeline ? formatPercent(analytics.pipeline.winRate) : '-',
    },
    {
      title: 'E-Commerce',
      icon: ShoppingCart,
      color: '#f59e0b',
      value: analytics?.ecommerce ? formatCurrency(analytics.ecommerce.totalRevenue) : '-',
      subtitle: analytics?.ecommerce ? `${analytics.ecommerce.totalOrders} orders` : undefined,
    },
    {
      title: 'Workflows',
      icon: Zap,
      color: '#ec4899',
      value: analytics?.workflows ? `${analytics.workflows.totalRuns}` : '-',
      subtitle: analytics?.workflows ? `${formatPercent(analytics.workflows.successRate)} success` : undefined,
    },
  ];

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
              Viewing analytics for: {orgLoading ? 'Loading...' : (organization?.name ?? orgId)}
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
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Analytics</h1>
                <p className="text-gray-400">
                  Business intelligence and performance metrics
                </p>
              </div>
            </div>

            {/* Period Selector */}
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

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Analytics Cards */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {analyticsCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="p-6 rounded-xl transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${card.color}20` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: card.color }} />
                    </div>
                    {card.change !== undefined && card.change !== 0 && (
                      <div className={`flex items-center gap-1 text-sm ${card.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        <TrendingUp className={`w-4 h-4 ${card.change < 0 ? 'rotate-180' : ''}`} />
                        {formatPercent(Math.abs(card.change))}
                      </div>
                    )}
                  </div>

                  <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
                  <div className="text-sm text-gray-400">{card.title}</div>
                  {card.subtitle && (
                    <div className="text-xs text-gray-500 mt-1">{card.subtitle}</div>
                  )}

                  {card.href && (
                    <Link
                      href={card.href}
                      className="mt-4 flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: card.color }}
                    >
                      View Details
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-6 rounded-xl"
          style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}` }}
        >
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Detailed Reports
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href={`/admin/organizations/${orgId}/analytics-revenue`}
              className="p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}
            >
              <DollarSign className="w-6 h-6 text-emerald-400 mb-2" />
              <div className="text-white font-medium">Revenue</div>
              <div className="text-xs text-gray-500">Detailed breakdown</div>
            </Link>
            <Link
              href={`/admin/organizations/${orgId}/analytics-pipeline`}
              className="p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}
            >
              <Target className="w-6 h-6 text-blue-400 mb-2" />
              <div className="text-white font-medium">Pipeline</div>
              <div className="text-xs text-gray-500">Deal analysis</div>
            </Link>
            <Link
              href={`/admin/organizations/${orgId}/leads`}
              className="p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}
            >
              <TrendingUp className="w-6 h-6 text-purple-400 mb-2" />
              <div className="text-white font-medium">Leads</div>
              <div className="text-xs text-gray-500">Lead performance</div>
            </Link>
            <Link
              href={`/admin/organizations/${orgId}/deals`}
              className="p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#0a0a0a', border: `1px solid ${borderColor}` }}
            >
              <ShoppingCart className="w-6 h-6 text-amber-400 mb-2" />
              <div className="text-white font-medium">Deals</div>
              <div className="text-xs text-gray-500">Sales metrics</div>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
