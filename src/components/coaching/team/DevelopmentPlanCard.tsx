/**
 * Development Plan Card Component
 * 
 * Displays team coaching priorities and at-risk reps
 */

'use client';

import React from 'react';

interface TeamPriority {
  area: string;
  importance: number;
  repsAffected: number;
  potentialImpact: string;
}

interface AtRiskRep {
  repId: string;
  repName: string;
  score: number;
  criticalAreas: string[];
}

interface DevelopmentPlanCardProps {
  priorities: TeamPriority[];
  atRiskReps: AtRiskRep[];
  totalReps: number;
  loading?: boolean;
}

/**
 * Development Plan Card Component
 */
export function DevelopmentPlanCard({ 
  priorities, 
  atRiskReps, 
  totalReps, 
  loading = false 
}: DevelopmentPlanCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-main rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-surface-elevated rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-surface-elevated rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Get priority color
  const getPriorityColor = (importance: number) => {
    if (importance >= 90) {return 'bg-red-500';}
    if (importance >= 80) {return 'bg-orange-500';}
    if (importance >= 70) {return 'bg-yellow-500';}
    return 'bg-blue-500';
  };

  // Get priority badge
  const getPriorityBadge = (importance: number) => {
    if (importance >= 90) {return { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200' };}
    if (importance >= 80) {return { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-200' };}
    if (importance >= 70) {return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };}
    return { label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  return (
    <div className="bg-surface-main rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Development Plan</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">Prioritized coaching areas for your team</p>
      </div>

      {/* At-Risk Reps Alert */}
      {atRiskReps.length > 0 && (
        <div className="mb-6">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">🚨</span>
              <div>
                <h4 className="text-sm font-semibold text-red-900 mb-1">
                  {atRiskReps.length} Rep{atRiskReps.length > 1 ? 's' : ''} Need Immediate Support
                </h4>
                <p className="text-xs text-red-700 mb-3">
                  Schedule 1-on-1 coaching sessions this week
                </p>
              </div>
            </div>

            {/* At-Risk Reps List */}
            <div className="space-y-2">
              {atRiskReps.map((rep) => (
                <div key={rep.repId} className="bg-surface-main rounded-lg p-3 border border-red-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h5 className="text-sm font-semibold text-[var(--color-text-primary)]">{rep.repName}</h5>
                      <p className="text-xs text-[var(--color-text-disabled)]">Performance Score: {rep.score.toFixed(0)}</p>
                    </div>
                    <button className="px-3 py-1 bg-error text-white text-xs font-medium rounded hover:bg-red-700 transition-colors">
                      Schedule 1-on-1
                    </button>
                  </div>
                  {rep.criticalAreas.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rep.criticalAreas.map((area, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Team Priorities */}
      <div>
        <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Team Coaching Priorities</h4>

        {priorities.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl mb-3 block">✅</span>
            <p className="text-[var(--color-text-secondary)]">Team is performing well</p>
            <p className="text-sm text-[var(--color-text-disabled)] mt-1">No critical coaching priorities identified</p>
          </div>
        ) : (
          <div className="space-y-3">
            {priorities.map((priority, idx) => {
              const badge = getPriorityBadge(priority.importance);
              const repsPercentage = (priority.repsAffected / totalReps) * 100;

              return (
                <div key={idx} className="border border-border-light rounded-lg p-4">
                  {/* Priority Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="text-sm font-semibold text-[var(--color-text-primary)]">{priority.area}</h5>
                      <p className="text-xs text-[var(--color-text-disabled)] mt-1">
                        {priority.repsAffected} rep{priority.repsAffected > 1 ? 's' : ''} affected ({repsPercentage.toFixed(0)}%)
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Importance Bar */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-disabled)] min-w-[80px]">Importance:</span>
                      <div className="flex-1 bg-surface-elevated rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getPriorityColor(priority.importance)}`}
                          style={{ width: `${priority.importance}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] min-w-[40px] text-right">
                        {priority.importance.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Potential Impact */}
                  <div className="bg-surface-elevated rounded p-3 border border-primary">
                    <div className="text-xs text-[var(--color-text-primary)]">
                      <span className="font-semibold">Impact: </span>
                      {priority.potentialImpact}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-3 flex items-center gap-2">
                    <button className="text-xs text-primary hover:text-primary-light font-medium flex items-center gap-1">
                      <span>📚</span>
                      <span>Create Training Plan</span>
                    </button>
                    <button className="text-xs text-success hover:text-green-700 font-medium flex items-center gap-1">
                      <span>👥</span>
                      <span>Schedule Workshop</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Summary */}
      <div className="mt-6 pt-6 border-t border-border-light">
        <div className="bg-gradient-to-r from-primary to-secondary rounded-lg p-4 border border-primary">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">Recommended Next Steps</h4>
              <ul className="text-xs text-white space-y-1">
                {atRiskReps.length > 0 && (
                  <li>• Schedule 1-on-1s with {atRiskReps.length} at-risk rep{atRiskReps.length > 1 ? 's' : ''} this week</li>
                )}
                {priorities.length > 0 && (
                  <li>• Address &quot;{priorities[0].area}&quot; affecting {priorities[0].repsAffected} rep{priorities[0].repsAffected > 1 ? 's' : ''}</li>
                )}
                {priorities.length > 1 && (
                  <li>• Create team workshop for &quot;{priorities[1].area}&quot;</li>
                )}
                <li>• Review progress in 2 weeks and reassess priorities</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
