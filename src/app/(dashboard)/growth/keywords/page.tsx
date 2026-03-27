'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Plus,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
  Upload,
  Search,
  TrendingUp,
  BarChart3,
  PlusCircle,
  Check,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { KeywordTrackingEntry } from '@/types/growth';

// ============================================================================
// TYPES
// ============================================================================

type Tab = 'tracker' | 'research' | 'rankings';

interface KeywordSuggestion {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface SeedKeywordData {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  monthlySearches: Array<{ month: string; searchVolume: number }>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function KeywordsPage() {
  const authFetch = useAuthFetch();
  const [activeTab, setActiveTab] = useState<Tab>('tracker');

  // ---- Tracker state ----
  const [keywords, setKeywords] = useState<KeywordTrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [addKeyword, setAddKeyword] = useState('');
  const [addTags, setAddTags] = useState('');
  const [bulkText, setBulkText] = useState('');

  // ---- Research state ----
  const [researchQuery, setResearchQuery] = useState('');
  const [researching, setResearching] = useState(false);
  const [seedKeyword, setSeedKeyword] = useState<SeedKeywordData | null>(null);
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [addedFromResearch, setAddedFromResearch] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'volume' | 'cpc' | 'competition'>('volume');

  // ---- Rank chart state ----
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<string>>(new Set());

  // ---- Tracker logic ----
  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/growth/keywords?active=true');
      const json = await res.json() as { data?: KeywordTrackingEntry[] };
      setKeywords(json.data ?? []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void fetchKeywords(); }, [fetchKeywords]);

  const handleAdd = async () => {
    if (!addKeyword) { return; }
    setAdding(true);
    try {
      const tags = addTags.split(',').map((t) => t.trim()).filter(Boolean);
      await authFetch('/api/growth/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: addKeyword, tags }),
      });
      setAddKeyword(''); setAddTags('');
      setShowAddForm(false);
      await fetchKeywords();
    } finally {
      setAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) { return; }
    setAdding(true);
    try {
      const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
      const kws = lines.map((kw) => ({ keyword: kw, tags: [] }));
      await authFetch('/api/growth/keywords/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: kws }),
      });
      setBulkText('');
      setShowBulkForm(false);
      await fetchKeywords();
    } finally {
      setAdding(false);
    }
  };

  const handleCheckRanking = async (id: string) => {
    await authFetch(`/api/growth/keywords/${id}`, { method: 'POST' });
    await fetchKeywords();
  };

  const handleRemove = async (id: string) => {
    await authFetch(`/api/growth/keywords/${id}`, { method: 'DELETE' });
    await fetchKeywords();
  };

  // ---- Research logic ----
  const handleResearch = async () => {
    if (!researchQuery.trim()) { return; }
    setResearching(true);
    setSeedKeyword(null);
    setSuggestions([]);
    setAddedFromResearch(new Set());
    try {
      const res = await authFetch('/api/growth/keywords/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: researchQuery.trim(), limit: 50 }),
      });
      const json = await res.json() as {
        success: boolean;
        seedKeyword: SeedKeywordData | null;
        suggestions: KeywordSuggestion[];
      };
      if (json.success) {
        setSeedKeyword(json.seedKeyword);
        setSuggestions(json.suggestions ?? []);
      }
    } catch {
      // handled
    } finally {
      setResearching(false);
    }
  };

  const handleAddFromResearch = async (keyword: string) => {
    try {
      await authFetch('/api/growth/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, tags: ['research'] }),
      });
      setAddedFromResearch((prev) => new Set(prev).add(keyword.toLowerCase()));
      void fetchKeywords();
    } catch {
      // handled
    }
  };

  const sortedSuggestions = useMemo(() => {
    const copy = [...suggestions];
    switch (sortBy) {
      case 'volume':
        return copy.sort((a, b) => b.searchVolume - a.searchVolume);
      case 'cpc':
        return copy.sort((a, b) => b.cpc - a.cpc);
      case 'competition':
        return copy.sort((a, b) => a.competition - b.competition);
      default:
        return copy;
    }
  }, [suggestions, sortBy]);

  // ---- Rank chart data ----
  const trackedKeywords = useMemo(() => keywords.filter((k) => k.currentPosition !== null), [keywords]);
  const alreadyTracked = useMemo(() => new Set(keywords.map((k) => k.keyword.toLowerCase())), [keywords]);

  const chartData = useMemo(() => {
    const selected = keywords.filter((k) => selectedKeywordIds.has(k.id));
    if (selected.length === 0) { return []; }

    // Merge all history entries by date
    const dateMap = new Map<string, Record<string, number | null>>();

    for (const kw of selected) {
      for (const entry of kw.rankingHistory ?? []) {
        const date = entry.checkedAt.slice(0, 10);
        const existing = dateMap.get(date) ?? {};
        existing[kw.keyword] = entry.position;
        dateMap.set(date, existing);
      }
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, positions]) => ({ date, ...positions }));
  }, [keywords, selectedKeywordIds]);

  const chartColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  const toggleKeywordSelection = (id: string) => {
    setSelectedKeywordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 8) {
        next.add(id);
      }
      return next;
    });
  };

  // ---- TAB DEFINITIONS ----
  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'tracker', label: 'Keyword Tracker', icon: <Target className="w-4 h-4" /> },
    { id: 'research', label: 'Keyword Research', icon: <Search className="w-4 h-4" /> },
    { id: 'rankings', label: 'Rank History', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400 }}>
      {/* Header with tabs */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 1rem' }}>
          Keywords
        </h1>
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 1rem', border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, background: 'none',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: '-1px', transition: 'all 0.15s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB: KEYWORD TRACKER (existing) */}
      {/* ============================================================ */}
      {activeTab === 'tracker' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setShowBulkForm(!showBulkForm); setShowAddForm(false); }} style={btnSecondary}>
              <Upload className="w-3.5 h-3.5" /> Bulk Add
            </button>
            <button type="button" onClick={() => { setShowAddForm(!showAddForm); setShowBulkForm(false); }} style={btnPrimary}>
              <Plus className="w-3.5 h-3.5" /> Add Keyword
            </button>
          </div>

          {showAddForm && (
            <div style={formBox}>
              <h3 style={formTitle}>Add Keyword</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={labelStyle}>Keyword</label>
                  <input value={addKeyword} onChange={(e) => setAddKeyword(e.target.value)} placeholder="e.g. sales automation software" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tags (comma-separated)</label>
                  <input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="e.g. seo, primary" style={inputStyle} />
                </div>
                <button type="button" onClick={() => { void handleAdd(); }} disabled={adding} style={{ ...btnPrimary, opacity: adding ? 0.6 : 1 }}>
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {showBulkForm && (
            <div style={formBox}>
              <h3 style={formTitle}>Bulk Add Keywords</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0 0 0.5rem' }}>Enter one keyword per line (max 50)</p>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} placeholder="sales automation software&#10;crm with ai&#10;marketing automation tools" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              <button type="button" onClick={() => { void handleBulkAdd(); }} disabled={adding} style={{ ...btnPrimary, marginTop: '0.5rem', opacity: adding ? 0.6 : 1 }}>
                {adding ? 'Adding...' : `Add ${bulkText.split('\n').filter((l) => l.trim()).length} Keywords`}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading keywords...
            </div>
          ) : keywords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
              <Target className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>No keywords tracked yet</p>
              <p style={{ fontSize: '0.875rem' }}>Add keywords or use the Research tab to discover high-value keywords.</p>
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}>
                    <th style={thStyle}>Keyword</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Position</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Change</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Volume</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>CPC</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Difficulty</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Competitors</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => {
                    const change = kw.positionChange;
                    return (
                      <tr key={kw.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{kw.keyword}</div>
                          {kw.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                              {kw.tags.map((t) => <span key={t} style={tagStyle}>{t}</span>)}
                            </div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: kw.currentPosition ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>
                            {kw.currentPosition ? `#${kw.currentPosition}` : '\u2014'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {change !== null && change !== 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.125rem', fontWeight: 700, color: change > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                              {change > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                              {Math.abs(change)}
                            </span>
                          ) : (
                            <Minus className="w-3.5 h-3.5" style={{ color: 'var(--color-text-disabled)' }} />
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{kw.searchVolume.toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>${kw.cpc.toFixed(2)}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, backgroundColor: difficultyBg(kw.difficulty), color: difficultyColor(kw.difficulty) }}>
                            {kw.difficulty}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {kw.competitorPositions.filter((cp) => cp.position !== null).length}/{kw.competitorPositions.length}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => { void handleCheckRanking(kw.id); }} title="Check ranking now" style={iconBtn}>
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => { void handleRemove(kw.id); }} title="Remove" style={{ ...iconBtn, color: 'var(--color-error)' }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* TAB: KEYWORD RESEARCH (new) */}
      {/* ============================================================ */}
      {activeTab === 'research' && (
        <>
          {/* Search box */}
          <div style={formBox}>
            <h3 style={formTitle}>Discover Keywords</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0 0 0.75rem' }}>
              Enter a seed keyword to discover related keywords with search volume, CPC, and competition data.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end' }}>
              <div style={{ flex: 1 }}>
                <input
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { void handleResearch(); } }}
                  placeholder="e.g. sales automation, CRM software, marketing tools..."
                  style={inputStyle}
                />
              </div>
              <button type="button" onClick={() => { void handleResearch(); }} disabled={researching || !researchQuery.trim()} style={{ ...btnPrimary, opacity: researching ? 0.6 : 1 }}>
                {researching ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Researching...</>
                ) : (
                  <><Search className="w-3.5 h-3.5" /> Research</>
                )}
              </button>
            </div>
          </div>

          {/* Seed keyword overview */}
          {seedKeyword && (
            <div style={{ ...formBox, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Seed Keyword</p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0.25rem 0 0' }}>{seedKeyword.keyword}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Monthly Volume</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0.25rem 0 0' }}>{seedKeyword.searchVolume.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>CPC</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0.25rem 0 0' }}>${seedKeyword.cpc.toFixed(2)}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Competition</p>
                <span style={{ display: 'inline-block', marginTop: '0.375rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: difficultyBg(seedKeyword.competitionLevel), color: difficultyColor(seedKeyword.competitionLevel) }}>
                  {seedKeyword.competitionLevel}
                </span>
              </div>
            </div>
          )}

          {/* Search volume trend (monthly) */}
          {seedKeyword && seedKeyword.monthlySearches.length > 0 && (
            <div style={{ ...formBox, marginBottom: '1rem' }}>
              <h3 style={{ ...formTitle, marginBottom: '0.75rem' }}>Search Volume Trend</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seedKeyword.monthlySearches}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="searchVolume" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Suggestions table */}
          {sortedSuggestions.length > 0 && (
            <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {sortedSuggestions.length} Related Keywords
                </span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {(['volume', 'cpc', 'competition'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setSortBy(s)} style={{ ...btnSecondary, padding: '0.25rem 0.5rem', fontSize: '0.6875rem', backgroundColor: sortBy === s ? 'var(--color-primary)' : undefined, color: sortBy === s ? '#fff' : undefined, border: sortBy === s ? 'none' : undefined }}>
                      {s === 'volume' ? 'Volume' : s === 'cpc' ? 'CPC' : 'Easiest'}
                    </button>
                  ))}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}>
                    <th style={thStyle}>Keyword</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Volume</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>CPC</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Competition</th>
                    <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSuggestions.map((s) => {
                    const isTracked = alreadyTracked.has(s.keyword.toLowerCase()) || addedFromResearch.has(s.keyword.toLowerCase());
                    return (
                      <tr key={s.keyword} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--color-text-primary)' }}>{s.keyword}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{s.searchVolume.toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>${s.cpc.toFixed(2)}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, backgroundColor: difficultyBg(s.competitionLevel), color: difficultyColor(s.competitionLevel) }}>
                            {s.competitionLevel}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {isTracked ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--color-success)', fontWeight: 600 }}>
                              <Check className="w-3 h-3" /> Tracked
                            </span>
                          ) : (
                            <button type="button" onClick={() => { void handleAddFromResearch(s.keyword); }} style={{ ...iconBtn, width: 'auto', padding: '0.25rem 0.5rem', gap: '0.25rem', display: 'inline-flex', fontSize: '0.6875rem' }} title="Add to tracker">
                              <PlusCircle className="w-3 h-3" /> Track
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!researching && !seedKeyword && suggestions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
              <Search className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Discover high-value keywords</p>
              <p style={{ fontSize: '0.875rem' }}>Enter a seed keyword above to get volume, CPC, and competition data for related terms.</p>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* TAB: RANK HISTORY (new chart) */}
      {/* ============================================================ */}
      {activeTab === 'rankings' && (
        <>
          {trackedKeywords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
              <BarChart3 className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>No ranking data yet</p>
              <p style={{ fontSize: '0.875rem' }}>Add keywords and check their rankings to see position history charts.</p>
            </div>
          ) : (
            <>
              {/* Keyword selector */}
              <div style={formBox}>
                <h3 style={formTitle}>Select Keywords to Chart (max 8)</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {trackedKeywords.map((kw) => {
                    const isSelected = selectedKeywordIds.has(kw.id);
                    return (
                      <button
                        key={kw.id}
                        type="button"
                        onClick={() => toggleKeywordSelection(kw.id)}
                        style={{
                          padding: '0.375rem 0.75rem', borderRadius: '9999px',
                          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                          border: isSelected ? 'none' : '1px solid var(--color-border-light)',
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                          color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {kw.keyword}
                        {kw.currentPosition && <span style={{ opacity: 0.7, marginLeft: '0.375rem' }}>#{kw.currentPosition}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary cards */}
              {keywords.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <SummaryCard label="Tracked Keywords" value={keywords.length} />
                  <SummaryCard label="Avg. Position" value={avgPosition(keywords)} />
                  <SummaryCard label="Improved" value={keywords.filter((k) => (k.positionChange ?? 0) > 0).length} color="var(--color-success)" />
                  <SummaryCard label="Declined" value={keywords.filter((k) => (k.positionChange ?? 0) < 0).length} color="var(--color-error)" />
                </div>
              )}

              {/* Chart */}
              {selectedKeywordIds.size > 0 && chartData.length > 0 ? (
                <div style={{ ...formBox, padding: '1.25rem' }}>
                  <h3 style={{ ...formTitle, marginBottom: '0.75rem' }}>Position Over Time</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: '0 0 1rem' }}>
                    Lower position number = better ranking. #1 is the top.
                  </p>
                  <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                        <YAxis reversed domain={[1, 'auto']} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fill: 'var(--color-text-secondary)', fontSize: 11 } }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {keywords
                          .filter((k) => selectedKeywordIds.has(k.id))
                          .map((kw, i) => (
                            <Line
                              key={kw.id}
                              type="monotone"
                              dataKey={kw.keyword}
                              stroke={chartColors[i % chartColors.length]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : selectedKeywordIds.size > 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                  <p>No ranking history data for the selected keywords yet.</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                  <p>Select keywords above to view their position history chart.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function SummaryCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1rem' }}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? 'var(--color-text-primary)', margin: '0.25rem 0 0' }}>{value}</p>
    </div>
  );
}

function avgPosition(keywords: KeywordTrackingEntry[]): string {
  const ranked = keywords.filter((k) => k.currentPosition !== null);
  if (ranked.length === 0) { return '\u2014'; }
  const avg = ranked.reduce((sum, k) => sum + (k.currentPosition ?? 0), 0) / ranked.length;
  return `#${avg.toFixed(1)}`;
}

function difficultyBg(level: string): string {
  switch (level) {
    case 'LOW': return 'rgba(34,197,94,0.12)';
    case 'HIGH': return 'rgba(239,68,68,0.12)';
    default: return 'rgba(234,179,8,0.12)';
  }
}

function difficultyColor(level: string): string {
  switch (level) {
    case 'LOW': return 'var(--color-success)';
    case 'HIGH': return 'var(--color-error)';
    default: return 'var(--color-warning)';
  }
}

// ============================================================================
// SHARED STYLES
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-default)',
  color: 'var(--color-text-primary)', fontSize: '0.875rem', outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
  backgroundColor: 'var(--color-primary)', color: '#fff',
  cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
};

const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.5rem 1rem', borderRadius: '0.5rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)',
  color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8125rem',
};

const formBox: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem',
  border: '1px solid var(--color-border-light)', padding: '1.25rem', marginBottom: '1.5rem',
};

const formTitle: React.CSSProperties = {
  fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--color-text-primary)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem',
};

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
};

const tagStyle: React.CSSProperties = {
  padding: '0.125rem 0.375rem', borderRadius: '0.25rem',
  fontSize: '0.625rem', fontWeight: 600,
  backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)',
  color: 'var(--color-primary)',
};

const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '0.375rem',
  border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
  color: 'var(--color-text-secondary)', cursor: 'pointer',
};
