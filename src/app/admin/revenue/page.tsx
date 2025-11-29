'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { RevenueMetrics } from '@/types/subscription';

export default function RevenueAdminPage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const { calculateRevenueMetrics } = await import('@/lib/admin/subscription-manager');
      const metricsData = await calculateRevenueMetrics(
        dateRange.startDate,
        dateRange.endDate
      );
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Revenue Dashboard</h1>
              <p className="text-gray-400">Track MRR, ARR, churn, and growth</p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <label className="text-gray-400 text-sm">From:</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
          <label className="text-gray-400 text-sm">To:</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading metrics...</div>
          </div>
        ) : metrics ? (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Monthly Recurring Revenue</div>
                <div className="text-4xl font-bold text-white mb-1">
                  ${metrics.mrr.toLocaleString()}
                </div>
                <div className={`text-sm ${metrics.mrrGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {metrics.mrrGrowth >= 0 ? '↑' : '↓'} {Math.abs(metrics.mrrGrowth).toFixed(1)}% from last period
                </div>
              </div>

              <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Annual Recurring Revenue</div>
                <div className="text-4xl font-bold text-white mb-1">
                  ${metrics.arr.toLocaleString()}
                </div>
                <div className={`text-sm ${metrics.arrGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {metrics.arrGrowth >= 0 ? '↑' : '↓'} {Math.abs(metrics.arrGrowth).toFixed(1)}% from last period
                </div>
              </div>

              <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Total Customers</div>
                <div className="text-4xl font-bold text-white mb-1">
                  {metrics.totalCustomers}
                </div>
                <div className="text-sm text-gray-400">
                  +{metrics.newCustomers} new this period
                </div>
              </div>

              <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Churn Rate</div>
                <div className="text-4xl font-bold text-white mb-1">
                  {metrics.churnRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400">
                  {metrics.churnedCustomers} churned
                </div>
              </div>
            </div>

            {/* Revenue by Plan */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-6">Revenue by Plan</h2>
              <div className="space-y-4">
                {metrics.revenueByPlan.map((plan) => (
                  <div key={plan.planId} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">{plan.planName}</span>
                        <span className="text-white">${plan.mrr.toLocaleString()} MRR</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                            style={{ width: `${plan.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-16 text-right">
                          {plan.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Customers</div>
                      <div className="text-lg font-semibold text-white">{plan.customers}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Avg Revenue Per Customer</div>
                <div className="text-3xl font-bold text-white">
                  ${metrics.averageRevenuePerCustomer.toFixed(2)}
                </div>
              </div>

              <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Total Revenue (Period)</div>
                <div className="text-3xl font-bold text-white">
                  ${metrics.totalRevenue.toLocaleString()}
                </div>
              </div>

              <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Revenue Churn Rate</div>
                <div className="text-3xl font-bold text-white">
                  {metrics.revenueChurnRate.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Customer Growth */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-6">Customer Growth</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="text-3xl font-bold text-green-400">+{metrics.newCustomers}</div>
                  <div className="text-sm text-gray-400">New Customers</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400">{metrics.totalCustomers}</div>
                  <div className="text-sm text-gray-400">Total Customers</div>
                </div>
                <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="text-3xl font-bold text-red-400">-{metrics.churnedCustomers}</div>
                  <div className="text-sm text-gray-400">Churned Customers</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-xl text-gray-400">No data available</div>
          </div>
        )}
      </div>
    </div>
  );
}

