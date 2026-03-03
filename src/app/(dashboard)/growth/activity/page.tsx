'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Activity,
  RefreshCw,
  Users,
  Target,
  TrendingUp,
  Eye,
  Clock,
  Filter,
} from 'lucide-react';
import type { GrowthActivityEvent, GrowthActivityType } from '@/types/growth';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  competitor_added: Users,
  competitor_analyzed: Users,
  competitor_removed: Users,
  competitor_discovered: Users,
  keyword_added: Target,
  keyword_ranking_changed: Target,
  keyword_removed: Target,
  strategy_generated: TrendingUp,
  strategy_approved: TrendingUp,
  strategy_rejected: TrendingUp,
  ai_visibility_checked: Eye,
  cron_keyword_check: Clock,
  cron_competitor_scan: Clock,
  cron_ai_visibility: Clock,
};

const TYPE_COLORS: Record<string, string> = {
  competitor_added: 'var(--color-primary)',
  competitor_analyzed: 'var(--color-primary)',
  competitor_removed: 'var(--color-error)',
  competitor_discovered: 'var(--color-success)',
  keyword_added: 'var(--color-success)',
  keyword_ranking_changed: 'var(--color-warning)',
  keyword_removed: 'var(--color-error)',
  strategy_generated: 'var(--color-primary)',
  strategy_approved: 'var(--color-success)',
  strategy_rejected: 'var(--color-error)',
  ai_visibility_checked: 'var(--color-cyan)',
  cron_keyword_check: 'var(--color-text-secondary)',
  cron_competitor_scan: 'var(--color-text-secondary)',
  cron_ai_visibility: 'var(--color-text-secondary)',
};

const FILTER_OPTIONS: Array<{ value: GrowthActivityType | ''; label: string }> = [
  { value: '', label: 'All Activity' },
  { value: 'competitor_added', label: 'Competitor Added' },
  { value: 'competitor_analyzed', label: 'Competitor Analyzed' },
  { value: 'competitor_discovered', label: 'Competitors Discovered' },
  { value: 'keyword_added', label: 'Keyword Added' },
  { value: 'keyword_ranking_changed', label: 'Ranking Changed' },
  { value: 'strategy_generated', label: 'Strategy Generated' },
  { value: 'strategy_approved', label: 'Strategy Approved' },
  { value: 'strategy_rejected', label: 'Strategy Rejected' },
  { value: 'ai_visibility_checked', label: 'AI Visibility Check' },
  { value: 'cron_keyword_check', label: 'Cron: Keywords' },
  { value: 'cron_competitor_scan', label: 'Cron: Competitors' },
  { value: 'cron_ai_visibility', label: 'Cron: AI Visibility' },
];

export default function ActivityPage() {
  const authFetch = useAuthFetch();
  const [events, setEvents] = useState<GrowthActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filter) {params.set('type', filter);}
      const res = await authFetch(`/api/growth/activity?${params.toString()}`);
      const json = await res.json() as { data?: GrowthActivityEvent[] };
      setEvents(json.data ?? []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [authFetch, filter]);

  useEffect(() => { void fetchActivity(); }, [fetchActivity]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Activity Feed</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
              border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-default)',
              color: 'var(--color-text-primary)', fontSize: '0.8125rem', outline: 'none',
            }}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading activity...
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          <Activity className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No activity yet</p>
          <p style={{ fontSize: '0.875rem' }}>Start tracking competitors and keywords to see activity here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {events.map((evt, idx) => {
            const Icon = TYPE_ICONS[evt.type] ?? Activity;
            const color = TYPE_COLORS[evt.type] ?? 'var(--color-text-secondary)';
            const isLast = idx === events.length - 1;

            return (
              <div key={evt.id} style={{ display: 'flex', gap: '0.75rem' }}>
                {/* Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: `${color}15`, flexShrink: 0,
                  }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, backgroundColor: 'var(--color-border-light)', marginTop: 4, marginBottom: 4 }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                    {evt.message}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                    <span>{new Date(evt.timestamp).toLocaleString()}</span>
                    <span>by {evt.actor}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
