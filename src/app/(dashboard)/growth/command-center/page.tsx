'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  TrendingUp,
  Users,
  Target,
  Eye,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import type { CompetitorProfile, KeywordTrackingEntry, GrowthStrategy, AIVisibilityCheck, GrowthActivityEvent } from '@/types/growth';

interface DashboardData {
  competitors: CompetitorProfile[];
  keywords: KeywordTrackingEntry[];
  strategy: GrowthStrategy | null;
  aiVisibility: AIVisibilityCheck[];
  activity: GrowthActivityEvent[];
}

export default function GrowthCommandCenter() {
  const authFetch = useAuthFetch();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, kwRes, stratRes, aiRes, actRes] = await Promise.all([
        authFetch('/api/growth/competitors?active=true&limit=20'),
        authFetch('/api/growth/keywords?active=true&limit=50'),
        authFetch('/api/growth/strategy'),
        authFetch('/api/growth/ai-visibility?limit=5'),
        authFetch('/api/growth/activity?limit=10'),
      ]);

      const [compData, kwData, stratData, aiData, actData] = await Promise.all([
        compRes.json() as Promise<{ data?: CompetitorProfile[] }>,
        kwRes.json() as Promise<{ data?: KeywordTrackingEntry[] }>,
        stratRes.json() as Promise<{ data?: GrowthStrategy | null }>,
        aiRes.json() as Promise<{ data?: AIVisibilityCheck[] }>,
        actRes.json() as Promise<{ data?: GrowthActivityEvent[] }>,
      ]);

      setData({
        competitors: compData.data ?? [],
        keywords: kwData.data ?? [],
        strategy: stratData.data ?? null,
        aiVisibility: aiData.data ?? [],
        activity: actData.data ?? [],
      });
    } catch {
      // Errors handled by empty state
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)' }}>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading Growth Command Center...
        </div>
      </div>
    );
  }

  const competitors = data?.competitors ?? [];
  const keywords = data?.keywords ?? [];
  const strategy = data?.strategy;
  const latestAI = data?.aiVisibility?.[0] ?? null;
  const activity = data?.activity ?? [];

  // Calculate stats
  const avgDA = competitors.length > 0
    ? Math.round(competitors.reduce((s, c) => s + c.domainAuthority, 0) / competitors.length)
    : 0;

  const kwRanking = keywords.filter((k) => k.currentPosition !== null);
  const kwImproved = keywords.filter((k) => k.positionChange !== null && k.positionChange > 0);
  const kwDeclined = keywords.filter((k) => k.positionChange !== null && k.positionChange < 0);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Growth Command Center
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
            Competitive intelligence, keyword tracking, and automated growth strategy
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void fetchData(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: '0.8125rem',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon={Users} label="Competitors" value={competitors.length} sub={`Avg DA: ${avgDA}`} color="var(--color-primary)" />
        <StatCard icon={Target} label="Keywords Tracked" value={keywords.length} sub={`${kwRanking.length} ranking`} color="var(--color-success)" />
        <StatCard
          icon={TrendingUp}
          label="Keywords Improved"
          value={kwImproved.length}
          sub={`${kwDeclined.length} declined`}
          color="var(--color-warning)"
        />
        <StatCard
          icon={Eye}
          label="AI Visibility"
          value={latestAI ? `${latestAI.visibilityScore}%` : 'N/A'}
          sub={latestAI ? `${latestAI.aiOverviewMentions}/${latestAI.totalQueriesChecked} queries` : 'No checks yet'}
          color="var(--color-cyan)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Competitive Landscape */}
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 1rem' }}>
            Competitive Landscape
          </h2>
          {competitors.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No competitors tracked yet. Add competitors from the Competitors tab.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {competitors.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
                    backgroundColor: 'var(--color-bg-default)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{c.domain}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)' }}>DA {c.domainAuthority}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
                      {c.organicTraffic.toLocaleString()} traffic
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Keyword Movers */}
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 1rem' }}>
            Keyword Movers
          </h2>
          {keywords.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No keywords tracked yet. Add keywords from the Keywords tab.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {keywords
                .filter((k) => k.positionChange !== null && k.positionChange !== 0)
                .sort((a, b) => Math.abs(b.positionChange ?? 0) - Math.abs(a.positionChange ?? 0))
                .slice(0, 5)
                .map((k) => {
                  const isUp = (k.positionChange ?? 0) > 0;
                  return (
                    <div
                      key={k.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
                        backgroundColor: 'var(--color-bg-default)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{k.keyword}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          Position #{k.currentPosition ?? '—'}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        color: isUp ? 'var(--color-success)' : 'var(--color-error)',
                        fontWeight: 700, fontSize: '0.875rem',
                      }}>
                        {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {Math.abs(k.positionChange ?? 0)}
                      </div>
                    </div>
                  );
                })}
              {keywords.filter((k) => k.positionChange !== null && k.positionChange !== 0).length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  No keyword movements yet. Rankings will update after the daily cron runs.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Strategy Status */}
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 1rem' }}>
            Strategy Status
          </h2>
          {!strategy ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No strategy generated yet. Go to the Strategy tab to create one.
            </p>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span
                  style={{
                    padding: '0.25rem 0.75rem', borderRadius: '9999px',
                    fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                    backgroundColor: strategy.status === 'approved'
                      ? 'rgba(var(--color-success-rgb, 34, 197, 94), 0.15)'
                      : strategy.status === 'pending_approval'
                        ? 'rgba(var(--color-warning-rgb, 234, 179, 8), 0.15)'
                        : 'rgba(var(--color-error-rgb, 239, 68, 68), 0.15)',
                    color: strategy.status === 'approved'
                      ? 'var(--color-success)'
                      : strategy.status === 'pending_approval'
                        ? 'var(--color-warning)'
                        : 'var(--color-error)',
                  }}
                >
                  {strategy.status.replace('_', ' ')}
                </span>
                {strategy.approvedTier && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    {strategy.approvedTier} tier
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {(['aggressive', 'competitive', 'scrappy'] as const).map((tier) => {
                  const t = strategy.tiers[tier];
                  if (!t) {return null;}
                  return (
                    <div
                      key={tier}
                      style={{
                        padding: '0.75rem', borderRadius: '0.5rem',
                        backgroundColor: strategy.approvedTier === tier ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-bg-default)',
                        border: strategy.approvedTier === tier ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                      }}
                    >
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        ${t.monthlyBudget.toLocaleString()}/mo
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>
                        {t.expectedROI}x ROI
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 1rem' }}>
            Recent Activity
          </h2>
          {activity.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No activity yet. Start by adding competitors or keywords.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activity.slice(0, 8).map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--color-border-light)',
                  }}
                >
                  <Activity className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-primary)', marginTop: '0.125rem' }} />
                  <div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>{evt.message}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                      {new Date(evt.timestamp).toLocaleString()} — {evt.actor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  sub: string;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border-light)',
        padding: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Icon className="w-4 h-4" style={{ color }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>{sub}</div>
    </div>
  );
}
