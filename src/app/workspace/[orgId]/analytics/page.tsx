'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  Target,
  ShoppingCart,
  BarChart3,
  Zap,
  ArrowRight,
  TrendingDown,
  Activity
} from 'lucide-react';
import { logger } from '@/lib/logger/logger';

// Analytics data types
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

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function AnalyticsDashboard() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        // Load all analytics in parallel
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
      } catch (error: unknown) {
        logger.error('Failed to load analytics:', error instanceof Error ? error : undefined, { file: 'page.tsx' });
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();
  }, [orgId, selectedPeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-indigo-500 animate-pulse" />
          <div className="text-white/60 text-lg">Loading analytics...</div>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: analytics?.revenue?.totalRevenue ? formatCurrency(analytics.revenue.totalRevenue) : '$0',
      change: analytics?.revenue?.growth ? `+${formatPercent(analytics.revenue.growth)} vs previous period` : 'No data',
      positive: (analytics?.revenue?.growth ?? 0) > 0,
      icon: DollarSign,
    },
    {
      label: 'Pipeline Value',
      value: analytics?.pipeline?.totalValue ? formatCurrency(analytics.pipeline.totalValue) : '$0',
      change: analytics?.pipeline?.dealsCount ? `${formatNumber(analytics.pipeline.dealsCount)} deals in pipeline` : 'No deals',
      positive: null,
      icon: BarChart3,
    },
    {
      label: 'Win Rate',
      value: analytics?.pipeline?.winRate ? formatPercent(analytics.pipeline.winRate) : '0%',
      change: analytics?.pipeline?.avgDealSize ? `Avg deal: ${formatCurrency(analytics.pipeline.avgDealSize)}` : 'No data',
      positive: null,
      icon: Target,
    },
    {
      label: 'E-Commerce Orders',
      value: analytics?.ecommerce?.totalOrders ? formatNumber(analytics.ecommerce.totalOrders) : '0',
      change: analytics?.ecommerce?.totalRevenue ? formatCurrency(analytics.ecommerce.totalRevenue) : '$0',
      positive: null,
      icon: ShoppingCart,
    },
  ];

  const quickAccessCards = [
    {
      title: 'Revenue Analytics',
      description: 'Track revenue by source, product, rep, and time. View trends and forecasts.',
      href: `/workspace/${orgId}/analytics/revenue`,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-green-500',
    },
    {
      title: 'Pipeline Analytics',
      description: 'Analyze pipeline stages, velocity, conversion rates, and forecasts.',
      href: `/workspace/${orgId}/analytics/pipeline`,
      icon: BarChart3,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'E-Commerce Analytics',
      description: 'Track orders, conversions, cart abandonment, and product performance.',
      href: `/workspace/${orgId}/analytics/ecommerce`,
      icon: ShoppingCart,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Workflow Analytics',
      description: 'Monitor automation execution, success rates, and error patterns.',
      href: `/workspace/${orgId}/analytics/workflows`,
      icon: Zap,
      gradient: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="bg-black min-h-screen p-8 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-8"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 flex-shrink-0">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Analytics Dashboard
              </h1>
              <p className="text-white/60 text-sm">
                Track revenue, pipeline, e-commerce, and workflow performance
              </p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-1.5">
            {(['7d', '30d', '90d', 'all'] as const).map((period) => (
              <motion.button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  selectedPeriod === period
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {period === 'all' ? 'All Time' : period.toUpperCase()}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
        >
          {kpiCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={index}
                variants={item}
                whileHover={{ scale: 1.02, y: -4 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-indigo-500/50 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-white/60 uppercase tracking-wider font-semibold">
                    {card.label}
                  </div>
                  <Icon className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {card.value}
                </div>
                <div className={`text-xs flex items-center gap-1 ${
                  card.positive === true ? 'text-emerald-400' :
                  card.positive === false ? 'text-red-400' :
                  'text-white/60'
                }`}>
                  {card.positive === true && <TrendingUp className="w-3 h-3" />}
                  {card.positive === false && <TrendingDown className="w-3 h-3" />}
                  {card.change}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Quick Access Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {quickAccessCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={index}
                variants={item}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <Link href={card.href} className="block">
                  <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-8 hover:border-indigo-500/50 transition-all group">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-6`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-indigo-400 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm text-white/60 leading-relaxed mb-6">
                      {card.description}
                    </p>
                    <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold group-hover:gap-3 transition-all">
                      View Details
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
