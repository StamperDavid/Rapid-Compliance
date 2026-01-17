'use client';

import React, { useState, useEffect, useCallback } from 'react';

import type { RevenueMetrics } from '@/types/subscription'
import { logger } from '@/lib/logger/logger';

export default function RevenueAdminPage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const { calculateRevenueMetrics } = await import('@/lib/admin/subscription-manager');
      const metricsData = await calculateRevenueMetrics(
        dateRange.startDate,
        dateRange.endDate
      );

      // Ensure all numeric fields have default values to prevent .toFixed() crashes
      if (metricsData) {
        metricsData.mrr = metricsData.mrr ?? 0;
        metricsData.arr = metricsData.arr ?? 0;
        metricsData.mrrGrowth = metricsData.mrrGrowth ?? 0;
        metricsData.arrGrowth = metricsData.arrGrowth ?? 0;
        metricsData.totalCustomers = metricsData.totalCustomers ?? 0;
        metricsData.newCustomers = metricsData.newCustomers ?? 0;
        metricsData.churnedCustomers = metricsData.churnedCustomers ?? 0;
        metricsData.churnRate = metricsData.churnRate ?? 0;
        metricsData.revenueChurnRate = metricsData.revenueChurnRate ?? 0;
        metricsData.totalRevenue = metricsData.totalRevenue ?? 0;
        metricsData.averageRevenuePerCustomer = metricsData.averageRevenuePerCustomer ?? 0;
        metricsData.revenueByPlan = metricsData.revenueByPlan ?? [];
      }

      setMetrics(metricsData);
    } catch (error) {
      logger.error('Failed to load metrics', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      // Set empty metrics instead of null to show "No data" state
      setMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Revenue Dashboard
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Track MRR, ARR, churn, and growth
        </p>
      </div>

      {/* Date Range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.5rem' }}>
        <label style={{ color: '#999', fontSize: '0.875rem' }}>From:</label>
        <input
          type="date"
          value={dateRange.startDate}
          onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0a0a0a',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        />
        <label style={{ color: '#999', fontSize: '0.875rem' }}>To:</label>
        <input
          type="date"
          value={dateRange.endDate}
          onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0a0a0a',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          Loading metrics...
        </div>
      ) : metrics ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ padding: '1.5rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Monthly Recurring Revenue</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                ${metrics.mrr.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.875rem', color: metrics.mrrGrowth >= 0 ? '#10b981' : '#ef4444' }}>
                {metrics.mrrGrowth >= 0 ? '↑' : '↓'} {Math.abs(metrics.mrrGrowth).toFixed(1)}% from last period
              </div>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Annual Recurring Revenue</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                ${metrics.arr.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.875rem', color: metrics.arrGrowth >= 0 ? '#10b981' : '#ef4444' }}>
                {metrics.arrGrowth >= 0 ? '↑' : '↓'} {Math.abs(metrics.arrGrowth).toFixed(1)}% from last period
              </div>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Total Customers</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                {metrics.totalCustomers}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#999' }}>
                +{metrics.newCustomers} new this period
              </div>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Churn Rate</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                {metrics.churnRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.875rem', color: '#999' }}>
                {metrics.churnedCustomers} churned
              </div>
            </div>
          </div>

          {/* Revenue by Plan */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Revenue by Plan</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {metrics.revenueByPlan.map((plan) => (
                <div key={plan.planId} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600', color: '#fff' }}>{plan.planName}</span>
                      <span style={{ color: '#fff' }}>${plan.mrr.toLocaleString()} MRR</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ flex: 1, height: '12px', backgroundColor: '#333', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            background: 'linear-gradient(to right, #9333ea, #db2777)',
                            width: `${plan.percentage}%`
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#999', width: '4rem', textAlign: 'right' }}>
                        {(plan.percentage ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', color: '#999' }}>Customers</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff' }}>{plan.customers}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ padding: '1.5rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Avg Revenue Per Customer</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                ${(metrics.averageRevenuePerUser ?? metrics.averageRevenuePerCustomer ?? 0).toFixed(2)}
              </div>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Total Revenue (Period)</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                ${metrics.totalRevenue.toLocaleString()}
              </div>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Revenue Churn Rate</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                {metrics.revenueChurnRate.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Customer Growth */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Customer Growth</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#10b98133', border: '1px solid #10b98144', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>+{metrics.newCustomers}</div>
                <div style={{ fontSize: '0.875rem', color: '#999' }}>New Customers</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#3b82f633', border: '1px solid #3b82f644', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{metrics.totalCustomers}</div>
                <div style={{ fontSize: '0.875rem', color: '#999' }}>Total Customers</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#ef444433', border: '1px solid #ef444444', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>-{metrics.churnedCustomers}</div>
                <div style={{ fontSize: '0.875rem', color: '#999' }}>Churned Customers</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
          <div style={{ fontSize: '1.25rem', color: '#999' }}>No data available</div>
        </div>
      )}
    </div>
  );
}
