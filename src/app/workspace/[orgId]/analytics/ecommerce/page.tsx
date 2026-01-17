'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';;

export default function EcommerceAnalyticsPage() {
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
      const response = await fetch(`/api/analytics/ecommerce?orgId=${orgId}`);
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error: unknown) {
      logger.error('Failed to load analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/workspace/${orgId}/analytics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Analytics
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              E-Commerce Analytics
            </h1>
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              Track orders, revenue, conversion rates, and product performance
            </p>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>Loading analytics...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Orders</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.totalOrders ?? 0}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Revenue</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.totalRevenue ? formatCurrency(analytics.totalRevenue) : '$0'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Order Value</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.avgOrderValue ? formatCurrency(analytics.avgOrderValue) : '$0'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Conversion Rate</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.conversionRate ? formatPercent(analytics.conversionRate) : '0%'}
                  </div>
                </div>
              </div>

              {analytics?.topProducts && analytics.topProducts.length > 0 && (
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
                    Top Products
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #333' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Product</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Units Sold</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topProducts.map((product: any, index: number) => (
                          <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#fff' }}>{product.name}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#999' }}>{product.unitsSold}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#fff', fontWeight: '600' }}>
                              {formatCurrency(product.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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





