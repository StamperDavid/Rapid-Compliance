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
} from 'lucide-react';
import type { CompetitorProfile } from '@/types/growth';

export default function CompetitorsPage() {
  const authFetch = useAuthFetch();
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDiscoverForm, setShowDiscoverForm] = useState(false);

  // Add form
  const [addDomain, setAddDomain] = useState('');
  const [addName, setAddName] = useState('');
  const [addNiche, setAddNiche] = useState('');

  // Discover form
  const [discoverNiche, setDiscoverNiche] = useState('');
  const [discoverLocation, setDiscoverLocation] = useState('United States');
  const [discoveredResults, setDiscoveredResults] = useState<{
    competitors: Array<{ name: string; domain: string; domainAuthority: number; strengths: string[]; weaknesses: string[] }>;
    marketInsights: { saturation: string; gaps: string[]; recommendations: string[] };
  } | null>(null);

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

  const handleAdd = async () => {
    if (!addDomain || !addName || !addNiche) {return;}
    setAdding(true);
    try {
      const res = await authFetch('/api/growth/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: addDomain, name: addName, niche: addNiche }),
      });
      if (res.ok) {
        setAddDomain(''); setAddName(''); setAddNiche('');
        setShowAddForm(false);
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
      const json = await res.json() as {
        success?: boolean;
        data?: {
          competitors: Array<{ name: string; domain: string; domainAuthority: number; strengths: string[]; weaknesses: string[] }>;
          marketInsights: { saturation: string; gaps: string[]; recommendations: string[] };
        };
      };
      if (json.success) {
        setDiscoveredResults(json.data ?? null);
      }
    } finally {
      setDiscovering(false);
    }
  };

  const handleAddDiscovered = async (comp: { domain: string; name: string }) => {
    setAdding(true);
    try {
      await authFetch('/api/growth/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: comp.domain, name: comp.name, niche: discoverNiche }),
      });
      await fetchCompetitors();
    } finally {
      setAdding(false);
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

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Competitors
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => { setShowDiscoverForm(true); setShowAddForm(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer', fontSize: '0.8125rem',
            }}
          >
            <Search className="w-3.5 h-3.5" /> Discover
          </button>
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setShowDiscoverForm(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Competitor
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--color-text-primary)' }}>Add Competitor</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Domain</label>
              <input value={addDomain} onChange={(e) => setAddDomain(e.target.value)} placeholder="example.com" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Name</label>
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Company Name" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Niche</label>
              <input value={addNiche} onChange={(e) => setAddNiche(e.target.value)} placeholder="e.g. Sales automation" style={inputStyle} />
            </div>
            <button type="button" onClick={() => { void handleAdd(); }} disabled={adding} style={{ ...btnPrimary, opacity: adding ? 0.6 : 1 }}>
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Discover Form */}
      {showDiscoverForm && (
        <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--color-text-primary)' }}>Discover Competitors</h3>
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
              {discovering ? 'Discovering...' : 'Discover'}
            </button>
          </div>

          {/* Discover Results */}
          {discoveredResults && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 0.5rem' }}>
                Found {discoveredResults.competitors.length} competitors
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {discoveredResults.competitors.map((c) => (
                  <div
                    key={c.domain}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-default)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{c.domain} — DA {c.domainAuthority}</div>
                    </div>
                    <button type="button" onClick={() => { void handleAddDiscovered(c); }} style={btnSmall}>
                      <Plus className="w-3 h-3" /> Track
                    </button>
                  </div>
                ))}
              </div>
              {discoveredResults.marketInsights.gaps.length > 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(var(--color-success-rgb, 34, 197, 94), 0.08)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)', marginBottom: '0.25rem' }}>Market Gaps</div>
                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    {discoveredResults.marketInsights.gaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Competitor Cards */}
      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading competitors...
        </div>
      ) : competitors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          <Globe className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No competitors tracked yet</p>
          <p style={{ fontSize: '0.875rem' }}>Add competitors manually or use the Discover feature to find them automatically.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {competitors.map((c) => (
            <div
              key={c.id}
              style={{
                backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem',
                border: '1px solid var(--color-border-light)', padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.name}</div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    {c.domain} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="button" onClick={() => { void handleReanalyze(c.id); }} title="Re-analyze" style={iconBtn}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => { void handleRemove(c.id); }} title="Remove" style={{ ...iconBtn, color: 'var(--color-error)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <MetricBox label="Domain Authority" value={c.domainAuthority} />
                <MetricBox label="Organic Traffic" value={c.organicTraffic.toLocaleString()} />
                <MetricBox label="Keywords" value={c.organicKeywords.toLocaleString()} />
                <MetricBox label="Backlinks" value={c.backlinks.toLocaleString()} />
              </div>

              {c.strengths.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Strengths</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{c.strengths.slice(0, 2).join(', ')}</div>
                </div>
              )}
              {c.weaknesses.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-error)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Weaknesses</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{c.weaknesses.slice(0, 2).join(', ')}</div>
                </div>
              )}

              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem' }}>
                Last analyzed: {c.lastAnalyzedAt ? new Date(c.lastAnalyzedAt).toLocaleDateString() : 'Never'}
              </div>
            </div>
          ))}
        </div>
      )}
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

const btnSmall: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.25rem',
  padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.75rem',
};

const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '0.375rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
  color: 'var(--color-text-secondary)', cursor: 'pointer',
};
