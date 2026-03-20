'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Gauge, FileText, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SceneAutoGrade } from '@/types/scene-grading';

interface AutoGradeMetricsProps {
  autoGrade: SceneAutoGrade | null;
  status: 'pending' | 'grading' | 'completed' | 'failed' | null;
}

function scoreColor(score: number): string {
  if (score >= 90) { return 'text-green-400'; }
  if (score >= 70) { return 'text-amber-400'; }
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 90) { return 'bg-green-500/10'; }
  if (score >= 70) { return 'bg-amber-500/10'; }
  return 'bg-red-500/10';
}

export function AutoGradeMetrics({ autoGrade, status }: AutoGradeMetricsProps) {
  const [expanded, setExpanded] = useState(false);

  // Loading state
  if (status === 'grading' || status === 'pending') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded text-xs text-zinc-500">
        <div className="w-3 h-3 border-2 border-zinc-600 border-t-amber-400 rounded-full animate-spin" />
        <span>Grading scene...</span>
      </div>
    );
  }

  // Failed or no data
  if (status === 'failed' || !autoGrade) {
    return null;
  }

  const { scriptAccuracy, actualWpm, targetWpm, pacingScore, overallScore } = autoGrade;

  return (
    <div className="space-y-1">
      {/* Label */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
        <span>AI Scene Grade</span>
        <span>—</span>
        <span>How well the generated video matches the original script</span>
      </div>

      {/* Compact metrics row */}
      <div className="flex items-center gap-3 text-xs">
        {/* Overall score */}
        <div
          className={cn('flex items-center gap-1 px-2 py-0.5 rounded', scoreBg(overallScore))}
          title="Overall quality score (60% script accuracy + 20% pacing + 20% audio clarity)"
        >
          <Gauge className="w-3 h-3" />
          <span className={cn('font-medium', scoreColor(overallScore))}>{overallScore}%</span>
          <span className="text-zinc-600">overall</span>
        </div>

        {/* Script accuracy */}
        <div
          className="flex items-center gap-1 text-zinc-400"
          title="How much of the original script the actor actually spoke (word-for-word match)"
        >
          <FileText className="w-3 h-3" />
          <span className={scoreColor(scriptAccuracy)}>{scriptAccuracy}%</span>
          <span className="text-zinc-600">script match</span>
        </div>

        {/* WPM */}
        <div
          className="flex items-center gap-1 text-zinc-400"
          title={`Speaking speed: ${actualWpm} words/min actual vs ${targetWpm} words/min expected`}
        >
          <Timer className="w-3 h-3" />
          <span>{actualWpm}</span>
          <span className="text-zinc-600">/ {targetWpm} wpm</span>
        </div>

        {/* Pacing indicator */}
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-medium',
            pacingScore === 'good' ? 'bg-green-500/10 text-green-400' :
            pacingScore === 'too_fast' ? 'bg-red-500/10 text-red-400' :
            'bg-amber-500/10 text-amber-400',
          )}
          title={
            pacingScore === 'good' ? 'Speaking speed is within 30% of target' :
            pacingScore === 'too_fast' ? 'Speaking too fast — over 130% of target speed' :
            'Speaking too slow — under 70% of target speed'
          }
        >
          {pacingScore === 'good' ? 'Good pace' :
           pacingScore === 'too_fast' ? 'Too fast' : 'Too slow'}
        </span>

        {/* Expand toggle */}
        {(autoGrade.wordsDropped.length > 0 || autoGrade.wordsAdded.length > 0) && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-auto flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Show which words were dropped or added"
          >
            <span className="text-[10px]">Details</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 py-2 bg-zinc-800/30 rounded text-xs space-y-1">
          {autoGrade.wordsDropped.length > 0 && (
            <div>
              <span className="text-red-400 font-medium">Words dropped:</span>{' '}
              <span className="text-zinc-400">{autoGrade.wordsDropped.slice(0, 20).join(', ')}</span>
              {autoGrade.wordsDropped.length > 20 && (
                <span className="text-zinc-600"> +{autoGrade.wordsDropped.length - 20} more</span>
              )}
            </div>
          )}
          {autoGrade.wordsAdded.length > 0 && (
            <div>
              <span className="text-amber-400 font-medium">Words added:</span>{' '}
              <span className="text-zinc-400">{autoGrade.wordsAdded.slice(0, 20).join(', ')}</span>
              {autoGrade.wordsAdded.length > 20 && (
                <span className="text-zinc-600"> +{autoGrade.wordsAdded.length - 20} more</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
