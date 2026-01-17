/**
 * Lead Scoring Dashboard Page
 * AI-powered lead quality scores based on discovery data
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';
import { LeadScoreCard } from '@/components/lead-scoring/LeadScoreCard';
import type { StoredLeadScore, LeadScoreAnalytics } from '@/types/lead-scoring';
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
  Activity
} from 'lucide-react';

interface LeadScoringDashboardProps {
  params: {
    orgId: string;
  };
}

export default function LeadScoringDashboard({ params }: LeadScoringDashboardProps) {
  const { user } = useAuth();
  const { orgId } = params;

  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<StoredLeadScore[]>([]);
  const [analytics, setAnalytics] = useState<LeadScoreAnalytics | null>(null);
  const [filterPriority, setFilterPriority] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [filterGrade, setFilterGrade] = useState<'all' | 'A' | 'B' | 'C' | 'D' | 'F'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, orgId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { getCurrentUser } = await import('@/lib/auth/auth-service');
      const currentUser = getCurrentUser();

      if (!currentUser) {
        logger.info('No authenticated user, skipping API calls');
        setLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();

      const analyticsRes = await fetch(
        `/api/lead-scoring/analytics?organizationId=${orgId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      setScores([]);
    } catch (error: unknown) {
      logger.error('Failed to load lead scoring data', error instanceof Error ? error : undefined);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
          <p className="text-gray-400">Loading lead scores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Lead Scoring Dashboard</h1>
            <p className="text-gray-400 text-sm">
              AI-powered lead quality scores based on discovery data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/25"
          >
            <Settings className="w-5 h-5" />
            Manage Rules
          </button>
        </div>
      </motion.div>

      {/* Analytics Cards */}
      {analytics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {/* Grade Distribution */}
          <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-gray-400">Grade Distribution</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(analytics.distribution).map(([grade, count]) => (
                <div key={grade} className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Grade {grade.replace('grade', '')}</span>
                  <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-white/5 text-white">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-gray-400">Priority Breakdown</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <Flame className="w-4 h-4 text-red-400" />
                  Hot Leads
                </span>
                <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-red-500/20 border border-red-500/30 text-red-300">
                  {analytics.priorities.hot}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <Sun className="w-4 h-4 text-yellow-400" />
                  Warm Leads
                </span>
                <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-yellow-500/20 border border-yellow-500/30 text-yellow-300">
                  {analytics.priorities.warm}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <Snowflake className="w-4 h-4 text-blue-400" />
                  Cold Leads
                </span>
                <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300">
                  {analytics.priorities.cold}
                </span>
              </div>
            </div>
          </div>

          {/* Average Scores */}
          <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-gray-400">Average Scores</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total</span>
                <span className="text-lg font-bold text-white">{analytics.averageScores.total}/100</span>
              </div>
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Company Fit</span>
                  <span className="text-gray-300">{analytics.averageScores.companyFit}/40</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Person Fit</span>
                  <span className="text-gray-300">{analytics.averageScores.personFit}/30</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Intent Signals</span>
                  <span className="text-gray-300">{analytics.averageScores.intentSignals}/20</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Engagement</span>
                  <span className="text-gray-300">{analytics.averageScores.engagement}/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Signals */}
          <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-gray-400">Top Intent Signals</h3>
            </div>
            <div className="space-y-2">
              {analytics.topSignals.slice(0, 5).map((signal) => (
                <div key={signal.type} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 capitalize">
                    {signal.type.replace(/_/g, ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-500/30 text-amber-300">
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
        className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 mb-6"
      >
        <div className="flex flex-wrap gap-6 items-end">
          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
            >
              <option value="all">All Priorities</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Grade</label>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value as typeof filterGrade)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
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
            <label className="block text-sm font-medium text-gray-400 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
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
          className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-12 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <Target className="w-8 h-8 text-gray-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">No Lead Scores Yet</h3>
              <p className="text-gray-400 mb-6">
                Start scoring leads to see their quality and prioritize your outreach.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/25">
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
    </div>
  );
}
