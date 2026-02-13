'use client';

/**
 * Golden Playbook Manager
 * Version management, correction pipeline, and update reviews for the
 * social media AI agent's learned brand-voice playbook.
 *
 * Tabs:
 *  1. Playbook Versions — create, view, deploy versions
 *  2. Corrections — review captured corrections from the approval queue
 *  3. Update Requests — review AI-suggested improvements from correction analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';

// ---------------------------------------------------------------------------
// Local types mirroring server-side shapes (avoids importing server modules)
// ---------------------------------------------------------------------------

interface PlaybookVersion {
  id: string;
  version: string;
  agentType: string;
  brandVoiceDNA: {
    tone: string;
    keyMessages: string[];
    commonPhrases: string[];
    vocabulary: string[];
    avoidWords: string[];
  };
  platformRules: {
    platform: string;
    maxLength?: number;
    tone?: string;
    hashtagPolicy?: string;
    emojiPolicy?: string;
    ctaStyle?: string;
    customInstructions?: string[];
  }[];
  correctionHistory: {
    id: string;
    original: string;
    corrected: string;
    platform: string;
    postType?: string;
    context?: string;
    capturedAt: string;
    capturedBy: string;
  }[];
  performancePatterns: {
    pattern: string;
    metric: string;
    value: number;
    confidence: number;
    sampleSize: number;
  }[];
  explicitRules: {
    neverPostAbout: string[];
    alwaysRequireApproval: string[];
    topicRestrictions: string[];
    customConstraints: string[];
  };
  compiledPrompt: string;
  trainedScenarios: string[];
  trainingScore: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deployedAt?: string;
  previousVersion?: string;
  changesSummary?: string;
}

interface CorrectionItem {
  id: string;
  approvalId: string;
  postId: string;
  original: string;
  corrected: string;
  platform: string;
  postType?: string;
  context?: string;
  flagReason?: string;
  capturedAt: string;
  capturedBy: string;
  analyzed: boolean;
  analyzedAt?: string;
}

interface CorrectionCounts {
  total: number;
  unanalyzed: number;
}

interface CorrectionPattern {
  type: string;
  frequency: number;
  examples: { original: string; corrected: string }[];
}

interface ImprovementSuggestion {
  id: string;
  type: string;
  area: string;
  currentBehavior: string;
  suggestedBehavior: string;
  confidence: number;
  impactScore: number;
}

interface ImpactAnalysis {
  expectedScoreImprovement: number;
  areasImproved: string[];
  risks: string[];
  recommendedTestDuration: number;
  confidence: number;
}

interface PerformancePattern {
  id: string;
  pattern: string;
  metric: string;
  value: number;
  sampleSize: number;
  confidence: number;
  discoveredAt: string;
}

interface CoachingInsight {
  id: string;
  category: string;
  severity: string;
  title: string;
  observation: string;
  suggestion: string;
  evidence: { original: string; corrected: string; platform: string }[];
  estimatedImpact: string;
}

interface CoachingSession {
  id: string;
  playbookId: string;
  playbookVersion: string;
  insights: CoachingInsight[];
  correctionsAnalyzed: number;
  createdAt: string;
}

interface UpdateRequest {
  id: string;
  playbookId: string;
  sourceType: string;
  sourceCorrectionIds?: string[];
  improvements: ImprovementSuggestion[];
  impactAnalysis: ImpactAnalysis;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  appliedAt?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabKey = 'versions' | 'corrections' | 'updates' | 'coaching' | 'performance';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'versions', label: 'Playbook Versions' },
  { key: 'corrections', label: 'Corrections Pipeline' },
  { key: 'updates', label: 'Update Requests' },
  { key: 'coaching', label: 'AI Coach' },
  { key: 'performance', label: 'Performance' },
];

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0A66C2',
  facebook: '#1877F2',
  instagram: '#E1306C',
};

const UPDATE_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending_review: { bg: 'rgba(255,193,7,0.15)', text: '#FFC107', label: 'Pending Review' },
  approved: { bg: 'rgba(76,175,80,0.15)', text: '#4CAF50', label: 'Approved' },
  rejected: { bg: 'rgba(244,67,54,0.15)', text: '#F44336', label: 'Rejected' },
  applied: { bg: 'rgba(33,150,243,0.15)', text: '#2196F3', label: 'Applied' },
};

const IMPROVEMENT_TYPE_LABELS: Record<string, string> = {
  prompt_update: 'Prompt Update',
  behavior_change: 'Behavior Change',
  knowledge_gap: 'Knowledge Gap',
  tone_adjustment: 'Tone Adjustment',
  process_improvement: 'Process Improvement',
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GoldenPlaybookPage() {
  const { user: _user } = useUnifiedAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('versions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Versions state
  const [playbooks, setPlaybooks] = useState<PlaybookVersion[]>([]);
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [expandedPlaybook, setExpandedPlaybook] = useState<string | null>(null);
  const [createNotes, setCreateNotes] = useState('');

  // Corrections state
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [correctionCounts, setCorrectionCounts] = useState<CorrectionCounts>({ total: 0, unanalyzed: 0 });
  const [patterns, setPatterns] = useState<CorrectionPattern[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedCorrection, setExpandedCorrection] = useState<string | null>(null);

  // Updates state
  const [updateRequests, setUpdateRequests] = useState<UpdateRequest[]>([]);
  const [expandedUpdate, setExpandedUpdate] = useState<string | null>(null);

  // Coaching state
  const [coachingSession, setCoachingSession] = useState<CoachingSession | null>(null);
  const [loadingCoaching, setLoadingCoaching] = useState(false);
  const [acceptedInsights, setAcceptedInsights] = useState<Set<string>>(new Set());
  const [rejectedInsights, setRejectedInsights] = useState<Set<string>>(new Set());

  // Performance state
  const [performancePatterns, setPerformancePatterns] = useState<PerformancePattern[]>([]);
  const [performancePostsAnalyzed, setPerformancePostsAnalyzed] = useState(0);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [applyingPatterns, setApplyingPatterns] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchPlaybooks = useCallback(async () => {
    try {
      const res = await fetch('/api/social/playbook?all=true');
      const data = await res.json() as { success: boolean; playbooks?: PlaybookVersion[] };
      if (data.success && data.playbooks) {
        setPlaybooks(data.playbooks);
      }
    } catch {
      setError('Failed to load playbook versions');
    }
  }, []);

  const fetchCorrections = useCallback(async () => {
    try {
      const [countsRes, correctionsRes, patternsRes] = await Promise.all([
        fetch('/api/social/corrections?counts=true'),
        fetch('/api/social/corrections?limit=50'),
        fetch('/api/social/corrections?patterns=true'),
      ]);
      const [countsData, correctionsData, patternsData] = await Promise.all([
        countsRes.json() as Promise<{ success: boolean; counts?: CorrectionCounts }>,
        correctionsRes.json() as Promise<{ success: boolean; corrections?: CorrectionItem[] }>,
        patternsRes.json() as Promise<{ success: boolean; patterns?: CorrectionPattern[] }>,
      ]);

      if (countsData.success && countsData.counts) { setCorrectionCounts(countsData.counts); }
      if (correctionsData.success && correctionsData.corrections) { setCorrections(correctionsData.corrections); }
      if (patternsData.success && patternsData.patterns) { setPatterns(patternsData.patterns); }
    } catch {
      setError('Failed to load corrections');
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchPlaybooks(), fetchCorrections()]);
    setLoading(false);
  }, [fetchPlaybooks, fetchCorrections]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCreatePlaybook = async () => {
    try {
      setCreating(true);
      setError(null);
      const res = await fetch('/api/social/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: createNotes || undefined }),
      });
      const data = await res.json() as { success: boolean; playbook?: PlaybookVersion; error?: string };
      if (!data.success) { throw new Error(data.error ?? 'Failed to create playbook'); }
      setCreateNotes('');
      await fetchPlaybooks();
      showSuccess(`Playbook ${data.playbook?.version ?? ''} created successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playbook');
    } finally {
      setCreating(false);
    }
  };

  const handleDeploy = async (playbookId: string) => {
    try {
      setDeploying(playbookId);
      setError(null);
      const res = await fetch('/api/social/playbook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy', playbookId }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) { throw new Error(data.error ?? 'Failed to deploy playbook'); }
      await fetchPlaybooks();
      showSuccess('Playbook deployed — now active for all content generation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy playbook');
    } finally {
      setDeploying(null);
    }
  };

  const handleAnalyzeCorrections = async () => {
    const activePlaybook = playbooks.find(p => p.isActive) ?? playbooks[0];
    if (!activePlaybook) {
      setError('No playbook exists yet. Create one first.');
      return;
    }
    try {
      setAnalyzing(true);
      setError(null);
      const res = await fetch('/api/social/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', playbookId: activePlaybook.id, minCorrections: 1 }),
      });
      const data = await res.json() as {
        success: boolean;
        analyzed?: boolean;
        updateRequest?: UpdateRequest;
        correctionsAnalyzed?: number;
        message?: string;
        error?: string;
      };

      if (!data.success) { throw new Error(data.error ?? 'Analysis failed'); }

      if (data.analyzed && data.updateRequest) {
        setUpdateRequests(prev => [data.updateRequest as UpdateRequest, ...prev]);
        showSuccess(`Analyzed ${data.correctionsAnalyzed ?? 0} corrections — ${data.updateRequest.improvements.length} suggestions generated`);
      } else {
        showSuccess(data.message ?? 'No unanalyzed corrections available');
      }

      await fetchCorrections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze corrections');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzePerformance = async () => {
    try {
      setLoadingPerformance(true);
      setError(null);
      const res = await fetch('/api/social/playbook/performance', { method: 'POST' });
      const data = await res.json() as {
        success: boolean;
        patterns?: PerformancePattern[];
        postsAnalyzed?: number;
        error?: string;
      };
      if (!data.success) { throw new Error(data.error ?? 'Analysis failed'); }
      setPerformancePatterns(data.patterns ?? []);
      setPerformancePostsAnalyzed(data.postsAnalyzed ?? 0);

      if ((data.patterns ?? []).length === 0) {
        showSuccess(`Analyzed ${data.postsAnalyzed ?? 0} posts — no significant patterns found yet. Need more posts with engagement metrics.`);
      } else {
        showSuccess(`Found ${(data.patterns ?? []).length} performance pattern${(data.patterns ?? []).length === 1 ? '' : 's'} from ${data.postsAnalyzed ?? 0} posts`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze performance');
    } finally {
      setLoadingPerformance(false);
    }
  };

  const handleApplyPatterns = async () => {
    try {
      setApplyingPatterns(true);
      setError(null);
      const res = await fetch('/api/social/playbook/performance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json() as {
        success: boolean;
        applied?: boolean;
        patternsApplied?: number;
        message?: string;
        error?: string;
      };
      if (!data.success) { throw new Error(data.error ?? 'Failed to apply patterns'); }

      if (data.applied) {
        showSuccess(`Applied ${data.patternsApplied ?? 0} performance patterns to playbook`);
        await fetchPlaybooks();
      } else {
        showSuccess(data.message ?? 'No patterns to apply');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply patterns');
    } finally {
      setApplyingPatterns(false);
    }
  };

  const handleStartCoaching = async () => {
    try {
      setLoadingCoaching(true);
      setError(null);
      setAcceptedInsights(new Set());
      setRejectedInsights(new Set());

      const res = await fetch('/api/social/playbook/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json() as { success: boolean; session?: CoachingSession; error?: string };
      if (!data.success) { throw new Error(data.error ?? 'Coaching failed'); }

      if (data.session) {
        setCoachingSession(data.session);
        if (data.session.insights.length === 0) {
          showSuccess('No coaching insights at this time — your playbook looks great!');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate coaching session');
    } finally {
      setLoadingCoaching(false);
    }
  };

  const handleAcceptInsight = (insightId: string) => {
    setAcceptedInsights(prev => new Set([...prev, insightId]));
    setRejectedInsights(prev => {
      const next = new Set(prev);
      next.delete(insightId);
      return next;
    });
  };

  const handleRejectInsight = (insightId: string) => {
    setRejectedInsights(prev => new Set([...prev, insightId]));
    setAcceptedInsights(prev => {
      const next = new Set(prev);
      next.delete(insightId);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  // -------------------------------------------------------------------------
  // Tab: Playbook Versions
  // -------------------------------------------------------------------------

  const renderVersionsTab = () => (
    <div>
      {/* Create new playbook */}
      <div style={{
        padding: '1.25rem',
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-border-light)',
        marginBottom: '1.5rem',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          Create New Playbook Version
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Snapshots current Agent Rules (keywords, velocity limits, platform rules) into a versioned playbook.
          The playbook is used as the AI system instruction during content generation.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              Version Notes (optional)
            </label>
            <input
              type="text"
              value={createNotes}
              onChange={e => setCreateNotes(e.target.value)}
              placeholder="e.g. Updated tone to be more conversational"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border-light)',
                backgroundColor: 'var(--color-bg-main)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8125rem',
              }}
            />
          </div>
          <button
            onClick={() => void handleCreatePlaybook()}
            disabled={creating}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#4CAF50',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {creating ? 'Creating...' : 'Create Playbook'}
          </button>
        </div>
      </div>

      {/* Versions list */}
      {playbooks.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
        }}>
          No playbook versions yet. Create your first one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {playbooks.map(pb => {
            const isExpanded = expandedPlaybook === pb.id;
            return (
              <div
                key={pb.id}
                style={{
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.5rem',
                  border: `1px solid ${pb.isActive ? '#4CAF50' : 'var(--color-border-light)'}`,
                  overflow: 'hidden',
                }}
              >
                {/* Row header */}
                <div
                  onClick={() => setExpandedPlaybook(isExpanded ? null : pb.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '1rem', minWidth: '3rem' }}>
                    {pb.version}
                  </div>

                  {pb.isActive && (
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(76,175,80,0.15)',
                      color: '#4CAF50',
                      textTransform: 'uppercase',
                    }}>
                      Active
                    </span>
                  )}

                  <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {pb.changesSummary ?? 'No notes'}
                  </div>

                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                    {formatDate(pb.createdAt)}
                  </div>

                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    gap: '0.75rem',
                  }}>
                    <span>{pb.correctionHistory.length} corrections</span>
                    <span>{pb.performancePatterns.length} patterns</span>
                    <span>Score: {pb.trainingScore}</span>
                  </div>

                  {!pb.isActive && (
                    <button
                      onClick={e => { e.stopPropagation(); void handleDeploy(pb.id); }}
                      disabled={deploying === pb.id}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.25rem',
                        border: '1px solid var(--color-border-light)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: deploying === pb.id ? 'not-allowed' : 'pointer',
                        opacity: deploying === pb.id ? 0.5 : 1,
                      }}
                    >
                      {deploying === pb.id ? 'Deploying...' : 'Deploy'}
                    </button>
                  )}

                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                    {isExpanded ? '\u25B2' : '\u25BC'}
                  </span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    padding: '0 1.25rem 1.25rem',
                    borderTop: '1px solid var(--color-border-light)',
                    fontSize: '0.8125rem',
                  }}>
                    {/* Brand voice */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        BRAND VOICE DNA
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>Tone:</span> {pb.brandVoiceDNA.tone}
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>Vocabulary:</span>{' '}
                          {pb.brandVoiceDNA.vocabulary.length > 0 ? pb.brandVoiceDNA.vocabulary.join(', ') : 'None set'}
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>Avoid Words:</span>{' '}
                          {pb.brandVoiceDNA.avoidWords.length > 0
                            ? pb.brandVoiceDNA.avoidWords.map((w, i) => (
                              <span key={i} style={{
                                padding: '0.1rem 0.35rem',
                                borderRadius: '0.2rem',
                                backgroundColor: 'rgba(244,67,54,0.1)',
                                color: '#F44336',
                                fontSize: '0.6875rem',
                                marginRight: '0.25rem',
                              }}>{w}</span>
                            ))
                            : 'None set'}
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>Key Messages:</span>{' '}
                          {pb.brandVoiceDNA.keyMessages.length > 0 ? pb.brandVoiceDNA.keyMessages.join('; ') : 'None set'}
                        </div>
                      </div>
                    </div>

                    {/* Platform rules */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        PLATFORM RULES
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {pb.platformRules.map(rule => (
                          <div key={rule.platform} style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--color-border-light)',
                            backgroundColor: 'var(--color-bg-main)',
                            fontSize: '0.75rem',
                            minWidth: '140px',
                          }}>
                            <div style={{
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              fontSize: '0.625rem',
                              color: PLATFORM_COLORS[rule.platform] ?? 'var(--color-text-secondary)',
                              marginBottom: '0.25rem',
                            }}>
                              {rule.platform}
                            </div>
                            <div>Max: {rule.maxLength ?? '?'} chars</div>
                            <div>Hashtags: {rule.hashtagPolicy ?? 'default'}</div>
                            <div>CTA: {rule.ctaStyle ?? 'default'}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explicit rules */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        EXPLICIT RULES
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>Never post about:</span>{' '}
                          {pb.explicitRules.neverPostAbout.length > 0 ? pb.explicitRules.neverPostAbout.join(', ') : 'None'}
                        </div>
                        <div>
                          <span style={{ fontWeight: 500 }}>Require approval for:</span>{' '}
                          {pb.explicitRules.alwaysRequireApproval.length > 0 ? pb.explicitRules.alwaysRequireApproval.join(', ') : 'None'}
                        </div>
                      </div>
                    </div>

                    {/* Compiled prompt preview */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        COMPILED SYSTEM PROMPT
                      </div>
                      <pre style={{
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border-light)',
                        fontSize: '0.6875rem',
                        lineHeight: 1.5,
                        maxHeight: '200px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'var(--color-text-secondary)',
                      }}>
                        {pb.compiledPrompt || '(empty)'}
                      </pre>
                    </div>

                    {pb.deployedAt && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                        Deployed: {formatDate(pb.deployedAt)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Tab: Corrections Pipeline
  // -------------------------------------------------------------------------

  const renderCorrectionsTab = () => (
    <div>
      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Total Corrections', value: correctionCounts.total, color: 'var(--color-text-primary)' },
          { label: 'Unanalyzed', value: correctionCounts.unanalyzed, color: '#FF9800' },
          { label: 'Analyzed', value: correctionCounts.total - correctionCounts.unanalyzed, color: '#4CAF50' },
          { label: 'Patterns Detected', value: patterns.length, color: '#2196F3' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
          }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Analyze button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
          {correctionCounts.unanalyzed > 0
            ? `${correctionCounts.unanalyzed} correction${correctionCounts.unanalyzed === 1 ? '' : 's'} ready for AI analysis`
            : 'All corrections have been analyzed'}
        </div>
        <button
          onClick={() => void handleAnalyzeCorrections()}
          disabled={analyzing || correctionCounts.unanalyzed === 0}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: 'none',
            backgroundColor: correctionCounts.unanalyzed > 0 ? '#2196F3' : 'var(--color-border-light)',
            color: correctionCounts.unanalyzed > 0 ? '#fff' : 'var(--color-text-disabled)',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: analyzing || correctionCounts.unanalyzed === 0 ? 'not-allowed' : 'pointer',
            opacity: analyzing ? 0.6 : 1,
          }}
        >
          {analyzing ? 'Analyzing...' : 'Analyze Corrections'}
        </button>
      </div>

      {/* Detected patterns */}
      {patterns.length > 0 && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border-light)',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            Detected Patterns
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {patterns.map((p, i) => (
              <div key={i} style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border-light)',
                backgroundColor: 'var(--color-bg-main)',
                fontSize: '0.75rem',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem', textTransform: 'capitalize' }}>
                  {p.type.replace(/_/g, ' ')}
                </div>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  {p.frequency}x detected
                </div>
                {p.examples.length > 0 && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.6875rem' }}>
                    <span style={{ color: '#F44336', textDecoration: 'line-through' }}>
                      {p.examples[0].original.slice(0, 40)}...
                    </span>
                    {' → '}
                    <span style={{ color: '#4CAF50' }}>
                      {p.examples[0].corrected.slice(0, 40)}...
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corrections list */}
      {corrections.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
        }}>
          No corrections captured yet. Corrections are recorded when you edit AI-generated drafts in the Approval Queue.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {corrections.map(c => {
            const isExpanded = expandedCorrection === c.id;
            return (
              <div
                key={c.id}
                style={{
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => setExpandedCorrection(isExpanded ? null : c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    padding: '0.15rem 0.4rem',
                    borderRadius: '0.2rem',
                    fontSize: '0.5625rem',
                    fontWeight: 600,
                    backgroundColor: PLATFORM_COLORS[c.platform] ?? '#666',
                    color: '#fff',
                    textTransform: 'uppercase',
                  }}>
                    {c.platform}
                  </span>

                  <span style={{
                    padding: '0.15rem 0.35rem',
                    borderRadius: '0.2rem',
                    fontSize: '0.5625rem',
                    fontWeight: 600,
                    backgroundColor: c.analyzed ? 'rgba(76,175,80,0.15)' : 'rgba(255,193,7,0.15)',
                    color: c.analyzed ? '#4CAF50' : '#FFC107',
                  }}>
                    {c.analyzed ? 'Analyzed' : 'Pending'}
                  </span>

                  <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ textDecoration: 'line-through', color: 'var(--color-text-disabled)' }}>
                      {c.original.slice(0, 50)}
                    </span>
                    {' → '}
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {c.corrected.slice(0, 50)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', whiteSpace: 'nowrap' }}>
                    {formatDate(c.capturedAt)}
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                    {isExpanded ? '\u25B2' : '\u25BC'}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: '0 1rem 1rem',
                    borderTop: '1px solid var(--color-border-light)',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#F44336', marginBottom: '0.25rem' }}>
                          ORIGINAL (AI Generated)
                        </div>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(244,67,54,0.05)',
                          border: '1px solid rgba(244,67,54,0.2)',
                          fontSize: '0.8125rem',
                          lineHeight: 1.5,
                        }}>
                          {c.original}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.6875rem', color: '#4CAF50', marginBottom: '0.25rem' }}>
                          CORRECTED (User Edit)
                        </div>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(76,175,80,0.05)',
                          border: '1px solid rgba(76,175,80,0.2)',
                          fontSize: '0.8125rem',
                          lineHeight: 1.5,
                        }}>
                          {c.corrected}
                        </div>
                      </div>
                    </div>
                    {c.flagReason && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
                        Flag Reason: {c.flagReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Tab: Update Requests
  // -------------------------------------------------------------------------

  const renderUpdatesTab = () => (
    <div>
      {updateRequests.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
        }}>
          No update requests yet. Analyze corrections to generate AI-suggested improvements.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {updateRequests.map(ur => {
            const isExpanded = expandedUpdate === ur.id;
            const statusInfo = UPDATE_STATUS_COLORS[ur.status] ?? UPDATE_STATUS_COLORS.pending_review;
            return (
              <div
                key={ur.id}
                style={{
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedUpdate(isExpanded ? null : ur.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    backgroundColor: statusInfo.bg,
                    color: statusInfo.text,
                    textTransform: 'uppercase',
                  }}>
                    {statusInfo.label}
                  </span>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                      {ur.improvements.length} Improvement{ur.improvements.length === 1 ? '' : 's'} Suggested
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
                      Source: {ur.sourceType} | {ur.sourceCorrectionIds?.length ?? 0} corrections analyzed
                    </div>
                  </div>

                  {/* Impact summary */}
                  <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                    <div style={{ color: '#4CAF50', fontWeight: 600 }}>
                      +{ur.impactAnalysis.expectedScoreImprovement} pts
                    </div>
                    <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem' }}>
                      {Math.round(ur.impactAnalysis.confidence * 100)}% confidence
                    </div>
                  </div>

                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                    {formatDate(ur.createdAt)}
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                    {isExpanded ? '\u25B2' : '\u25BC'}
                  </span>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div style={{
                    padding: '0 1.25rem 1.25rem',
                    borderTop: '1px solid var(--color-border-light)',
                  }}>
                    {/* Impact Analysis */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        IMPACT ANALYSIS
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'var(--color-bg-main)',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4CAF50' }}>
                            +{ur.impactAnalysis.expectedScoreImprovement}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary)' }}>Score Improvement</div>
                        </div>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'var(--color-bg-main)',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2196F3' }}>
                            {ur.impactAnalysis.areasImproved.length}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary)' }}>Areas Improved</div>
                        </div>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'var(--color-bg-main)',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FF9800' }}>
                            {ur.impactAnalysis.risks.length}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary)' }}>Risks</div>
                        </div>
                        <div style={{
                          padding: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'var(--color-bg-main)',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            {ur.impactAnalysis.recommendedTestDuration}d
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary)' }}>Test Duration</div>
                        </div>
                      </div>

                      {ur.impactAnalysis.risks.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          {ur.impactAnalysis.risks.map((risk, i) => (
                            <div key={i} style={{
                              fontSize: '0.6875rem',
                              color: '#FF9800',
                              padding: '0.25rem 0',
                            }}>
                              Risk: {risk}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Individual improvements */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                        SUGGESTED IMPROVEMENTS
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {ur.improvements.map(imp => (
                          <div key={imp.id} style={{
                            padding: '0.75rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--color-border-light)',
                            backgroundColor: 'var(--color-bg-main)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span style={{
                                padding: '0.1rem 0.35rem',
                                borderRadius: '0.2rem',
                                fontSize: '0.5625rem',
                                fontWeight: 600,
                                backgroundColor: 'rgba(33,150,243,0.15)',
                                color: '#2196F3',
                                textTransform: 'uppercase',
                              }}>
                                {IMPROVEMENT_TYPE_LABELS[imp.type] ?? imp.type}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                {imp.area}
                              </span>
                              <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                                Impact: {imp.impactScore}/10 | Confidence: {Math.round(imp.confidence * 100)}%
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.75rem' }}>
                              <div>
                                <div style={{ fontWeight: 500, color: '#F44336', fontSize: '0.625rem', marginBottom: '0.25rem' }}>CURRENT</div>
                                <div style={{ color: 'var(--color-text-secondary)' }}>{imp.currentBehavior}</div>
                              </div>
                              <div>
                                <div style={{ fontWeight: 500, color: '#4CAF50', fontSize: '0.625rem', marginBottom: '0.25rem' }}>SUGGESTED</div>
                                <div>{imp.suggestedBehavior}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Tab: AI Coach
  // -------------------------------------------------------------------------

  const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
    important: { bg: 'rgba(244,67,54,0.1)', text: '#F44336' },
    recommendation: { bg: 'rgba(255,152,0,0.1)', text: '#FF9800' },
    suggestion: { bg: 'rgba(33,150,243,0.1)', text: '#2196F3' },
  };

  const IMPACT_COLORS: Record<string, string> = {
    high: '#F44336',
    medium: '#FF9800',
    low: '#4CAF50',
  };

  const CATEGORY_LABELS: Record<string, string> = {
    tone: 'Tone',
    length: 'Length',
    vocabulary: 'Vocabulary',
    structure: 'Structure',
    platform: 'Platform',
    engagement: 'Engagement',
    compliance: 'Compliance',
  };

  const renderCoachingTab = () => (
    <div>
      {/* Start coaching session */}
      <div style={{
        padding: '1.25rem',
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-border-light)',
        marginBottom: '1.5rem',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          AI Coaching Session
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          The AI coach analyzes your correction patterns and playbook state to identify actionable improvements.
          It looks at tone shifts, vocabulary changes, structural patterns, and playbook gaps.
        </div>
        <button
          onClick={() => void handleStartCoaching()}
          disabled={loadingCoaching}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            border: 'none',
            backgroundColor: '#9C27B0',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: loadingCoaching ? 'not-allowed' : 'pointer',
            opacity: loadingCoaching ? 0.6 : 1,
          }}
        >
          {loadingCoaching ? 'Analyzing...' : coachingSession ? 'Refresh Coaching' : 'Start Coaching Session'}
        </button>
      </div>

      {/* Session results */}
      {coachingSession && (
        <div>
          {/* Session info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
          }}>
            <span>Playbook: {coachingSession.playbookVersion}</span>
            <span>|</span>
            <span>{coachingSession.correctionsAnalyzed} corrections analyzed</span>
            <span>|</span>
            <span>{coachingSession.insights.length} insight{coachingSession.insights.length === 1 ? '' : 's'} found</span>
            <span>|</span>
            <span style={{ color: '#4CAF50' }}>{acceptedInsights.size} accepted</span>
            <span style={{ color: '#F44336' }}>{rejectedInsights.size} dismissed</span>
          </div>

          {coachingSession.insights.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.875rem',
              backgroundColor: 'var(--color-bg-paper)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-light)',
            }}>
              No coaching insights at this time. Your playbook is well-tuned, or there aren&apos;t enough corrections yet to identify patterns.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {coachingSession.insights.map(insight => {
                const isAccepted = acceptedInsights.has(insight.id);
                const isRejected = rejectedInsights.has(insight.id);
                const severity = SEVERITY_COLORS[insight.severity] ?? SEVERITY_COLORS.suggestion;
                const impactColor = IMPACT_COLORS[insight.estimatedImpact] ?? IMPACT_COLORS.medium;

                return (
                  <div
                    key={insight.id}
                    style={{
                      backgroundColor: 'var(--color-bg-paper)',
                      borderRadius: '0.5rem',
                      border: `1px solid ${isAccepted ? '#4CAF50' : isRejected ? 'var(--color-border-light)' : 'var(--color-border-light)'}`,
                      opacity: isRejected ? 0.5 : 1,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '1rem 1.25rem' }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.2rem',
                          fontSize: '0.5625rem',
                          fontWeight: 600,
                          backgroundColor: severity.bg,
                          color: severity.text,
                          textTransform: 'uppercase',
                        }}>
                          {insight.severity}
                        </span>
                        <span style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.2rem',
                          fontSize: '0.5625rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-bg-main)',
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                        }}>
                          {CATEGORY_LABELS[insight.category] ?? insight.category}
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '0.6875rem',
                          color: impactColor,
                          fontWeight: 600,
                        }}>
                          {insight.estimatedImpact.toUpperCase()} IMPACT
                        </span>
                      </div>

                      {/* Title + observation */}
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        {insight.title}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                        {insight.observation}
                      </div>

                      {/* Suggestion box */}
                      <div style={{
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'rgba(156,39,176,0.05)',
                        border: '1px solid rgba(156,39,176,0.2)',
                        marginBottom: '0.75rem',
                      }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 600, color: '#9C27B0', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                          Coaching Suggestion
                        </div>
                        <div style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
                          {insight.suggestion}
                        </div>
                      </div>

                      {/* Evidence examples */}
                      {insight.evidence.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--color-text-disabled)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                            Evidence
                          </div>
                          {insight.evidence.slice(0, 2).map((ev, i) => (
                            <div key={i} style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '0.5rem',
                              marginBottom: '0.25rem',
                              fontSize: '0.6875rem',
                            }}>
                              <div style={{ color: 'var(--color-text-disabled)', textDecoration: 'line-through' }}>
                                {ev.original.slice(0, 80)}...
                              </div>
                              <div style={{ color: 'var(--color-text-primary)' }}>
                                {ev.corrected.slice(0, 80)}...
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Accept / Reject buttons */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleAcceptInsight(insight.id)}
                          disabled={isAccepted}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.25rem',
                            border: 'none',
                            backgroundColor: isAccepted ? '#4CAF50' : 'rgba(76,175,80,0.1)',
                            color: isAccepted ? '#fff' : '#4CAF50',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            cursor: isAccepted ? 'default' : 'pointer',
                          }}
                        >
                          {isAccepted ? 'Accepted' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleRejectInsight(insight.id)}
                          disabled={isRejected}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.25rem',
                            border: '1px solid var(--color-border-light)',
                            backgroundColor: isRejected ? 'var(--color-bg-main)' : 'transparent',
                            color: 'var(--color-text-secondary)',
                            fontWeight: 500,
                            fontSize: '0.75rem',
                            cursor: isRejected ? 'default' : 'pointer',
                          }}
                        >
                          {isRejected ? 'Dismissed' : 'Dismiss'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary when all insights have been reviewed */}
          {coachingSession.insights.length > 0 &&
           acceptedInsights.size + rejectedInsights.size === coachingSession.insights.length && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(76,175,80,0.3)',
              backgroundColor: 'rgba(76,175,80,0.05)',
              textAlign: 'center',
              fontSize: '0.8125rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#4CAF50' }}>
                Coaching session complete!
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                {acceptedInsights.size} insight{acceptedInsights.size === 1 ? '' : 's'} accepted, {rejectedInsights.size} dismissed.
                {acceptedInsights.size > 0 && ' Go to the Corrections Pipeline tab to run analysis and apply these insights to your playbook.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No session yet */}
      {!coachingSession && !loadingCoaching && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border-light)',
        }}>
          Click &quot;Start Coaching Session&quot; to get personalized improvement suggestions based on your correction patterns and playbook state.
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Tab: Performance
  // -------------------------------------------------------------------------

  const renderPerformanceTab = () => (
    <div>
      {/* Analyze button */}
      <div style={{
        padding: '1.25rem',
        backgroundColor: 'var(--color-bg-paper)',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-border-light)',
        marginBottom: '1.5rem',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Performance Pattern Detection
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Analyzes published posts with engagement metrics to identify what content attributes
          (length, hashtags, time of day, structure, emojis) correlate with higher engagement.
          Requires at least 5 published posts with metrics.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => void handleAnalyzePerformance()}
            disabled={loadingPerformance}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#2196F3',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: loadingPerformance ? 'not-allowed' : 'pointer',
              opacity: loadingPerformance ? 0.6 : 1,
            }}
          >
            {loadingPerformance ? 'Analyzing...' : 'Analyze Performance'}
          </button>
          {performancePatterns.length > 0 && (
            <button
              onClick={() => void handleApplyPatterns()}
              disabled={applyingPatterns}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: '#4CAF50',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: applyingPatterns ? 'not-allowed' : 'pointer',
                opacity: applyingPatterns ? 0.6 : 1,
              }}
            >
              {applyingPatterns ? 'Applying...' : 'Apply to Playbook'}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {performancePostsAnalyzed > 0 && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          marginBottom: '1rem',
        }}>
          {performancePostsAnalyzed} posts analyzed | {performancePatterns.length} pattern{performancePatterns.length === 1 ? '' : 's'} detected
        </div>
      )}

      {performancePatterns.length === 0 && performancePostsAnalyzed > 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border-light)',
        }}>
          No significant performance patterns detected yet.
          The system needs more published posts with engagement metrics to identify meaningful correlations.
        </div>
      )}

      {performancePatterns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {performancePatterns.map(pattern => (
            <div
              key={pattern.id}
              style={{
                padding: '1rem 1.25rem',
                backgroundColor: 'var(--color-bg-paper)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>
                  {pattern.pattern}
                </div>
                <span style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  backgroundColor: pattern.confidence >= 0.7
                    ? 'rgba(76,175,80,0.15)'
                    : pattern.confidence >= 0.5
                      ? 'rgba(255,152,0,0.15)'
                      : 'rgba(158,158,158,0.15)',
                  color: pattern.confidence >= 0.7
                    ? '#4CAF50'
                    : pattern.confidence >= 0.5
                      ? '#FF9800'
                      : '#9E9E9E',
                }}>
                  {Math.round(pattern.confidence * 100)}% confidence
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                <span>Metric: {pattern.metric}</span>
                <span>Avg value: {pattern.value}</span>
                <span>Sample size: {pattern.sampleSize} posts</span>
                <span>Discovered: {formatDate(pattern.discoveredAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {performancePostsAnalyzed === 0 && !loadingPerformance && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border-light)',
        }}>
          Click &quot;Analyze Performance&quot; to scan your published posts for engagement patterns.
          The more posts with engagement data, the more patterns can be detected.
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Loading Golden Playbook...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Golden Playbook
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          Manage the AI agent&apos;s brand voice, learned corrections, and generation rules.
          The active playbook is used as the system instruction for all social media content generation.
        </p>
      </div>

      {/* Success / Error messages */}
      {successMessage && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          backgroundColor: 'rgba(76,175,80,0.1)',
          border: '1px solid rgba(76,175,80,0.3)',
          color: '#4CAF50',
          fontSize: '0.8125rem',
          marginBottom: '1rem',
        }}>
          {successMessage}
        </div>
      )}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          backgroundColor: 'rgba(244,67,54,0.1)',
          border: '1px solid rgba(244,67,54,0.3)',
          color: '#F44336',
          fontSize: '0.8125rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Active playbook banner */}
      {playbooks.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(76,175,80,0.3)',
          backgroundColor: 'rgba(76,175,80,0.05)',
          marginBottom: '1.5rem',
          fontSize: '0.8125rem',
        }}>
          {(() => {
            const active = playbooks.find(p => p.isActive);
            if (active) {
              return (
                <>
                  <span style={{ fontWeight: 600, color: '#4CAF50' }}>Active: {active.version}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>|</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {active.correctionHistory.length} corrections learned | Score: {active.trainingScore}
                  </span>
                  {active.deployedAt && (
                    <>
                      <span style={{ color: 'var(--color-text-secondary)' }}>|</span>
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                        Deployed {formatDate(active.deployedAt)}
                      </span>
                    </>
                  )}
                </>
              );
            }
            return (
              <span style={{ color: '#FF9800' }}>
                No playbook is deployed. Content generation is using basic prompts only.
              </span>
            );
          })()}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--color-border-light)',
        paddingBottom: '0',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: 'transparent',
              color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: '0.8125rem',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
            {tab.key === 'corrections' && correctionCounts.unanalyzed > 0 && (
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '9999px',
                fontSize: '0.5625rem',
                fontWeight: 700,
                backgroundColor: '#FF9800',
                color: '#fff',
              }}>
                {correctionCounts.unanalyzed}
              </span>
            )}
            {tab.key === 'updates' && updateRequests.filter(r => r.status === 'pending_review').length > 0 && (
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '9999px',
                fontSize: '0.5625rem',
                fontWeight: 700,
                backgroundColor: '#2196F3',
                color: '#fff',
              }}>
                {updateRequests.filter(r => r.status === 'pending_review').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'versions' && renderVersionsTab()}
      {activeTab === 'corrections' && renderCorrectionsTab()}
      {activeTab === 'updates' && renderUpdatesTab()}
      {activeTab === 'coaching' && renderCoachingTab()}
      {activeTab === 'performance' && renderPerformanceTab()}
    </div>
  );
}
