/**
 * Lead Scoring Dashboard Page
 * 
 * View and manage lead scores with analytics
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';
import { LeadScoreCard } from '@/components/lead-scoring/LeadScoreCard';
import type { StoredLeadScore, LeadScoreAnalytics } from '@/types/lead-scoring';

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

      // Get Firebase auth token
      const { getCurrentUser } = await import('@/lib/auth/auth-service');
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        logger.info('No authenticated user, skipping API calls');
        setLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();

      // Load analytics
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

      // TODO: Load actual scores from Firestore
      // For now, showing sample data structure
      setScores([]);
    } catch (error) {
      logger.error('Failed to load lead scoring data', error);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading lead scores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lead Scoring Dashboard</h1>
        <p className="text-gray-600">
          AI-powered lead quality scores based on discovery data
        </p>
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Grade Distribution */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Grade Distribution</h3>
            <div className="space-y-2">
              {Object.entries(analytics.distribution).map(([grade, count]) => (
                <div key={grade} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Grade {grade.replace('grade', '')}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Priority Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  🔥 <span>Hot Leads</span>
                </span>
                <span className="font-semibold text-red-600">{analytics.priorities.hot}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  ☀️ <span>Warm Leads</span>
                </span>
                <span className="font-semibold text-yellow-600">{analytics.priorities.warm}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  ❄️ <span>Cold Leads</span>
                </span>
                <span className="font-semibold text-blue-600">{analytics.priorities.cold}</span>
              </div>
            </div>
          </div>

          {/* Average Scores */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Average Scores</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total</span>
                <span className="font-semibold text-lg">{analytics.averageScores.total}/100</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Company Fit</span>
                <span>{analytics.averageScores.companyFit}/40</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Person Fit</span>
                <span>{analytics.averageScores.personFit}/30</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Intent Signals</span>
                <span>{analytics.averageScores.intentSignals}/20</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Engagement</span>
                <span>{analytics.averageScores.engagement}/10</span>
              </div>
            </div>
          </div>

          {/* Top Signals */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Intent Signals</h3>
            <div className="space-y-2">
              {analytics.topSignals.slice(0, 5).map((signal) => (
                <div key={signal.type} className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 capitalize">
                    {signal.type.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold">{signal.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Priority filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">☀️ Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>
          </div>

          {/* Grade filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Grades</option>
              <option value="A">A (90-100)</option>
              <option value="B">B (75-89)</option>
              <option value="C">C (60-74)</option>
              <option value="D">D (40-59)</option>
              <option value="F">F (0-39)</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="score">Highest Score</option>
              <option value="date">Most Recent</option>
            </select>
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-end gap-3">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              onClick={() => {
                // TODO: Navigate to scoring rules page
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Manage Rules
            </button>
          </div>
        </div>
      </div>

      {/* Lead Scores List */}
      {filteredScores.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
          <div className="text-gray-400 text-5xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lead Scores Yet</h3>
          <p className="text-gray-600 mb-6">
            Start scoring leads to see their quality and prioritize your outreach.
          </p>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
            Score Your Leads
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredScores.map((score) => (
            <LeadScoreCard key={score.id} score={score} />
          ))}
        </div>
      )}
    </div>
  );
}
