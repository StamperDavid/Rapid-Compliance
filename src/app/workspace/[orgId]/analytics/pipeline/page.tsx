'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';

export default function PipelineAnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  
  const { theme } = useOrgTheme();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/pipeline?orgId=${orgId}`);
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <AdminBar />
      
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/workspace/${orgId}/analytics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Analytics
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              Pipeline Analytics
            </h1>
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              Track pipeline stages, velocity, and conversion rates
            </p>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>Loading analytics...</div>
          ) : (
            <>
              {/* Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Pipeline Value</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.totalValue ? formatCurrency(analytics.totalValue) : '$0'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Deals in Pipeline</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.dealsCount || 0}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Win Rate</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.winRate ? formatPercent(analytics.winRate) : '0%'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Deal Size</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.avgDealSize ? formatCurrency(analytics.avgDealSize) : '$0'}
                  </div>
                </div>
              </div>

              {/* Pipeline by Stage */}
              {analytics?.byStage && analytics.byStage.length > 0 && (
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
                    Pipeline by Stage
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analytics.byStage.map((stage: any, index: number) => (
                      <div key={index}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', color: '#fff' }}>{stage.stage}</span>
                          <span style={{ fontSize: '0.875rem', color: '#999' }}>
                            {formatCurrency(stage.value)} ({stage.count} deals)
                          </span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${analytics.totalValue > 0 ? (stage.value / analytics.totalValue) * 100 : 0}%`,
                            height: '100%',
                            backgroundColor: primaryColor,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}














