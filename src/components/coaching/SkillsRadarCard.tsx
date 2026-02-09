/**
 * Skills Radar Card Component
 * 
 * Visual representation of skill scores across all competencies
 */

'use client';

import React from 'react';
import type { SkillScores } from '@/lib/coaching/types';

interface SkillsRadarCardProps {
  skills: SkillScores;
  loading?: boolean;
}

/**
 * Skills Radar Card Component
 */
export function SkillsRadarCard({ skills, loading = false }: SkillsRadarCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-main rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-surface-elevated rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-surface-elevated rounded"></div>
      </div>
    );
  }

  // Convert skills object to array
  const skillsArray = Object.entries(skills).map(([name, score]) => ({
    name: name.replace(/([A-Z])/g, ' $1').trim(),
    score: Math.round(typeof score === 'number' ? score : 0),
    key: name
  }));

  // Sort by score descending
  const sortedSkills = [...skillsArray].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-surface-main rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Skills Assessment</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">Performance across 12 key competencies</p>
      </div>

      {/* Skills Grid */}
      <div className="space-y-3">
        {sortedSkills.map((skill) => (
          <SkillBar key={skill.key} name={skill.name} score={skill.score} />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-border-light">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-[var(--color-text-secondary)]">0-40: Needs Focus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-[var(--color-text-secondary)]">40-70: Developing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-[var(--color-text-secondary)]">70-100: Proficient</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skill Bar Component
 */
interface SkillBarProps {
  name: string;
  score: number;
}

function SkillBar({ name, score }: SkillBarProps) {
  // Get color based on score
  const getColor = (score: number) => {
    if (score >= 70) {return 'bg-green-500';}
    if (score >= 40) {return 'bg-yellow-500';}
    return 'bg-red-500';
  };

  // Get text color
  const getTextColor = (score: number) => {
    if (score >= 70) {return 'text-green-700';}
    if (score >= 40) {return 'text-yellow-700';}
    return 'text-red-700';
  };

  return (
    <div className="flex items-center gap-3">
      {/* Skill Name */}
      <div className="w-40 flex-shrink-0">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{name}</span>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 bg-surface-elevated rounded-full h-6 relative overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(score)}`}
          style={{ width: `${score}%` }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-semibold ${getTextColor(score)}`}>
            {score}
          </span>
        </div>
      </div>
    </div>
  );
}
