'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Plus,
  Search,
  RefreshCw,
  Trash2,
  ExternalLink,
  Globe,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  Zap,
} from 'lucide-react';
import type { CompetitorProfile } from '@/types/growth';

// ============================================================================
// TYPES
// ============================================================================

interface BattlecardData {
  id: string;
  competitorName: string;
  competitorDomain: string;
  strengths: string[];
  weaknesses: string[];
  talkingPoints: string[];
  objectionHandling: Array<{ objection: string; response: string }>;
  keyDifferentiators: string[];
  pricingIntel: string;
  marketPosition: string;
  adSpend?: string;
  socialScore?: number;
  techStack: string[];
  generatedAt: string;
}

// ============================================================================
// COMPETITOR MONITORING — 3 Column Layout
// ============================================================================

export default function CompetitorsPage() {
  const authFetch = useAuthFetch();
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  // URL input fields (5 slots)
  const [urls, setUrls] = useState<string[]>(['', '', '', '', '']);
  const [showDiscoverForm, setShowDiscoverForm] = useState(false);
  const [discoverNiche, setDiscoverNiche] = useState('');
  const [discoverLocation, setDiscoverLocation] = useState('United States');

  // Battlecard state
  const [expandedBattlecard, setExpandedBattlecard] = useState<string | null>(null);
  const [battlecards, setBattlecards] = useState<Record<string, BattlecardData>>({});
  const [loadingBattlecard, setLoadingBattlecard] = useState<string | null>(null);

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/growth/competitors?active=true');
      const json = await res.json() as { data?: CompetitorProfile[] };
      setCompetitors(json.data ?? []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void fetchCompetitors(); }, [fetchCompetitors]);

  const handleAddUrl = async (index: number) => {
    const domain = urls[index].trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) {return;}
    setAdding(true);
    try {
      const res = await authFetch('/api/growth/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, name: domain, niche: 'auto-detect' }),
      });
      if (res.ok) {
        const updated = [...urls];
        updated[index] = '';
        setUrls(updated);
        await fetchCompetitors();
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDiscover = async () => {
    if (!discoverNiche) {return;}
    setDiscovering(true);
    try {
      const res = await authFetch('/api/growth/competitors/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: discoverNiche, location: discoverLocation, limit: 5 }),
      });
      const json = await res.json() as { success?: boolean; data?: { competitors: Array<{ name: string; domain: string }> } };
      if (json.success && json.data?.competitors) {
        for (const c of json.data.competitors) {
          await authFetch('/api/growth/competitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: c.domain, name: c.name, niche: discoverNiche }),
          });
        }
        await fetchCompetitors();
        setShowDiscoverForm(false);
      }
    } finally {
      setDiscovering(false);
    }
  };

  const handleReanalyze = async (id: string) => {
    await authFetch(`/api/growth/competitors/${id}`, { method: 'POST' });
    await fetchCompetitors();
  };

  const handleRemove = async (id: string) => {
    await authFetch(`/api/growth/competitors/${id}`, { method: 'DELETE' });
    await fetchCompetitors();
  };

  const handleLoadBattlecard = async (comp: CompetitorProfile) => {
    if (expandedBattlecard === comp.id) {
      setExpandedBattlecard(null);
      return;
    }
    setExpandedBattlecard(comp.id);
    if (battlecards[comp.id]) {return;}

    setLoadingBattlecard(comp.id);
    try {
      const res = await authFetch('/api/battlecard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: comp.domain, name: comp.name }),
      });
      const json = await res.json() as { success?: boolean; data?: BattlecardData };
      if (json.success && json.data) {
        setBattlecards((prev) => ({ ...prev, [comp.id]: json.data as BattlecardData }));
      }
    } catch {
      // handled
    } finally {
      setLoadingBattlecard(null);
    }
  };

  // Find "us" baseline for comparison (average competitor metrics as benchmark)
  const avgDA = competitors.length > 0 ? Math.round(competitors.reduce((s, c) => s + c.domainAuthority, 0) / competitors.length) : 0;
  const avgTraffic = competitors.length > 0 ? Math.round(competitors.reduce((s, c) => s + c.organicTraffic, 0) / competitors.length) : 0;
  const avgKeywords = competitors.length > 0 ? Math.round(competitors.reduce((s, c) => s + c.organicKeywords, 0) / competitors.length) : 0;
  const avgBacklinks = competitors.length > 0 ? Math.round(competitors.reduce((s, c) => s + c.backlinks, 0) / competitors.length) : 0;

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Competitor Intelligence
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
            Monitor competitors, compare metrics, and generate battle strategies
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowDiscoverForm(!showDiscoverForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer', fontSize: '0.8125rem',
            }}
          >
            <Search className="w-3.5 h-3.5" /> Auto-Discover
          </button>
        </div>
      </div>

      {/* Auto-Discover Form */}
      {showDiscoverForm && (
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--color-text-primary)' }}>Auto-Discover Competitors</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Niche / Industry</label>
              <input value={discoverNiche} onChange={(e) => setDiscoverNiche(e.target.value)} placeholder="e.g. AI sales tools" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Location</label>
              <input value={discoverLocation} onChange={(e) => setDiscoverLocation(e.target.value)} style={inputStyle} />
            </div>
            <button type="button" onClick={() => { void handleDiscover(); }} disabled={discovering} style={{ ...btnPrimary, opacity: discovering ? 0.6 : 1 }}>
              {discovering ? 'Discovering...' : 'Find Competitors'}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 3-COLUMN LAYOUT                                                  */}
      {/* Column 1: Competitor URLs | Column 2: Metrics | Column 3: Strategy */}
      {/* ================================================================ */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '1.25rem', marginBottom: '2rem' }}>

        {/* ── Column 1: Competitor URL Inputs ──────────────────────────── */}
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            Tracked Competitors
          </h3>

          {/* Existing competitors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {competitors.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                  backgroundColor: 'var(--color-bg-default)',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <Globe className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>{c.domain}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.125rem' }}>
                  <button type="button" onClick={() => { void handleReanalyze(c.id); }} title="Re-analyze" style={iconBtn}>
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => { void handleRemove(c.id); }} title="Remove" style={{ ...iconBtn, color: 'var(--color-error)' }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add new competitor URLs */}
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Add Competitors
          </div>
          {urls.map((url, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem' }}>
              <input
                value={url}
                onChange={(e) => {
                  const updated = [...urls];
                  updated[i] = e.target.value;
                  setUrls(updated);
                }}
                placeholder={`competitor${i + 1}.com`}
                style={{ ...inputStyle, fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                onKeyDown={(e) => { if (e.key === 'Enter') { void handleAddUrl(i); } }}
              />
              <button
                type="button"
                onClick={() => { void handleAddUrl(i); }}
                disabled={!url.trim() || adding}
                style={{
                  ...iconBtn,
                  backgroundColor: url.trim() ? 'var(--color-primary)' : 'transparent',
                  color: url.trim() ? '#fff' : 'var(--color-text-disabled)',
                  border: url.trim() ? 'none' : '1px solid var(--color-border-light)',
                  opacity: adding ? 0.5 : 1,
                }}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* ── Column 2: Metrics Comparison ─────────────────────────────── */}
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            Metrics Comparison
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ marginBottom: '0.5rem' }} />
              Loading metrics...
            </div>
          ) : competitors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-disabled)' }}>
              Add competitors to see comparison metrics
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {/* Metric rows — candlestick-style bars */}
              {([
                { label: 'Domain Authority', key: 'domainAuthority' as const, max: 100, avg: avgDA },
                { label: 'Organic Traffic', key: 'organicTraffic' as const, max: Math.max(...competitors.map(c => c.organicTraffic), 1), avg: avgTraffic },
                { label: 'Keywords Ranked', key: 'organicKeywords' as const, max: Math.max(...competitors.map(c => c.organicKeywords), 1), avg: avgKeywords },
                { label: 'Backlinks', key: 'backlinks' as const, max: Math.max(...competitors.map(c => c.backlinks), 1), avg: avgBacklinks },
              ]).map((metric) => (
                <div key={metric.key} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{metric.label}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>avg: {metric.avg.toLocaleString()}</span>
                  </div>

                  {/* Average line indicator */}
                  <div style={{ position: 'relative' }}>
                    {competitors.map((c) => {
                      const value = c[metric.key];
                      const pct = metric.max > 0 ? (value / metric.max) * 100 : 0;
                      const aboveAvg = value >= metric.avg;
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <div style={{ width: '80px', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {c.name}
                          </div>
                          <div style={{ flex: 1, height: '20px', backgroundColor: 'var(--color-bg-default)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                            {/* Bar */}
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.max(pct, 2)}%`,
                                backgroundColor: aboveAvg ? 'var(--color-success)' : 'var(--color-warning)',
                                borderRadius: '4px',
                                transition: 'width 0.5s ease',
                                opacity: 0.7,
                              }}
                            />
                            {/* Average line */}
                            <div
                              style={{
                                position: 'absolute',
                                left: `${(metric.avg / metric.max) * 100}%`,
                                top: 0,
                                bottom: 0,
                                width: '2px',
                                backgroundColor: 'var(--color-error)',
                                opacity: 0.6,
                              }}
                            />
                          </div>
                          <div style={{ width: '60px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: aboveAvg ? 'var(--color-success)' : 'var(--color-warning)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.125rem' }}>
                            {aboveAvg ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {value.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--color-success)', opacity: 0.7 }} /> Above average
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--color-warning)', opacity: 0.7 }} /> Below average
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                  <div style={{ width: 2, height: 12, backgroundColor: 'var(--color-error)', opacity: 0.6 }} /> Industry avg
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Column 3: Recommended Strategies ─────────────────────────── */}
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
            Recommended Strategies
          </h3>

          {competitors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-disabled)', fontSize: '0.8125rem' }}>
              Add competitors to get AI-powered strategy recommendations
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Generate strategies from competitor data */}
              {generateStrategies(competitors).map((strategy, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--color-bg-default)',
                    borderLeft: `3px solid ${strategy.color}`,
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: strategy.color, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    {strategy.priority}
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                    {strategy.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {strategy.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* BATTLECARDS — Below the metrics comparison                       */}
      {/* ================================================================ */}
      <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield className="w-4 h-4" style={{ color: 'var(--color-info)' }} />
          Competitor Battlecards
        </h3>

        {competitors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-disabled)', fontSize: '0.8125rem' }}>
            Track competitors above to generate enriched battlecards
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competitors.map((c) => (
              <div key={c.id}>
                {/* Battlecard header row */}
                <button
                  type="button"
                  onClick={() => { void handleLoadBattlecard(c); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.75rem 1rem', borderRadius: expandedBattlecard === c.id ? '0.5rem 0.5rem 0 0' : '0.5rem',
                    backgroundColor: expandedBattlecard === c.id ? 'var(--color-bg-elevated)' : 'var(--color-bg-default)',
                    border: '1px solid var(--color-border-light)', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>{c.domain}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>DA <strong style={{ color: 'var(--color-text-primary)' }}>{c.domainAuthority}</strong></span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Traffic <strong style={{ color: 'var(--color-text-primary)' }}>{c.organicTraffic.toLocaleString()}</strong></span>
                    </div>
                    {expandedBattlecard === c.id ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />}
                  </div>
                </button>

                {/* Expanded battlecard */}
                {expandedBattlecard === c.id && (
                  <div style={{
                    padding: '1.25rem', borderRadius: '0 0 0.5rem 0.5rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-light)', borderTop: 'none',
                  }}>
                    {loadingBattlecard === c.id ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto" style={{ marginBottom: '0.5rem' }} />
                        Generating battlecard with AI...
                      </div>
                    ) : battlecards[c.id] ? (
                      <BattlecardExpanded data={battlecards[c.id]} competitor={c} />
                    ) : (
                      <BattlecardFromProfile competitor={c} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BATTLECARD EXPANDED VIEW
// ============================================================================

function BattlecardExpanded({ data, competitor }: { data: BattlecardData; competitor: CompetitorProfile }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
      {/* Column A: Profile & Metrics */}
      <div>
        <SectionLabel>Company Profile</SectionLabel>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {data.marketPosition || competitor.positioning || 'No positioning data available.'}
        </div>

        <SectionLabel>Key Metrics</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', marginBottom: '0.75rem' }}>
          <MetricBox label="Domain Authority" value={competitor.domainAuthority} />
          <MetricBox label="Organic Traffic" value={competitor.organicTraffic.toLocaleString()} />
          <MetricBox label="Keywords" value={competitor.organicKeywords.toLocaleString()} />
          <MetricBox label="Backlinks" value={competitor.backlinks.toLocaleString()} />
        </div>

        {data.adSpend && (
          <>
            <SectionLabel>Ad Spend</SectionLabel>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>{data.adSpend}</div>
          </>
        )}

        {data.socialScore !== undefined && (
          <>
            <SectionLabel>Social Score</SectionLabel>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{data.socialScore}/100</div>
          </>
        )}

        {data.techStack.length > 0 && (
          <>
            <SectionLabel>Tech Stack</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {data.techStack.map((tech, i) => (
                <span key={i} style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '1rem', backgroundColor: 'var(--color-bg-default)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                  {tech}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Column B: Strengths, Weaknesses, Differentiators */}
      <div>
        <SectionLabel color="var(--color-success)">Strengths</SectionLabel>
        <ul style={listStyle}>
          {(data.strengths.length > 0 ? data.strengths : competitor.strengths).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>

        <SectionLabel color="var(--color-error)">Weaknesses</SectionLabel>
        <ul style={listStyle}>
          {(data.weaknesses.length > 0 ? data.weaknesses : competitor.weaknesses).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>

        <SectionLabel color="var(--color-primary)">Key Differentiators (Us vs Them)</SectionLabel>
        <ul style={listStyle}>
          {data.keyDifferentiators.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      {/* Column C: Talk Tracks & Objection Handling */}
      <div>
        <SectionLabel>Talking Points</SectionLabel>
        <ul style={listStyle}>
          {data.talkingPoints.map((tp, i) => (
            <li key={i}>{tp}</li>
          ))}
        </ul>

        <SectionLabel>Objection Handling</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {data.objectionHandling.map((oh, i) => (
            <div key={i} style={{ padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: 'var(--color-bg-default)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.25rem' }}>
                &ldquo;{oh.objection}&rdquo;
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                {oh.response}
              </div>
            </div>
          ))}
        </div>

        {data.pricingIntel && (
          <>
            <SectionLabel>Pricing Intel</SectionLabel>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{data.pricingIntel}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// BATTLECARD FALLBACK (from profile data only)
// ============================================================================

function BattlecardFromProfile({ competitor }: { competitor: CompetitorProfile }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
      <div>
        <SectionLabel>Company Profile</SectionLabel>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
          {competitor.positioning || `${competitor.name} operates in the ${competitor.niche} space.`}
        </div>
        <a href={competitor.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          Visit website <ExternalLink className="w-3 h-3" />
        </a>

        <SectionLabel>Key Metrics</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
          <MetricBox label="Domain Authority" value={competitor.domainAuthority} />
          <MetricBox label="Organic Traffic" value={competitor.organicTraffic.toLocaleString()} />
          <MetricBox label="Keywords" value={competitor.organicKeywords.toLocaleString()} />
          <MetricBox label="Backlinks" value={competitor.backlinks.toLocaleString()} />
        </div>
      </div>

      <div>
        <SectionLabel color="var(--color-success)">Strengths</SectionLabel>
        <ul style={listStyle}>
          {competitor.strengths.length > 0 ? competitor.strengths.map((s, i) => <li key={i}>{s}</li>) : <li>Re-analyze to discover strengths</li>}
        </ul>

        <SectionLabel color="var(--color-error)">Weaknesses</SectionLabel>
        <ul style={listStyle}>
          {competitor.weaknesses.length > 0 ? competitor.weaknesses.map((w, i) => <li key={i}>{w}</li>) : <li>Re-analyze to discover weaknesses</li>}
        </ul>
      </div>

      <div>
        {competitor.techStack.length > 0 && (
          <>
            <SectionLabel>Tech Stack</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
              {competitor.techStack.map((tech, i) => (
                <span key={i} style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '1rem', backgroundColor: 'var(--color-bg-default)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                  {tech}
                </span>
              ))}
            </div>
          </>
        )}
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.8125rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-default)' }}>
          Full battlecard with talk tracks, objection handling, and pricing intel will be generated via AI enrichment.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STRATEGY GENERATION (from competitor data)
// ============================================================================

interface Strategy {
  priority: string;
  title: string;
  description: string;
  color: string;
}

function generateStrategies(competitors: CompetitorProfile[]): Strategy[] {
  const strategies: Strategy[] = [];

  if (competitors.length === 0) {return strategies;}

  const maxDA = Math.max(...competitors.map(c => c.domainAuthority));
  const avgTraffic = competitors.reduce((s, c) => s + c.organicTraffic, 0) / competitors.length;
  const maxBacklinks = Math.max(...competitors.map(c => c.backlinks));
  const topCompetitor = competitors.reduce((a, b) => a.domainAuthority > b.domainAuthority ? a : b);

  if (maxDA > 50) {
    strategies.push({
      priority: 'HIGH',
      title: 'Build Domain Authority',
      description: `Top competitor (${topCompetitor.name}) has DA ${maxDA}. Focus on high-quality backlinks from industry publications and guest posts.`,
      color: 'var(--color-error)',
    });
  }

  if (avgTraffic > 10000) {
    strategies.push({
      priority: 'HIGH',
      title: 'Content Gap Analysis',
      description: `Competitors average ${Math.round(avgTraffic).toLocaleString()} monthly organic visitors. Identify keywords they rank for that you don't.`,
      color: 'var(--color-error)',
    });
  }

  if (maxBacklinks > 5000) {
    strategies.push({
      priority: 'MEDIUM',
      title: 'Backlink Outreach Campaign',
      description: `${topCompetitor.name} has ${topCompetitor.backlinks.toLocaleString()} backlinks. Target their referring domains with better content.`,
      color: 'var(--color-warning)',
    });
  }

  // Always include these
  strategies.push({
    priority: 'MEDIUM',
    title: 'Differentiation Messaging',
    description: `Highlight your AI swarm advantage. None of ${competitors.length} tracked competitors offer coordinated multi-agent automation.`,
    color: 'var(--color-warning)',
  });

  strategies.push({
    priority: 'ONGOING',
    title: 'Weekly Monitoring',
    description: `Track competitor content, pricing changes, and feature launches. Set up alerts for ${competitors.slice(0, 3).map(c => c.name).join(', ')}.`,
    color: 'var(--color-info)',
  });

  strategies.push({
    priority: 'ONGOING',
    title: 'Social Media Intelligence',
    description: 'Monitor competitor social accounts for engagement patterns, ad campaigns, and audience sentiment shifts.',
    color: 'var(--color-info)',
  });

  return strategies.slice(0, 6);
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 700, color: color ?? 'var(--color-text-disabled)',
      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem', marginTop: '0.75rem',
    }}>
      {children}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: 'var(--color-bg-default)' }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-default)',
  color: 'var(--color-text-primary)', fontSize: '0.875rem', outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
  backgroundColor: 'var(--color-primary)', color: '#fff',
  cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
};

const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '0.375rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
  color: 'var(--color-text-secondary)', cursor: 'pointer',
};

const listStyle: React.CSSProperties = {
  margin: '0 0 0.75rem', paddingLeft: '1rem', fontSize: '0.8125rem',
  color: 'var(--color-text-secondary)', lineHeight: 1.6,
};
