'use client';

import React from 'react';
import type { DomainAnalysisResult } from '@/types/seo-analysis';
import {
  Globe,
  TrendingUp,
  Key,
  Link2,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface CompetitorAnalysisCardProps {
  result: DomainAnalysisResult;
  onEnrich: () => void;
  onRerun: () => void;
  isEnriching: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}K`; }
  return n.toString();
}

function getRankBadgeColor(rank: number): string {
  if (rank >= 70) { return 'bg-green-500/20 text-green-400 border-green-500/30'; }
  if (rank >= 40) { return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'; }
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

export default function CompetitorAnalysisCard({
  result,
  onEnrich,
  onRerun,
  isEnriching,
}: CompetitorAnalysisCardProps) {
  return (
    <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{result.domain}</h3>
            <p className="text-xs text-[var(--color-text-disabled)]">
              Analyzed {new Date(result.analysisDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${getRankBadgeColor(result.metrics.domainRank)}`}>
          Rank {result.metrics.domainRank}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-surface-elevated border border-border-light p-4 text-center">
          <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-[var(--color-text-primary)]">{formatNumber(result.metrics.organicTraffic)}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Organic Traffic</div>
        </div>
        <div className="rounded-xl bg-surface-elevated border border-border-light p-4 text-center">
          <Key className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-[var(--color-text-primary)]">{formatNumber(result.metrics.organicKeywords)}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Keywords</div>
        </div>
        <div className="rounded-xl bg-surface-elevated border border-border-light p-4 text-center">
          <Link2 className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-[var(--color-text-primary)]">{formatNumber(result.backlinkProfile.totalBacklinks)}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Backlinks</div>
        </div>
      </div>

      {/* Top Keywords Table */}
      {result.topKeywords.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Key className="w-4 h-4" /> Top Keywords
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--color-text-disabled)] text-xs border-b border-border-light">
                  <th className="text-left pb-2 pr-3">Keyword</th>
                  <th className="text-right pb-2 px-3">Pos</th>
                  <th className="text-right pb-2 px-3">Volume</th>
                  <th className="text-right pb-2 px-3">Traffic</th>
                  <th className="text-right pb-2 pl-3">CPC</th>
                </tr>
              </thead>
              <tbody>
                {result.topKeywords.slice(0, 10).map((kw, i) => (
                  <tr key={i} className="border-b border-border-light/50 last:border-0">
                    <td className="py-2 pr-3 text-[var(--color-text-primary)] truncate max-w-[200px]">{kw.keyword}</td>
                    <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]">{kw.position}</td>
                    <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]">{formatNumber(kw.searchVolume)}</td>
                    <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]">{formatNumber(kw.estimatedTraffic)}</td>
                    <td className="py-2 pl-3 text-right text-[var(--color-text-secondary)]">${kw.cpc.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backlink Profile Summary */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4" /> Backlink Profile
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--color-text-primary)]">{formatNumber(result.backlinkProfile.totalReferringDomains)}</div>
            <div className="text-xs text-[var(--color-text-disabled)]">Referring Domains</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">{formatNumber(result.backlinkProfile.dofollow)}</div>
            <div className="text-xs text-[var(--color-text-disabled)]">Dofollow</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-400">{formatNumber(result.backlinkProfile.nofollow)}</div>
            <div className="text-xs text-[var(--color-text-disabled)]">Nofollow</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-400">{formatNumber(result.backlinkProfile.brokenBacklinks)}</div>
            <div className="text-xs text-[var(--color-text-disabled)]">Broken</div>
          </div>
        </div>
      </div>

      {/* Organic Competitors */}
      {result.competitors.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Organic Competitors</h4>
          <div className="flex flex-wrap gap-2">
            {result.competitors.slice(0, 6).map((comp, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-light text-xs text-[var(--color-text-secondary)]"
              >
                <ExternalLink className="w-3 h-3" />
                {comp.domain}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Executive Summary */}
      {result.summary && (
        <div className="rounded-xl bg-surface-elevated border border-border-light p-4">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onEnrich}
          disabled={isEnriching}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
        >
          <Sparkles className="w-4 h-4" />
          {isEnriching ? 'Enriching...' : 'Enrich (50 keywords)'}
        </button>
        <button
          onClick={onRerun}
          disabled={isEnriching}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border-light hover:bg-surface-elevated text-[var(--color-text-secondary)] text-sm font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Re-run
        </button>
      </div>
    </div>
  );
}
