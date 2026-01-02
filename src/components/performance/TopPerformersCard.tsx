/**
 * Top Performers Card
 * 
 * Displays top performing sales reps with their strengths,
 * standout metrics, and mentorship recommendations.
 * 
 * @module components/performance
 */

'use client';

import React, { useState } from 'react';
import type { TopPerformer } from '@/lib/performance';

interface TopPerformersCardProps {
  topPerformers: TopPerformer[];
  loading?: boolean;
}

export function TopPerformersCard({
  topPerformers,
  loading = false,
}: TopPerformersCardProps) {
  const [expandedPerformer, setExpandedPerformer] = useState<string | null>(
    topPerformers.length > 0 ? topPerformers[0].repId : null
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (topPerformers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Top Performers</h3>
        <p className="text-sm text-gray-500">
          No top performers identified yet. Complete more conversations to generate rankings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Top Performers</h3>
        <p className="text-sm text-gray-500 mt-1">
          Learn from the best on your team
        </p>
      </div>

      {/* Content */}
      <div className="divide-y divide-gray-200">
        {topPerformers.map((performer, index) => (
          <div key={performer.repId}>
            {/* Performer Header */}
            <button
              onClick={() => setExpandedPerformer(
                expandedPerformer === performer.repId ? null : performer.repId
              )}
              className="w-full px-6 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-600' :
                    'bg-blue-500'
                  }`}>
                    #{performer.rank}
                  </div>
                  
                  {/* Name and Score */}
                  <div>
                    <h4 className="font-semibold text-gray-900">{performer.repName}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-600">
                        Score: <span className="font-semibold text-green-600">{performer.overallScore.toFixed(1)}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        {performer.percentileRank.toFixed(0)}th percentile
                      </span>
                      {performer.recommendedAsMentor && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Recommended Mentor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expand Icon */}
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedPerformer === performer.repId ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded Details */}
            {expandedPerformer === performer.repId && (
              <div className="px-6 pb-4 bg-gray-50">
                {/* Top Strengths */}
                {performer.topStrengths.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Top Strengths</h5>
                    <div className="space-y-2">
                      {performer.topStrengths.map((strength, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{strength.area}</span>
                            <span className="text-sm font-bold text-green-600">{strength.score.toFixed(1)}</span>
                          </div>
                          <p className="text-xs text-gray-600">{strength.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Standout Metrics */}
                {performer.standoutMetrics.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Standout Metrics</h5>
                    <div className="space-y-2">
                      {performer.standoutMetrics.map((metric, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{metric.metric}</span>
                            <span className="text-xs font-semibold text-blue-600">
                              {metric.percentageBetter.toFixed(0)}% better than team
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{metric.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Success Factors */}
                {performer.successFactors.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">What Makes Them Great</h5>
                    <ul className="space-y-1.5">
                      {performer.successFactors.map((factor, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mentorship Areas */}
                {performer.recommendedAsMentor && performer.mentorshipAreas.length > 0 && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <h5 className="text-sm font-semibold text-purple-900 mb-2">Can Mentor On</h5>
                    <div className="flex flex-wrap gap-2">
                      {performer.mentorshipAreas.map((area, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {area.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
