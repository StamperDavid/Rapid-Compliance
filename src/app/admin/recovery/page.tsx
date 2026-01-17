'use client';

/**
 * Admin Recovery Dashboard
 *
 * Primary view for Lost Leads Recovery analytics.
 * Revenue Officer AI headquarters.
 */

import { useState, useEffect, useCallback } from 'react';
import { RecoveryAnalytics, type RecoveryMetrics } from '@/components/orchestrator/RecoveryAnalytics';
import { RecoveryInsights, type RecoveryInsight } from '@/components/orchestrator/RecoveryInsights';
import { motion } from 'framer-motion';
import { RefreshCw, Download, Settings } from 'lucide-react';

export default function AdminRecoveryPage() {
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null);
  const [insights, setInsights] = useState<RecoveryInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const loadRecoveryData = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual endpoint
      await new Promise<void>((resolve) => { setTimeout(resolve, 800); });

      // Mock data - production would fetch from /api/admin/recovery
      const mockMetrics: RecoveryMetrics = {
        period: dateRange,
        totalDropOffs: 234,
        totalRecovered: 89,
        recoveryRate: 38.03,
        channelPerformance: [
          {
            channel: 'email',
            attempts: 156,
            recovered: 47,
            conversionRate: 30.13,
            avgTimeToRecovery: 48,
            revenueRecovered: 14100,
          },
          {
            channel: 'sms',
            attempts: 89,
            recovered: 28,
            conversionRate: 31.46,
            avgTimeToRecovery: 24,
            revenueRecovered: 8400,
          },
          {
            channel: 'voice',
            attempts: 45,
            recovered: 12,
            conversionRate: 26.67,
            avgTimeToRecovery: 12,
            revenueRecovered: 3600,
          },
          {
            channel: 'push',
            attempts: 34,
            recovered: 2,
            conversionRate: 5.88,
            avgTimeToRecovery: 72,
            revenueRecovered: 600,
          },
        ],
        dropOffReasons: [
          {
            stage: 'trial_expired',
            label: 'Trial Expired',
            description: 'Did not convert before trial ended',
            count: 78,
            percentage: 33.33,
          },
          {
            stage: 'price_objection',
            label: 'Price Concerns',
            description: 'Pricing perceived as too high',
            count: 56,
            percentage: 23.93,
          },
          {
            stage: 'feature_confusion',
            label: 'Feature Confusion',
            description: 'Could not figure out how to use platform',
            count: 45,
            percentage: 19.23,
          },
          {
            stage: 'poor_engagement',
            label: 'Poor Engagement',
            description: 'Logged in but never took action',
            count: 34,
            percentage: 14.53,
          },
          {
            stage: 'payment_failed',
            label: 'Payment Failed',
            description: 'Credit card declined or expired',
            count: 21,
            percentage: 8.97,
          },
        ],
        avgTimeToRecovery: 36,
        avgAttemptsPerRecovery: 2.3,
        totalRevenueRecovered: 26700,
        avgRevenuePerRecoveredLead: 300,
        projectedAnnualRecovery: 320400,
        topIndustries: [
          { industry: 'SaaS & Technology', recoveryRate: 45.2, totalRecovered: 28 },
          { industry: 'E-commerce & Retail', recoveryRate: 41.8, totalRecovered: 23 },
          { industry: 'Real Estate', recoveryRate: 38.9, totalRecovered: 18 },
        ],
      };

      const mockInsights: RecoveryInsight[] = [
        {
          id: '1',
          type: 'success',
          title: 'SMS Recovery Outperforming Email',
          description:
            'SMS recovery channel is converting at 31.5%, 1.3 percentage points higher than email. SMS also recovers leads 50% faster.',
          metric: 'SMS: 31.5% vs Email: 30.1%',
          recommendation:
            'Increase SMS budget allocation by 20% and reduce email attempts for faster conversions.',
          priority: 'high',
        },
        {
          id: '2',
          type: 'opportunity',
          title: 'Feature Confusion is Top Recoverable Stage',
          description:
            '45 leads (19% of drop-offs) left due to feature confusion. These leads showed initial interest but got stuck.',
          metric: '45 leads dropped at onboarding',
          recommendation:
            'Deploy targeted video tutorials via email recovery sequence. Create interactive walkthroughs.',
          priority: 'critical',
        },
        {
          id: '3',
          type: 'warning',
          title: 'Push Notifications Underperforming',
          description:
            'Push notification recovery rate is only 5.9%, significantly below other channels.',
          metric: 'Push: 5.9% conversion (24% below average)',
          recommendation:
            'A/B test push notification copy and timing. Consider pausing if no improvement in 14 days.',
          priority: 'medium',
        },
        {
          id: '4',
          type: 'alert',
          title: 'Price Objections Rising',
          description:
            'Price-related drop-offs increased 18% compared to last period. 56 leads cited pricing as primary concern.',
          metric: '+18% price objections vs last period',
          recommendation:
            'Create recovery sequence highlighting ROI calculator. Offer flexible payment plans.',
          priority: 'high',
        },
        {
          id: '5',
          type: 'success',
          title: 'SaaS Industry Shows Highest Recovery',
          description:
            'SaaS & Technology companies have a 45.2% recovery rate, 7 points above platform average.',
          metric: 'SaaS Recovery: 45.2% (28 leads)',
          recommendation:
            'Replicate SaaS recovery strategy for other B2B industries. Emphasize demo scheduling.',
          priority: 'low',
        },
      ];

      setMetrics(mockMetrics);
      setInsights(mockInsights);
    } catch (error) {
      console.error('Error loading recovery data:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void loadRecoveryData();
  }, [loadRecoveryData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 mx-auto mb-4"
          >
            <RefreshCw className="w-12 h-12 text-indigo-500" />
          </motion.div>
          <p className="text-white">Loading recovery analytics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <p className="text-white text-xl mb-2">Failed to load dashboard</p>
          <button
            onClick={() => { void loadRecoveryData(); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Recovery Analytics</h1>
            <p className="text-gray-400">
              Track and optimize your lost leads recovery performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <button
              onClick={() => { void loadRecoveryData(); }}
              className="p-2 bg-black/40 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 bg-black/40 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 bg-black/40 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Analytics (2/3 width) */}
        <div className="lg:col-span-2">
          <RecoveryAnalytics metrics={metrics} />
        </div>

        {/* Right Column - Insights (1/3 width) */}
        <div className="lg:col-span-1">
          <RecoveryInsights insights={insights} />
        </div>
      </div>
    </div>
  );
}
