'use client';

import React from 'react';
import type { DomainAnalysisResult } from '@/types/seo-analysis';
import { DollarSign, Clock, FileText, Link2 } from 'lucide-react';

interface CostToCompeteProps {
  gapKeywords: DomainAnalysisResult['topKeywords'];
  competitorDomain: string;
}

function getDifficulty(volume: number, cpc: number): 'low' | 'medium' | 'high' {
  if (cpc > 5 || volume > 10000) { return 'high'; }
  if (cpc > 2 || volume > 3000) { return 'medium'; }
  return 'low';
}

function getContentCost(difficulty: 'low' | 'medium' | 'high'): number {
  const costs = { low: 200, medium: 500, high: 1000 };
  return costs[difficulty];
}

function getBacklinkCost(difficulty: 'low' | 'medium' | 'high'): number {
  const costs = { low: 100, medium: 200, high: 300 };
  return costs[difficulty];
}

function getBacklinksNeeded(difficulty: 'low' | 'medium' | 'high'): number {
  const counts = { low: 3, medium: 8, high: 15 };
  return counts[difficulty];
}

function getTimeToRank(difficulty: 'low' | 'medium' | 'high'): string {
  const times = { low: '1-3 months', medium: '3-6 months', high: '6-12 months' };
  return times[difficulty];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function CostToCompete({ gapKeywords, competitorDomain }: CostToCompeteProps) {
  const estimates = gapKeywords.slice(0, 20).map(kw => {
    const difficulty = getDifficulty(kw.searchVolume, kw.cpc);
    const contentCost = getContentCost(difficulty);
    const backlinksNeeded = getBacklinksNeeded(difficulty);
    const backlinkCostEach = getBacklinkCost(difficulty);
    const totalBacklinkCost = backlinksNeeded * backlinkCostEach;
    return {
      keyword: kw.keyword,
      volume: kw.searchVolume,
      difficulty,
      contentCost,
      backlinksNeeded,
      totalBacklinkCost,
      totalCost: contentCost + totalBacklinkCost,
      timeToRank: getTimeToRank(difficulty),
    };
  });

  const totalContentCost = estimates.reduce((sum, e) => sum + e.contentCost, 0);
  const totalBacklinkCost = estimates.reduce((sum, e) => sum + e.totalBacklinkCost, 0);
  const totalBudget = totalContentCost + totalBacklinkCost;

  const difficultyBreakdown = {
    low: estimates.filter(e => e.difficulty === 'low').length,
    medium: estimates.filter(e => e.difficulty === 'medium').length,
    high: estimates.filter(e => e.difficulty === 'high').length,
  };

  if (gapKeywords.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 text-center">
        <p className="text-[var(--color-text-disabled)] text-sm">
          No gap keywords to estimate costs for. Run a keyword gap analysis first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Cost to Compete</h3>
          <p className="text-xs text-[var(--color-text-disabled)]">Estimated investment to outrank {competitorDomain}</p>
        </div>
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4 text-center">
          <FileText className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <div className="text-xl font-bold text-[var(--color-text-primary)]">{formatCurrency(totalContentCost)}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Content Creation</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 p-4 text-center">
          <Link2 className="w-5 h-5 text-blue-400 mx-auto mb-2" />
          <div className="text-xl font-bold text-[var(--color-text-primary)]">{formatCurrency(totalBacklinkCost)}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Link Building</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-4 text-center">
          <DollarSign className="w-5 h-5 text-purple-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(totalBudget)}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Total Estimated Budget</div>
        </div>
      </div>

      {/* Difficulty Breakdown */}
      <div className="flex gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
          <Clock className="w-3 h-3" /> {difficultyBreakdown.low} Easy
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
          <Clock className="w-3 h-3" /> {difficultyBreakdown.medium} Medium
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <Clock className="w-3 h-3" /> {difficultyBreakdown.high} Hard
        </span>
      </div>

      {/* Per-keyword table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--color-text-disabled)] text-xs border-b border-border-light">
              <th className="text-left pb-2 pr-2">Keyword</th>
              <th className="text-center pb-2 px-2">Difficulty</th>
              <th className="text-right pb-2 px-2">Content</th>
              <th className="text-right pb-2 px-2">Backlinks</th>
              <th className="text-right pb-2 px-2">Total</th>
              <th className="text-right pb-2 pl-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((est, i) => (
              <tr key={i} className="border-b border-border-light/50 last:border-0">
                <td className="py-2 pr-2 text-[var(--color-text-primary)] truncate max-w-[180px]">{est.keyword}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    est.difficulty === 'low' ? 'bg-green-500/20 text-green-400' :
                    est.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {est.difficulty}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">{formatCurrency(est.contentCost)}</td>
                <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">{formatCurrency(est.totalBacklinkCost)}</td>
                <td className="py-2 px-2 text-right font-medium text-[var(--color-text-primary)]">{formatCurrency(est.totalCost)}</td>
                <td className="py-2 pl-2 text-right text-[var(--color-text-disabled)] text-xs">{est.timeToRank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
