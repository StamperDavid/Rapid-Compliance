'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';

export default function AnalyticsDashboard() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Load all analytics in parallel
      const [revenue, pipeline, ecommerce, workflows] = await Promise.all([
        fetch(`/api/analytics/revenue?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()),
        fetch(`/api/analytics/pipeline?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()),
        fetch(`/api/analytics/ecommerce?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()),
        fetch(`/api/analytics/workflows?orgId=${orgId}&period=${selectedPeriod}`).then(r => r.json()),
      ]);

      setAnalytics({
        revenue: revenue.success ? revenue.analytics : null,
        pipeline: pipeline.success ? pipeline.analytics : null,
        ecommerce: ecommerce.success ? ecommerce.analytics : null,
        workflows: workflows.success ? workflows.analytics : null,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  if (loading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ color: '#999', fontSize: '1rem' }}>Loading analytics...</div>
      </div>
    );
  }

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

  return (
      <div style={{ padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                Analytics Dashboard
              </h1>
              <p style={{ color: '#999', fontSize: '0.875rem' }}>
                Track revenue, pipeline, e-commerce, and workflow performance
              </p>
            </div>

            {/* Period Selector */}
            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', padding: '0.25rem' }}>
              {(['7d', '30d', '90d', 'all'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: selectedPeriod === period ? primaryColor : 'transparent',
                    color: selectedPeriod === period ? '#fff' : '#999',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                >
                  {period === 'all' ? 'All Time' : period.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Revenue
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                {analytics?.revenue?.totalRevenue ? formatCurrency(analytics.revenue.totalRevenue) : '$0'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
                {analytics?.revenue?.growth ? `+${formatPercent(analytics.revenue.growth)} vs previous period` : 'No data'}
              </div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pipeline Value
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                {analytics?.pipeline?.totalValue ? formatCurrency(analytics.pipeline.totalValue) : '$0'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999' }}>
                {analytics?.pipeline?.dealsCount ? `${formatNumber(analytics.pipeline.dealsCount)} deals in pipeline` : 'No deals'}
              </div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Win Rate
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                {analytics?.pipeline?.winRate ? formatPercent(analytics.pipeline.winRate) : '0%'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999' }}>
                {analytics?.pipeline?.avgDealSize ? `Avg deal: ${formatCurrency(analytics.pipeline.avgDealSize)}` : 'No data'}
              </div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                E-Commerce Orders
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                {analytics?.ecommerce?.totalOrders ? formatNumber(analytics.ecommerce.totalOrders) : '0'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999' }}>
                {analytics?.ecommerce?.totalRevenue ? formatCurrency(analytics.ecommerce.totalRevenue) : '$0'}
              </div>
            </div>
          </div>

          {/* Quick Access Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <Link href={`/workspace/${orgId}/analytics/revenue`} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '1rem',
                padding: '2rem',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>💰</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                  Revenue Analytics
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.6' }}>
                  Track revenue by source, product, rep, and time. View trends and forecasts.
                </p>
                <div style={{ marginTop: '1rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '600' }}>
                  View Details →
                </div>
              </div>
            </Link>

            <Link href={`/workspace/${orgId}/analytics/pipeline`} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '1rem',
                padding: '2rem',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>📊</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                  Pipeline Analytics
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.6' }}>
                  Analyze pipeline stages, velocity, conversion rates, and forecasts.
                </p>
                <div style={{ marginTop: '1rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '600' }}>
                  View Details →
                </div>
              </div>
            </Link>

            <Link href={`/workspace/${orgId}/analytics/ecommerce`} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '1rem',
                padding: '2rem',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🛒</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                  E-Commerce Analytics
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.6' }}>
                  Track orders, conversions, cart abandonment, and product performance.
                </p>
                <div style={{ marginTop: '1rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '600' }}>
                  View Details →
                </div>
              </div>
            </Link>

            <Link href={`/workspace/${orgId}/analytics/workflows`} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '1rem',
                padding: '2rem',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚡</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                  Workflow Analytics
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.6' }}>
                  Monitor automation execution, success rates, and error patterns.
                </p>
                <div style={{ marginTop: '1rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '600' }}>
                  View Details →
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
  );
}



















