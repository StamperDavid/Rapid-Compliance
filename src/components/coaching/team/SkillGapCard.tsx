/**
 * Skill Gap Card Component
 * 
 * Displays skill gaps across the team with actionable insights
 */

'use client';

import React from 'react';

interface SkillGap {
  skill: string;
  teamAverage: number;
  topPerformerAverage: number;
  gap: number;
  repsAffected: number;
}

interface SkillGapCardProps {
  skillGaps: SkillGap[];
  totalReps: number;
  loading?: boolean;
}

/**
 * Skill Gap Card Component
 */
export function SkillGapCard({ skillGaps, totalReps, loading = false }: SkillGapCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (skillGaps.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Gaps</h3>
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">🎯</span>
          <p className="text-gray-600">No significant skill gaps detected</p>
          <p className="text-sm text-gray-500 mt-1">Team is performing well across all competencies</p>
        </div>
      </div>
    );
  }

  // Get gap severity color
  const getGapColor = (gap: number) => {
    if (gap >= 30) return 'bg-red-500';
    if (gap >= 20) return 'bg-orange-500';
    if (gap >= 10) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  // Get gap severity badge
  const getGapBadge = (gap: number) => {
    if (gap >= 30) return { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200' };
    if (gap >= 20) return { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (gap >= 10) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Skill Gaps</h3>
        <p className="text-sm text-gray-500">Areas where team lags behind top performers</p>
      </div>

      {/* Skill Gaps List */}
      <div className="space-y-4">
        {skillGaps.map((gap, idx) => {
          const badge = getGapBadge(gap.gap);
          const repsPercentage = (gap.repsAffected / totalReps) * 100;

          return (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              {/* Skill Name and Badge */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{gap.skill}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {gap.repsAffected} of {totalReps} reps affected ({repsPercentage.toFixed(0)}%)
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                  {badge.label} Gap
                </span>
              </div>

              {/* Score Comparison */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Team Average</div>
                  <div className="text-2xl font-bold text-gray-900">{gap.teamAverage.toFixed(0)}</div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-gray-600 h-1.5 rounded-full"
                      style={{ width: `${gap.teamAverage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-700 mb-1">Top Performers</div>
                  <div className="text-2xl font-bold text-green-900">{gap.topPerformerAverage.toFixed(0)}</div>
                  <div className="w-full bg-green-200 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-green-600 h-1.5 rounded-full"
                      style={{ width: `${gap.topPerformerAverage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Gap Visualization */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 min-w-[60px]">Gap:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getGapColor(gap.gap)}`}
                    style={{ width: `${(gap.gap / 50) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold text-gray-900 min-w-[60px] text-right">
                  {gap.gap.toFixed(1)} pts
                </span>
              </div>

              {/* Quick Actions */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>💡</span>
                  <span>
                    {gap.gap >= 30 && 'Immediate training intervention recommended'}
                    {gap.gap >= 20 && gap.gap < 30 && 'Schedule team workshop or 1-on-1 coaching'}
                    {gap.gap >= 10 && gap.gap < 20 && 'Share best practices from top performers'}
                    {gap.gap < 10 && 'Monitor and provide ongoing support'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Focus on High-Impact Gaps</h4>
              <p className="text-xs text-blue-700">
                Address gaps affecting the most reps first. Use top performer best practices for faster improvement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
