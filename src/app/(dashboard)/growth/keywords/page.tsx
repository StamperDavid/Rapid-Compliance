'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import type { KeywordTrackingEntry } from '@/types/growth';

export default function KeywordsPage() {
  const authFetch = useAuthFetch();
  const [keywords, setKeywords] = useState<KeywordTrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);

  // Single add
  const [addKeyword, setAddKeyword] = useState('');
  const [addTags, setAddTags] = useState('');

  // Bulk add
  const [bulkText, setBulkText] = useState('');

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
    if (!addKeyword) {return;}
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
    if (!bulkText.trim()) {return;}
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

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Keyword Tracker
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => { setShowBulkForm(!showBulkForm); setShowAddForm(false); }} style={btnSecondary}>
            <Upload className="w-3.5 h-3.5" /> Bulk Add
          </button>
          <button type="button" onClick={() => { setShowAddForm(!showAddForm); setShowBulkForm(false); }} style={btnPrimary}>
            <Plus className="w-3.5 h-3.5" /> Add Keyword
          </button>
        </div>
      </div>

      {/* Single Add Form */}
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

      {/* Bulk Add Form */}
      {showBulkForm && (
        <div style={formBox}>
          <h3 style={formTitle}>Bulk Add Keywords</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0 0 0.5rem' }}>Enter one keyword per line (max 50)</p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            placeholder="sales automation software&#10;crm with ai&#10;marketing automation tools"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <button type="button" onClick={() => { void handleBulkAdd(); }} disabled={adding} style={{ ...btnPrimary, marginTop: '0.5rem', opacity: adding ? 0.6 : 1 }}>
            {adding ? 'Adding...' : `Add ${bulkText.split('\n').filter((l) => l.trim()).length} Keywords`}
          </button>
        </div>
      )}

      {/* Keywords Table */}
      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading keywords...
        </div>
      ) : keywords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          <Target className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No keywords tracked yet</p>
          <p style={{ fontSize: '0.875rem' }}>Add keywords to start tracking your SERP positions.</p>
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
                          {kw.tags.map((t) => (
                            <span key={t} style={tagStyle}>{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: kw.currentPosition ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>
                        {kw.currentPosition ? `#${kw.currentPosition}` : '—'}
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
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                      {kw.searchVolume.toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                      ${kw.cpc.toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600,
                        backgroundColor: kw.difficulty === 'LOW' ? 'rgba(34,197,94,0.12)' : kw.difficulty === 'HIGH' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
                        color: kw.difficulty === 'LOW' ? 'var(--color-success)' : kw.difficulty === 'HIGH' ? 'var(--color-error)' : 'var(--color-warning)',
                      }}>
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
    </div>
  );
}

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
