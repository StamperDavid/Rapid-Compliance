'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';;
import { PageTitle, SectionDescription } from '@/components/ui/typography';

interface TopProduct {
  name: string;
  unitsSold: number;
  revenue: number;
}

interface EcommerceAnalytics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate: number;
  topProducts: TopProduct[];
}

function isEcommerceAnalytics(data: unknown): data is EcommerceAnalytics {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.totalOrders === 'number' &&
    typeof obj.totalRevenue === 'number' &&
    typeof obj.avgOrderValue === 'number' &&
    typeof obj.conversionRate === 'number' &&
    Array.isArray(obj.topProducts)
  );
}

export default function EcommerceAnalyticsPage() {
  const { theme } = useOrgTheme();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [analytics, setAnalytics] = useState<EcommerceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/analytics/ecommerce');
      const data = await response.json() as { success?: boolean; analytics?: unknown };
      if (data.success && isEcommerceAnalytics(data.analytics)) {
        setAnalytics(data.analytics);
      }
    } catch (error: unknown) {
      logger.error('Failed to load analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    // Wait for Firebase auth to restore session before making API calls
    if (authLoading) { return; }
    void loadAnalytics();
  }, [loadAnalytics, authLoading]);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : 'var(--color-primary)';

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
    <div className="p-8 space-y-6">
      <div className="mb-8">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 text-sm font-medium no-underline mb-6"
          style={{ color: primaryColor }}
        >
          ← Back to Analytics
        </Link>
        <PageTitle className="mb-1">E-Commerce Analytics</PageTitle>
        <SectionDescription>Track orders, revenue, conversion rates, and product performance</SectionDescription>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Total Orders</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.totalOrders ?? 0}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Total Revenue</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.totalRevenue ? formatCurrency(analytics.totalRevenue) : '$0'}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Avg Order Value</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.avgOrderValue ? formatCurrency(analytics.avgOrderValue) : '$0'}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Conversion Rate</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.conversionRate ? formatPercent(analytics.conversionRate) : '0%'}
              </div>
            </div>
          </div>

          {analytics?.topProducts && analytics.topProducts.length > 0 && (
            <div className="bg-card border border-border-light rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                Top Products
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="p-3 text-left text-xs text-muted-foreground uppercase">Product</th>
                      <th className="p-3 text-right text-xs text-muted-foreground uppercase">Units Sold</th>
                      <th className="p-3 text-right text-xs text-muted-foreground uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topProducts.map((product: TopProduct, index: number) => (
                      <tr key={index} className="border-b border-border-light">
                        <td className="p-3 text-sm text-foreground">{product.name}</td>
                        <td className="p-3 text-right text-sm text-muted-foreground">{product.unitsSold}</td>
                        <td className="p-3 text-right text-sm font-semibold text-foreground">
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
  );
}
