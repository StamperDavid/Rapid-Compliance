'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';
import type { AIVisibilityCheck } from '@/types/growth';

export default function AIVisibilityPage() {
  const authFetch = useAuthFetch();
  const [checks, setChecks] = useState<AIVisibilityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showRunForm, setShowRunForm] = useState(false);
  const [queriesText, setQueriesText] = useState(
    'best sales automation software\nai sales platform\ncrm with ai features\nmarketing automation tools\nsales pipeline automation'
  );
  const [targetDomain, setTargetDomain] = useState('salesvelocity.ai');
  const [selectedCheck, setSelectedCheck] = useState<AIVisibilityCheck | null>(null);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/growth/ai-visibility?limit=20');
      const json = await res.json() as { data?: AIVisibilityCheck[] };
      const data = json.data ?? [];
      setChecks(data);
      if (data.length > 0 && !selectedCheck) {
        setSelectedCheck(data[0] ?? null);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedCheck]);

  useEffect(() => { void fetchChecks(); }, [fetchChecks]);

  const handleRunCheck = async () => {
    const queries = queriesText.split('\n').map((q) => q.trim()).filter(Boolean);
    if (queries.length === 0) {return;}
    setRunning(true);
    try {
      const res = await authFetch('/api/growth/ai-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries, targetDomain }),
      });
      const json = await res.json() as { success?: boolean; data?: AIVisibilityCheck };
      if (json.success) {
        setSelectedCheck(json.data ?? null);
        setShowRunForm(false);
        await fetchChecks();
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>AI Search Visibility</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
            Monitor your brand presence in AI search results and overviews
          </p>
        </div>
        <button type="button" onClick={() => setShowRunForm(!showRunForm)} style={btnPrimary}>
          <Search className="w-3.5 h-3.5" /> Run Visibility Check
        </button>
      </div>

      {/* Run Check Form */}
      {showRunForm && (
        <div style={formBox}>
          <h3 style={formTitle}>Run AI Visibility Check</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Target Domain</label>
              <input value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Search Queries (one per line, max 20)</label>
            <textarea
              value={queriesText}
              onChange={(e) => setQueriesText(e.target.value)}
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <button type="button" onClick={() => { void handleRunCheck(); }} disabled={running} style={{ ...btnPrimary, marginTop: '0.5rem', opacity: running ? 0.6 : 1 }}>
            {running ? 'Running Check...' : `Check ${queriesText.split('\n').filter((q) => q.trim()).length} Queries`}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading checks...
        </div>
      ) : checks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          <Eye className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No visibility checks yet</p>
          <p style={{ fontSize: '0.875rem' }}>Run a check to see how your brand appears in AI search results.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
          {/* History sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 0.5rem' }}>Check History</h3>
            {checks.map((check) => (
              <button
                key={check.id}
                type="button"
                onClick={() => setSelectedCheck(check)}
                style={{
                  padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'left',
                  border: selectedCheck?.id === check.id ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                  backgroundColor: selectedCheck?.id === check.id ? 'rgba(var(--color-primary-rgb), 0.05)' : 'var(--color-bg-paper)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{check.visibilityScore}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {check.aiOverviewMentions}/{check.totalQueriesChecked} mentions
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                  {new Date(check.checkedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>

          {/* Check Detail */}
          {selectedCheck && (
            <div>
              {/* Score Header */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1.5rem', borderRadius: '0.75rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', textAlign: 'center', minWidth: 140 }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: selectedCheck.visibilityScore >= 50 ? 'var(--color-success)' : selectedCheck.visibilityScore >= 20 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                    {selectedCheck.visibilityScore}%
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Visibility Score</div>
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-disabled)' }}>Queries Checked</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedCheck.totalQueriesChecked}</div>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-disabled)' }}>AI Overview Mentions</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>{selectedCheck.aiOverviewMentions}</div>
                  </div>
                </div>
              </div>

              {/* Query Results Table */}
              <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <h3 style={{ padding: '1rem 1.25rem 0.75rem', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>Query Results</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-light)', backgroundColor: 'var(--color-bg-elevated)' }}>
                      <th style={thStyle}>Query</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Mentioned</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Organic Pos</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>AI Overview</th>
                      <th style={thStyle}>Competitors in Results</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCheck.queryResults.map((qr, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{qr.query}</div>
                          {qr.mentionSnippet && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {qr.mentionSnippet}
                            </div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {qr.mentioned ? (
                            <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                          ) : (
                            <XCircle className="w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: qr.organicPosition ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>
                          {qr.organicPosition ? `#${qr.organicPosition}` : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {qr.hasAIOverview ? (
                            <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                          ) : (
                            <XCircle className="w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {qr.competitorsMentioned.length > 0 ? qr.competitorsMentioned.join(', ') : '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Competitor Mentions */}
              {selectedCheck.competitorMentions.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 0.75rem' }}>Competitor Presence</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedCheck.competitorMentions.map((cm) => (
                      <div key={cm.domain} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-default)' }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{cm.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{cm.domain}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-warning)' }}>{cm.mentionCount} mentions</div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>{cm.mentionRate}% of queries</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
