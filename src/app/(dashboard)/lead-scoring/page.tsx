/**
 * Lead Scoring Dashboard Page
 * AI-powered lead quality scores based on discovery data
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';
import { LeadScoreCard } from '@/components/lead-scoring/LeadScoreCard';
import type { StoredLeadScore, LeadScoreAnalytics, ScoringRules } from '@/types/lead-scoring';
import SubpageNav from '@/components/ui/SubpageNav';
import { LEAD_INTEL_TABS } from '@/lib/constants/subpage-nav';
import {
  Target,
  Flame,
  Sun,
  Snowflake,
  TrendingUp,
  BarChart3,
  Settings,
  RefreshCw,
  Loader2,
  Zap,
  Award,
  Activity,
  Plus,
  Trash2,
  X,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface RulesApiResponse {
  success: boolean;
  rules?: ScoringRules[];
  error?: string;
}

interface CreateRuleResponse {
  success: boolean;
  rules?: ScoringRules;
  error?: string;
}

async function getAuthToken(): Promise<string | null> {
  const { getCurrentUser } = await import('@/lib/auth/auth-service');
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return null;
  }
  return currentUser.getIdToken();
}

export default function LeadScoringDashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<StoredLeadScore[]>([]);
  const [analytics, setAnalytics] = useState<LeadScoreAnalytics | null>(null);
  const [filterPriority, setFilterPriority] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [filterGrade, setFilterGrade] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'F'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  // Rules management state
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [rules, setRules] = useState<ScoringRules[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setRulesLoading(true);
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const res = await fetch('/api/lead-scoring/rules', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = (await res.json()) as RulesApiResponse;
        if (data.success && data.rules) {
          setRules(data.rules);
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to load scoring rules', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const handleCreateRule = async () => {
    if (!newRuleName.trim()) {
      return;
    }
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const res = await fetch('/api/lead-scoring/rules', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRuleName,
          description: newRuleDescription || undefined,
          isActive: rules.length === 0,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as CreateRuleResponse;
        if (data.success) {
          setNewRuleName('');
          setNewRuleDescription('');
          setShowCreateRule(false);
          await loadRules();
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to create scoring rule', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleToggleActive = async (rulesId: string, currentActive: boolean) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      await fetch('/api/lead-scoring/rules', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rulesId, isActive: !currentActive }),
      });

      await loadRules();
    } catch (error: unknown) {
      logger.error('Failed to toggle rule', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleDeleteRule = async (rulesId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      await fetch(`/api/lead-scoring/rules?rulesId=${rulesId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      setDeleteConfirm(null);
      await loadRules();
    } catch (error: unknown) {
      logger.error('Failed to delete rule', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const token = await getAuthToken();

      if (!token) {
        logger.info('No authenticated user, skipping API calls');
        setLoading(false);
        return;
      }

      const analyticsRes = await fetch(
        '/api/lead-scoring/analytics',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (analyticsRes.ok) {
        const rawData: unknown = await analyticsRes.json();
        const data = rawData as { analytics?: LeadScoreAnalytics };
        if (data.analytics) {
          setAnalytics(data.analytics);
        }
      }

      setScores([]);
    } catch (error: unknown) {
      logger.error('Failed to load lead scoring data', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user, loadData]);

  const filteredScores = scores
    .filter((s) => filterPriority === 'all' || s.priority === filterPriority)
    .filter((s) => filterGrade === 'all' || s.grade === filterGrade)
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.totalScore - a.totalScore;
      }
      return new Date(b.metadata.scoredAt).getTime() - new Date(a.metadata.scoredAt).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-main flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[var(--color-text-secondary)]">Loading lead scores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-main p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Lead Scoring Dashboard</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">
              AI-powered lead quality scores based on discovery data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-elevated border border-border-light hover:bg-surface-elevated text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => { setShowRulesPanel(true); void loadRules(); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25"
          >
            <Settings className="w-5 h-5" />
            Manage Rules
          </button>
        </div>
      </motion.div>

      {/* Sub-page Navigation */}
      <SubpageNav items={LEAD_INTEL_TABS} />

      {/* Analytics Cards */}
      {analytics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {/* Grade Distribution */}
          <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Grade Distribution</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(analytics.distribution).map(([grade, count]) => (
                <div key={grade} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text-secondary)]">Grade {grade.replace('grade', '')}</span>
                  <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-surface-elevated text-[var(--color-text-primary)]">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Priority Breakdown</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Flame className="w-4 h-4 text-error" />
                  Hot Leads
                </span>
                <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-error/20 border border-error/30 text-error">
                  {analytics.priorities.hot}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Sun className="w-4 h-4 text-warning" />
                  Warm Leads
                </span>
                <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-warning/20 border border-warning/30 text-warning">
                  {analytics.priorities.warm}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Snowflake className="w-4 h-4 text-primary" />
                  Cold Leads
                </span>
                <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-primary/20 border border-primary/30 text-primary">
                  {analytics.priorities.cold}
                </span>
              </div>
            </div>
          </div>

          {/* Average Scores */}
          <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Average Scores</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-secondary)]">Total</span>
                <span className="text-lg font-bold text-[var(--color-text-primary)]">{analytics.averageScores.total}/100</span>
              </div>
              <div className="space-y-2 pt-2 border-t border-border-light">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--color-text-disabled)]">Company Fit</span>
                  <span className="text-[var(--color-text-secondary)]">{analytics.averageScores.companyFit}/40</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--color-text-disabled)]">Person Fit</span>
                  <span className="text-[var(--color-text-secondary)]">{analytics.averageScores.personFit}/30</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--color-text-disabled)]">Intent Signals</span>
                  <span className="text-[var(--color-text-secondary)]">{analytics.averageScores.intentSignals}/20</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--color-text-disabled)]">Engagement</span>
                  <span className="text-[var(--color-text-secondary)]">{analytics.averageScores.engagement}/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Signals */}
          <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Top Intent Signals</h3>
            </div>
            <div className="space-y-2">
              {analytics.topSignals.slice(0, 5).map((signal) => (
                <div key={signal.type} className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-text-secondary)] capitalize">
                    {signal.type.replace(/_/g, ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-warning/20 border border-warning/30 text-warning">
                    {signal.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
      >
        <div className="flex flex-wrap gap-6 items-end">
          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
              className="px-4 py-2.5 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Priorities</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Grade</label>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value as typeof filterGrade)}
              className="px-4 py-2.5 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Grades</option>
              <option value="A">A (90-100)</option>
              <option value="B">B (75-89)</option>
              <option value="C">C (60-74)</option>
              <option value="D">D (40-59)</option>
              <option value="F">F (0-39)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2.5 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="score">Highest Score</option>
              <option value="date">Most Recent</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Lead Scores List */}
      {filteredScores.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-12 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center">
              <Target className="w-8 h-8 text-[var(--color-text-disabled)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No Lead Scores Yet</h3>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Start scoring leads to see their quality and prioritize your outreach.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25">
              <TrendingUp className="w-5 h-5" />
              Score Your Leads
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {filteredScores.map((score, idx) => (
            <motion.div
              key={score.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <LeadScoreCard score={score} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Rules Management Panel */}
      {showRulesPanel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-paper border border-border-light rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-light">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Scoring Rules</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowCreateRule(true); setNewRuleName(''); setNewRuleDescription(''); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Rule Set
                </button>
                <button
                  onClick={() => setShowRulesPanel(false)}
                  className="p-2 hover:bg-surface-elevated rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Create Rule Form */}
              {showCreateRule && (
                <div className="mb-6 p-4 rounded-xl bg-surface-elevated border border-border-light">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Create New Rule Set</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Rule set name (e.g., Enterprise Scoring)"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-main border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newRuleDescription}
                      onChange={(e) => setNewRuleDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-main border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowCreateRule(false)}
                        className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void handleCreateRule()}
                        disabled={!newRuleName.trim()}
                        className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-all disabled:opacity-50"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {rulesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-10 h-10 text-[var(--color-text-disabled)] mx-auto mb-3" />
                  <p className="text-[var(--color-text-secondary)] text-sm mb-1">No scoring rules configured yet.</p>
                  <p className="text-[var(--color-text-disabled)] text-xs">Create your first rule set to start scoring leads.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-4 rounded-xl bg-surface-elevated border border-border-light"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{rule.name}</h3>
                            {rule.isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/20 text-success border border-success/30 uppercase tracking-wider">
                                Active
                              </span>
                            )}
                          </div>
                          {rule.description && (
                            <p className="text-xs text-[var(--color-text-secondary)] mb-2">{rule.description}</p>
                          )}
                          <div className="flex flex-wrap gap-3 text-[10px] text-[var(--color-text-disabled)]">
                            <span>Industries: {rule.companyRules.industries.preferred.join(', ') || 'Any'}</span>
                            <span>Titles: {rule.personRules.titles.preferred.join(', ') || 'Any'}</span>
                            <span>Size: {rule.companyRules.size.preferred.join(', ') || 'Any'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => void handleToggleActive(rule.id, rule.isActive)}
                            className="p-1.5 hover:bg-surface-main rounded-lg transition-all"
                            title={rule.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {rule.isActive ? (
                              <ToggleRight className="w-5 h-5 text-success" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-[var(--color-text-disabled)]" />
                            )}
                          </button>
                          {deleteConfirm === rule.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => void handleDeleteRule(rule.id)}
                                className="px-2 py-1 text-[10px] font-semibold bg-error text-white rounded"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(rule.id)}
                              className="p-1.5 hover:bg-error/10 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-[var(--color-text-disabled)] hover:text-error" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-light bg-surface-elevated/50">
              <p className="text-[10px] text-[var(--color-text-disabled)] text-center">
                Only one rule set can be active at a time. New rule sets use default scoring weights.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
