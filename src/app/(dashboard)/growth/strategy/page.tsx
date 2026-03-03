'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Zap,
  Shield,
  Sparkles,
  Check,
  X,
  TrendingUp,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { GrowthStrategy, StrategyTier } from '@/types/growth';

const TIER_CONFIG: Record<StrategyTier, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; gradient: string }> = {
  aggressive: { icon: Zap, color: 'var(--color-error)', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.02))' },
  competitive: { icon: Shield, color: 'var(--color-primary)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.02))' },
  scrappy: { icon: Sparkles, color: 'var(--color-success)', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02))' },
};

export default function StrategyPage() {
  const authFetch = useAuthFetch();
  const [strategy, setStrategy] = useState<GrowthStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [expandedTier, setExpandedTier] = useState<StrategyTier | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Generate form state
  const [maxBudget, setMaxBudget] = useState('5000');
  const [minBudget, setMinBudget] = useState('500');
  const [goal, setGoal] = useState<'growth' | 'retention' | 'awareness' | 'revenue'>('growth');
  const [industry, setIndustry] = useState('');

  const fetchStrategy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/growth/strategy');
      const json = await res.json() as { data?: GrowthStrategy | null };
      setStrategy(json.data ?? null);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void fetchStrategy(); }, [fetchStrategy]);

  const handleGenerate = async () => {
    if (!industry) {return;}
    setGenerating(true);
    try {
      const res = await authFetch('/api/growth/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxMonthlyBudget: parseFloat(maxBudget),
          minMonthlyBudget: parseFloat(minBudget),
          primaryGoal: goal,
          industry,
        }),
      });
      if (res.ok) {
        setShowGenerateForm(false);
        await fetchStrategy();
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (tier: StrategyTier) => {
    if (!strategy) {return;}
    setApproving(true);
    try {
      await authFetch('/api/growth/strategy/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.id, tier, notes: approvalNotes }),
      });
      await fetchStrategy();
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!strategy || !rejectReason) {return;}
    setApproving(true);
    try {
      await authFetch('/api/growth/strategy/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.id, reason: rejectReason }),
      });
      setShowRejectForm(false);
      setRejectReason('');
      await fetchStrategy();
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)' }}>
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading strategy...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Growth Strategy</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0' }}>
            Generate, compare, and approve your automated growth plan
          </p>
        </div>
        <button type="button" onClick={() => setShowGenerateForm(!showGenerateForm)} style={btnPrimary}>
          <Zap className="w-3.5 h-3.5" /> Generate New Strategy
        </button>
      </div>

      {/* Generate Form */}
      {showGenerateForm && (
        <div style={formBox}>
          <h3 style={formTitle}>Strategy Configuration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Max Monthly Budget ($)</label>
              <input type="number" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Min Monthly Budget ($)</label>
              <input type="number" value={minBudget} onChange={(e) => setMinBudget(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Primary Goal</label>
              <select value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)} style={inputStyle}>
                <option value="growth">Growth</option>
                <option value="revenue">Revenue</option>
                <option value="awareness">Awareness</option>
                <option value="retention">Retention</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. SaaS, Real Estate" style={inputStyle} />
            </div>
          </div>
          <button type="button" onClick={() => { void handleGenerate(); }} disabled={generating || !industry} style={{ ...btnPrimary, opacity: generating || !industry ? 0.6 : 1 }}>
            {generating ? 'Generating Strategy...' : 'Generate 3-Tier Strategy'}
          </button>
        </div>
      )}

      {/* No Strategy State */}
      {!strategy && !showGenerateForm && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          <TrendingUp className="w-12 h-12 mx-auto" style={{ color: 'var(--color-border-light)', marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No strategy generated yet</p>
          <p style={{ fontSize: '0.875rem' }}>Set your budget and goals, and we&apos;ll create 3 strategy tiers for your approval.</p>
        </div>
      )}

      {/* Strategy Display */}
      {strategy && (
        <>
          {/* Status Banner */}
          <div style={{
            padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem',
            backgroundColor: strategy.status === 'approved' ? 'rgba(34,197,94,0.08)' : strategy.status === 'pending_approval' ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${strategy.status === 'approved' ? 'var(--color-success)' : strategy.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-error)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {strategy.status === 'approved' ? <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} /> :
               strategy.status === 'pending_approval' ? <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} /> :
               <X className="w-4 h-4" style={{ color: 'var(--color-error)' }} />}
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                {strategy.status === 'approved'
                  ? `Strategy approved: ${strategy.approvedTier} tier ($${strategy.tiers[strategy.approvedTier ?? 'competitive'].monthlyBudget.toLocaleString()}/mo) — Execution commands dispatched`
                  : strategy.status === 'pending_approval'
                    ? 'Strategy awaiting your approval — select a tier below'
                    : 'Strategy was rejected — generate a new one'}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Generated {new Date(strategy.generatedAt).toLocaleDateString()}
            </span>
          </div>

          {/* Context */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <ContextCard label="Competitors Analyzed" value={strategy.dataContext.competitorCount} />
            <ContextCard label="Keywords Tracked" value={strategy.dataContext.trackedKeywords} />
            <ContextCard label="Avg Competitor DA" value={strategy.dataContext.avgDomainAuthority} />
            <ContextCard label="Keyword Gaps" value={strategy.dataContext.topKeywordGaps.length} />
          </div>

          {/* 3 Tier Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {(['aggressive', 'competitive', 'scrappy'] as const).map((tier) => {
              const t = strategy.tiers[tier];
              if (!t) {return null;}
              const config = TIER_CONFIG[tier];
              const TierIcon = config.icon;
              const isApproved = strategy.approvedTier === tier;
              const isExpanded = expandedTier === tier;

              return (
                <div
                  key={tier}
                  style={{
                    background: config.gradient,
                    borderRadius: '0.75rem',
                    border: isApproved ? `2px solid ${config.color}` : '1px solid var(--color-border-light)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <TierIcon className="w-5 h-5" style={{ color: config.color }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t.label}</h3>
                      {isApproved && (
                        <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.625rem', fontWeight: 700, backgroundColor: config.color, color: '#fff' }}>
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                      ${t.monthlyBudget.toLocaleString()}<span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>/mo</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{t.expectedROI}x</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}> ROI</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        <Clock className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle' }} /> {t.timeToResults}
                      </div>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                      {t.summary}
                    </p>

                    {/* KPIs */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Key Metrics</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {t.kpis.slice(0, 3).map((kpi, i) => <li key={i}>{kpi}</li>)}
                      </ul>
                    </div>

                    {/* Expand/Collapse actions */}
                    <button
                      type="button"
                      onClick={() => setExpandedTier(isExpanded ? null : tier)}
                      style={{ ...btnSecondary, width: '100%', justifyContent: 'center', marginBottom: '0.5rem' }}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? 'Hide Actions' : `View ${t.actions.length} Actions`}
                    </button>

                    {/* Approve button */}
                    {strategy.status === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => { void handleApprove(tier); }}
                        disabled={approving}
                        style={{
                          width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: 'none',
                          backgroundColor: config.color, color: '#fff',
                          cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
                          opacity: approving ? 0.6 : 1,
                        }}
                      >
                        {approving ? 'Approving...' : `Approve ${t.label}`}
                      </button>
                    )}
                  </div>

                  {/* Expanded Actions */}
                  {isExpanded && (
                    <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {t.actions.map((action) => (
                        <div key={action.id} style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{action.title}</div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>${action.budgetAllocation.toLocaleString()}/mo</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: '0 0 0.25rem', lineHeight: 1.4 }}>{action.description}</p>
                          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.6875rem' }}>
                            <span style={{ color: action.impact === 'high' ? 'var(--color-success)' : action.impact === 'medium' ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                              Impact: {action.impact}
                            </span>
                            <span style={{ color: 'var(--color-text-disabled)' }}>|</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Channel: {action.channel}</span>
                          </div>
                          {action.cheaperAlternative && (
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '0.375rem', backgroundColor: 'rgba(34,197,94,0.05)', border: '1px dashed var(--color-success)' }}>
                              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-success)' }}>Cheaper Alternative: {action.cheaperAlternative.title}</div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>{action.cheaperAlternative.description}</div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--color-success)', fontWeight: 600 }}>
                                Est. cost: ${action.cheaperAlternative.estimatedCost.toLocaleString()}/mo
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Risks */}
                      {t.risks.length > 0 && (
                        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-error)' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-error)' }}>Risks</span>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {t.risks.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Approval Notes & Reject */}
          {strategy.status === 'pending_approval' && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Approval Notes (optional)</label>
                <input value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Any notes for the team..." style={inputStyle} />
              </div>
              <div>
                {!showRejectForm ? (
                  <button type="button" onClick={() => setShowRejectForm(true)} style={{ ...btnSecondary, color: 'var(--color-error)', borderColor: 'var(--color-error)', marginTop: '1.25rem' }}>
                    <X className="w-3.5 h-3.5" /> Reject Strategy
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." style={{ ...inputStyle, width: 250 }} />
                    <button type="button" onClick={() => { void handleReject(); }} disabled={!rejectReason || approving} style={{ ...btnPrimary, backgroundColor: 'var(--color-error)' }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ContextCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)' }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-disabled)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</div>
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
