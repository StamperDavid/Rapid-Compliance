'use client';

/**
 * RecoveryAnalytics Component
 *
 * Visual analytics dashboard for Lost Leads Recovery Rate and channel performance.
 * Primary KPI for the Revenue Officer AI.
 */

import { motion } from 'framer-motion';

export type RecoveryChannel = 'email' | 'sms' | 'voice' | 'push' | 'manual';

export interface ChannelPerformance {
  channel: RecoveryChannel;
  attempts: number;
  recovered: number;
  conversionRate: number;
  avgTimeToRecovery: number;
  revenueRecovered: number;
}

export interface DropOffReason {
  stage: string;
  label: string;
  description: string;
  count: number;
  percentage: number;
}

export interface RecoveryMetrics {
  period: string;
  totalDropOffs: number;
  totalRecovered: number;
  recoveryRate: number;
  channelPerformance: ChannelPerformance[];
  dropOffReasons: DropOffReason[];
  avgTimeToRecovery: number;
  avgAttemptsPerRecovery: number;
  totalRevenueRecovered: number;
  avgRevenuePerRecoveredLead: number;
  projectedAnnualRecovery: number;
  topIndustries: { industry: string; recoveryRate: number; totalRecovered: number }[];
}

interface RecoveryAnalyticsProps {
  metrics: RecoveryMetrics;
}

export function RecoveryAnalytics({ metrics }: RecoveryAnalyticsProps) {
  const getChannelIcon = (channel: RecoveryChannel): string => {
    const icons: Record<RecoveryChannel, string> = {
      email: '📧',
      sms: '📱',
      voice: '📞',
      push: '🔔',
      manual: '👤',
    };
    return icons[channel] || '📊';
  };

  const getChannelColor = (channel: RecoveryChannel): string => {
    const colors: Record<RecoveryChannel, string> = {
      email: 'var(--color-primary)',
      sms: 'var(--color-secondary)',
      voice: 'var(--color-accent)',
      push: 'var(--color-teal)',
      manual: 'var(--color-warning)',
    };
    return colors[channel] || 'var(--color-neutral-500)';
  };

  return (
    <div className="space-y-6">
      {/* Primary KPI - Lost Leads Recovered Rate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 backdrop-blur-xl p-8"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-2">Primary KPI</p>
              <h2 className="text-5xl font-bold text-white mb-1">
                {metrics.recoveryRate.toFixed(1)}%
              </h2>
              <p className="text-xl text-gray-300">Lost Leads Recovered Rate</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30">
              🎯
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <p className="text-gray-400 text-xs mb-1">Total Drop-offs</p>
              <p className="text-2xl font-bold text-white">{metrics.totalDropOffs.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Recovered</p>
              <p className="text-2xl font-bold text-emerald-400">
                {metrics.totalRecovered.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Revenue Impact</p>
              <p className="text-2xl font-bold text-yellow-400">
                ${metrics.totalRevenueRecovered.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Channel Performance Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl p-6"
      >
        <h3 className="text-white text-lg font-semibold mb-6">Recovery by Channel</h3>
        <div className="space-y-4">
          {metrics.channelPerformance
            .sort((a, b) => b.conversionRate - a.conversionRate)
            .map((channel, idx) => (
              <motion.div
                key={channel.channel}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className="relative"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getChannelIcon(channel.channel)}</span>
                    <div>
                      <p className="text-white font-medium capitalize">{channel.channel}</p>
                      <p className="text-gray-500 text-xs">
                        {channel.recovered} / {channel.attempts} attempts
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">
                      {channel.conversionRate.toFixed(1)}%
                    </p>
                    <p className="text-gray-500 text-xs">
                      Avg {channel.avgTimeToRecovery.toFixed(0)}h
                    </p>
                  </div>
                </div>
                <div className="h-3 bg-black/40 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(channel.conversionRate, 100)}%` }}
                    transition={{ duration: 1, delay: 0.2 + idx * 0.05 }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${getChannelColor(channel.channel)}DD, ${getChannelColor(channel.channel)})`,
                    }}
                  />
                </div>
                <div className="mt-1 text-right">
                  <span className="text-emerald-400 text-xs font-medium">
                    ${channel.revenueRecovered.toLocaleString()} recovered
                  </span>
                </div>
              </motion.div>
            ))}
        </div>
      </motion.div>

      {/* Drop-off Reasons Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl p-6"
      >
        <h3 className="text-white text-lg font-semibold mb-6">Why Leads Drop Off</h3>
        <div className="space-y-3">
          {metrics.dropOffReasons
            .sort((a, b) => b.count - a.count)
            .map((reason, idx) => (
              <motion.div
                key={reason.stage}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-black/20 hover:bg-white/5 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{reason.label}</p>
                  <p className="text-gray-500 text-xs">{reason.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-white font-bold">{reason.count}</p>
                    <p className="text-gray-500 text-xs">{reason.percentage.toFixed(1)}%</p>
                  </div>
                  <div className="w-12 h-12">
                    <svg className="transform -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="var(--color-bg-elevated)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="3"
                        strokeDasharray={`${reason.percentage} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
        </div>
      </motion.div>

      {/* Recovery Timeline Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl p-6"
      >
        <h3 className="text-white text-lg font-semibold mb-6">Recovery Timeline</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-black/20">
            <p className="text-gray-400 text-xs mb-1">Avg Time to Recovery</p>
            <p className="text-white text-2xl font-bold">
              {(metrics.avgTimeToRecovery / 24).toFixed(1)} <span className="text-sm">days</span>
            </p>
          </div>
          <div className="p-4 rounded-lg bg-black/20">
            <p className="text-gray-400 text-xs mb-1">Avg Attempts</p>
            <p className="text-white text-2xl font-bold">
              {metrics.avgAttemptsPerRecovery.toFixed(1)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-black/20">
            <p className="text-gray-400 text-xs mb-1">Avg Revenue/Lead</p>
            <p className="text-white text-2xl font-bold">
              ${metrics.avgRevenuePerRecoveredLead.toLocaleString()}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Top Performing Industries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl p-6"
      >
        <h3 className="text-white text-lg font-semibold mb-6">Top Recovery Industries</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.topIndustries.slice(0, 3).map((industry, idx) => (
            <motion.div
              key={industry.industry}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + idx * 0.1 }}
              className="p-4 rounded-lg bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-white/10"
            >
              <div className="text-3xl mb-2">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
              </div>
              <p className="text-white font-semibold mb-1">{industry.industry}</p>
              <p className="text-emerald-400 text-lg font-bold">
                {industry.recoveryRate.toFixed(1)}%
              </p>
              <p className="text-gray-500 text-xs">{industry.totalRecovered} recovered</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default RecoveryAnalytics;
