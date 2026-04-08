'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { PageTitle } from '@/components/ui/typography';
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
    <div className="p-8 space-y-6" style={{ maxWidth: 1400 }}>
      {/* Header with tabs */}
      <div>
        <PageTitle className="mb-4">Keywords</PageTitle>
        <div className="flex gap-1 border-b border-border-light">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 border-none cursor-pointer text-[0.8125rem] font-semibold bg-transparent transition-all duration-150 -mb-px ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground border-b-2 border-transparent'
              }`}
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
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowBulkForm(!showBulkForm); setShowAddForm(false); }} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light bg-surface-elevated text-muted-foreground cursor-pointer text-[0.8125rem]">
              <Upload className="w-3.5 h-3.5" /> Bulk Add
            </button>
            <button type="button" onClick={() => { setShowAddForm(!showAddForm); setShowBulkForm(false); }} className="flex items-center gap-2 px-4 py-2 rounded-lg border-none bg-primary text-white cursor-pointer text-[0.8125rem] font-semibold whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Add Keyword
            </button>
          </div>

          {showAddForm && (
            <div className="bg-card border border-border-light rounded-xl p-5 mb-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Add Keyword</h3>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Keyword</label>
                  <input value={addKeyword} onChange={(e) => setAddKeyword(e.target.value)} placeholder="e.g. sales automation software" className="w-full px-3 py-2 rounded-lg border border-border-light bg-surface-main text-foreground text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Tags (comma-separated)</label>
                  <input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="e.g. seo, primary" className="w-full px-3 py-2 rounded-lg border border-border-light bg-surface-main text-foreground text-sm outline-none" />
                </div>
                <button type="button" onClick={() => { void handleAdd(); }} disabled={adding} className="flex items-center gap-2 px-4 py-2 rounded-lg border-none bg-primary text-white cursor-pointer text-[0.8125rem] font-semibold whitespace-nowrap disabled:opacity-60">
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {showBulkForm && (
            <div className="bg-card border border-border-light rounded-xl p-5 mb-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Bulk Add Keywords</h3>
              <p className="text-[0.8125rem] text-muted-foreground mb-2">Enter one keyword per line (max 50)</p>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} placeholder="sales automation software&#10;crm with ai&#10;marketing automation tools" className="w-full px-3 py-2 rounded-lg border border-border-light bg-surface-main text-foreground text-sm outline-none resize-y font-inherit" />
              <button type="button" onClick={() => { void handleBulkAdd(); }} disabled={adding} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg border-none bg-primary text-white cursor-pointer text-[0.8125rem] font-semibold whitespace-nowrap disabled:opacity-60">
                {adding ? 'Adding...' : `Add ${bulkText.split('\n').filter((l) => l.trim()).length} Keywords`}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading keywords...
            </div>
          ) : keywords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4 text-border-light" />
              <p className="text-base font-semibold">No keywords tracked yet</p>
              <p className="text-sm">Add keywords or use the Research tab to discover high-value keywords.</p>
            </div>
          ) : (
            <div className="bg-card border border-border-light rounded-xl overflow-hidden">
              <table className="w-full border-collapse text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-elevated">
                    <th className="px-4 py-3 text-left text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Keyword</th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Position</th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Change</th>
                    <th className="px-4 py-3 text-right text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Volume</th>
                    <th className="px-4 py-3 text-right text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">CPC</th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Difficulty</th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Competitors</th>
                    <th className="px-4 py-3 text-right text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => {
                    const change = kw.positionChange;
                    return (
                      <tr key={kw.id} className="border-b border-border-light">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{kw.keyword}</div>
                          {kw.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {kw.tags.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded text-[0.625rem] font-semibold bg-primary/8 text-primary">{t}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-[0.9375rem] ${kw.currentPosition ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {kw.currentPosition ? `#${kw.currentPosition}` : '\u2014'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {change !== null && change !== 0 ? (
                            <span className={`inline-flex items-center gap-0.5 font-bold ${change > 0 ? 'text-success' : 'text-error'}`}>
                              {change > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                              {Math.abs(change)}
                            </span>
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{kw.searchVolume.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">${kw.cpc.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, backgroundColor: difficultyBg(kw.difficulty), color: difficultyColor(kw.difficulty) }}>
                            {kw.difficulty}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {kw.competitorPositions.filter((cp) => cp.position !== null).length}/{kw.competitorPositions.length}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <button type="button" onClick={() => { void handleCheckRanking(kw.id); }} title="Check ranking now" className="flex items-center justify-center w-7 h-7 rounded-md border border-border-light bg-transparent text-muted-foreground cursor-pointer hover:bg-surface-elevated">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => { void handleRemove(kw.id); }} title="Remove" className="flex items-center justify-center w-7 h-7 rounded-md border border-border-light bg-transparent text-error cursor-pointer hover:bg-surface-elevated">
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
          <div className="bg-card border border-border-light rounded-xl p-5 mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Discover Keywords</h3>
            <p className="text-[0.8125rem] text-muted-foreground mb-3">
              Enter a seed keyword to discover related keywords with search volume, CPC, and competition data.
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <input
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { void handleResearch(); } }}
                  placeholder="e.g. sales automation, CRM software, marketing tools..."
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-surface-main text-foreground text-sm outline-none"
                />
              </div>
              <button type="button" onClick={() => { void handleResearch(); }} disabled={researching || !researchQuery.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg border-none bg-primary text-white cursor-pointer text-[0.8125rem] font-semibold whitespace-nowrap disabled:opacity-60">
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
            <div className="bg-card border border-border-light rounded-xl p-5 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[0.6875rem] font-bold text-muted-foreground uppercase tracking-wide m-0">Seed Keyword</p>
                <p className="text-base font-bold text-foreground mt-1">{seedKeyword.keyword}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-bold text-muted-foreground uppercase tracking-wide m-0">Monthly Volume</p>
                <p className="text-xl font-bold text-foreground mt-1">{seedKeyword.searchVolume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-bold text-muted-foreground uppercase tracking-wide m-0">CPC</p>
                <p className="text-xl font-bold text-foreground mt-1">${seedKeyword.cpc.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-bold text-muted-foreground uppercase tracking-wide m-0">Competition</p>
                <span style={{ display: 'inline-block', marginTop: '0.375rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: difficultyBg(seedKeyword.competitionLevel), color: difficultyColor(seedKeyword.competitionLevel) }}>
                  {seedKeyword.competitionLevel}
                </span>
              </div>
            </div>
          )}

          {/* Search volume trend (monthly) */}
          {seedKeyword && seedKeyword.monthlySearches.length > 0 && (
            <div className="bg-card border border-border-light rounded-xl p-5 mb-4">
              <h3 className="text-base font-semibold text-foreground mb-3">Search Volume Trend</h3>
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
            <div className="bg-card border border-border-light rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border-light">
                <span className="text-[0.8125rem] font-semibold text-foreground">
                  {sortedSuggestions.length} Related Keywords
                </span>
                <div className="flex gap-1">
                  {(['volume', 'cpc', 'competition'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setSortBy(s)} className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-[0.6875rem] cursor-pointer ${sortBy === s ? 'bg-primary text-white border-none' : 'border-border-light bg-surface-elevated text-muted-foreground'}`}>
                      {s === 'volume' ? 'Volume' : s === 'cpc' ? 'CPC' : 'Easiest'}
                    </button>
                  ))}
                </div>
              </div>
              <table className="w-full border-collapse text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-elevated">
                    <th className="px-4 py-3 text-left text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Keyword</th>
                    <th className="px-4 py-3 text-right text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Volume</th>
                    <th className="px-4 py-3 text-right text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">CPC</th>
                    <th className="px-4 py-3 text-center text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">Competition</th>
                    <th className="px-4 py-3 text-right text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSuggestions.map((s) => {
                    const isTracked = alreadyTracked.has(s.keyword.toLowerCase()) || addedFromResearch.has(s.keyword.toLowerCase());
                    return (
                      <tr key={s.keyword} className="border-b border-border-light">
                        <td className="px-4 py-3 font-semibold text-foreground">{s.keyword}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{s.searchVolume.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">${s.cpc.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, backgroundColor: difficultyBg(s.competitionLevel), color: difficultyColor(s.competitionLevel) }}>
                            {s.competitionLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isTracked ? (
                            <span className="inline-flex items-center gap-1 text-[0.6875rem] text-success font-semibold">
                              <Check className="w-3 h-3" /> Tracked
                            </span>
                          ) : (
                            <button type="button" onClick={() => { void handleAddFromResearch(s.keyword); }} title="Add to tracker" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-light bg-transparent text-muted-foreground cursor-pointer text-[0.6875rem] hover:bg-surface-elevated">
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
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 text-border-light" />
              <p className="text-base font-semibold">Discover high-value keywords</p>
              <p className="text-sm">Enter a seed keyword above to get volume, CPC, and competition data for related terms.</p>
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
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-border-light" />
              <p className="text-base font-semibold">No ranking data yet</p>
              <p className="text-sm">Add keywords and check their rankings to see position history charts.</p>
            </div>
          ) : (
            <>
              {/* Keyword selector */}
              <div className="bg-card border border-border-light rounded-xl p-5 mb-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Select Keywords to Chart (max 8)</h3>
                <div className="flex flex-wrap gap-2">
                  {trackedKeywords.map((kw) => {
                    const isSelected = selectedKeywordIds.has(kw.id);
                    return (
                      <button
                        key={kw.id}
                        type="button"
                        onClick={() => toggleKeywordSelection(kw.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-primary text-white border-none'
                            : 'border border-border-light bg-surface-elevated text-muted-foreground'
                        }`}
                      >
                        {kw.keyword}
                        {kw.currentPosition && <span className="opacity-70 ml-1.5">#{kw.currentPosition}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary cards */}
              {keywords.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <SummaryCard label="Tracked Keywords" value={keywords.length} />
                  <SummaryCard label="Avg. Position" value={avgPosition(keywords)} />
                  <SummaryCard label="Improved" value={keywords.filter((k) => (k.positionChange ?? 0) > 0).length} color="var(--color-success)" />
                  <SummaryCard label="Declined" value={keywords.filter((k) => (k.positionChange ?? 0) < 0).length} color="var(--color-error)" />
                </div>
              )}

              {/* Chart */}
              {selectedKeywordIds.size > 0 && chartData.length > 0 ? (
                <div className="bg-card border border-border-light rounded-xl p-5">
                  <h3 className="text-base font-semibold text-foreground mb-3">Position Over Time</h3>
                  <p className="text-xs text-muted-foreground mb-4">
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
                <div className="text-center py-8 text-muted-foreground">
                  <p>No ranking history data for the selected keywords yet.</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
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
    <div className="bg-card border border-border-light rounded-xl p-4">
      <p className="text-[0.6875rem] font-bold text-muted-foreground uppercase tracking-wide m-0">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color ?? undefined }}>{value}</p>
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

