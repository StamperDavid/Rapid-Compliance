/**
 * Top Performers Card Component
 * 
 * Displays top performers with their strengths and achievements
 */

'use client';

import React from 'react';

interface TopPerformer {
  repId: string;
  repName: string;
  score: number;
  strengths: string[];
}

interface TopPerformersCardProps {
  topPerformers: TopPerformer[];
  loading?: boolean;
}

/**
 * Top Performers Card Component
 */
export function TopPerformersCard({ topPerformers, loading = false }: TopPerformersCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (topPerformers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">🏆</span>
          <p className="text-gray-600">No top performers identified yet</p>
          <p className="text-sm text-gray-500 mt-1">Check back after team has more activity</p>
        </div>
      </div>
    );
  }

  // Get medal emoji for top 3
  const getMedal = (index: number) => {
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return '⭐';
    }
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-700 bg-green-50';
    if (score >= 80) return 'text-blue-700 bg-blue-50';
    if (score >= 70) return 'text-indigo-700 bg-indigo-50';
    return 'text-gray-700 bg-gray-50';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Top Performers</h3>
        <p className="text-sm text-gray-500">Learn from your team's best</p>
      </div>

      {/* Top Performers List */}
      <div className="space-y-4">
        {topPerformers.map((performer, idx) => (
          <div key={performer.repId} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
            {/* Header Row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Medal/Rank */}
                <div className="flex-shrink-0 text-2xl">
                  {getMedal(idx)}
                </div>
                
                {/* Name and Rank */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{performer.repName}</h4>
                  <p className="text-xs text-gray-500">Rank #{idx + 1}</p>
                </div>
              </div>

              {/* Score Badge */}
              <div className={`px-3 py-1 rounded-full ${getScoreColor(performer.score)}`}>
                <div className="text-lg font-bold">{performer.score.toFixed(0)}</div>
                <div className="text-xs">Score</div>
              </div>
            </div>

            {/* Strengths */}
            {performer.strengths.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-2">Key Strengths:</div>
                <div className="flex flex-wrap gap-2">
                  {performer.strengths.map((strength, sIdx) => (
                    <span
                      key={sIdx}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      ✓ {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-4 text-xs">
                <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <span>📊</span>
                  <span>View Details</span>
                </button>
                <button className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                  <span>💡</span>
                  <span>Share Best Practices</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Best Practices Suggestion */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-1">Share Success Strategies</h4>
              <p className="text-xs text-green-700">
                Schedule a team session where top performers share their approaches. Peer learning is highly effective.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recognition Banner */}
      {topPerformers.length > 0 && topPerformers[0].score >= 90 && (
        <div className="mt-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <h4 className="text-sm font-semibold text-yellow-900">Exceptional Performance!</h4>
              <p className="text-xs text-yellow-700">
                {topPerformers[0].repName} is performing at an elite level ({topPerformers[0].score.toFixed(0)} score)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
