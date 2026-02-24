'use client';

import React, { useState, useMemo } from 'react';
import type { DomainAnalysisResult } from '@/types/seo-analysis';
import { ArrowLeftRight, Filter, ArrowUpDown } from 'lucide-react';

interface KeywordGapAnalysisProps {
  yourKeywords: DomainAnalysisResult['topKeywords'];
  competitorKeywords: DomainAnalysisResult['topKeywords'];
  competitorDomain: string;
}

type SortField = 'keyword' | 'position' | 'searchVolume' | 'estimatedTraffic' | 'cpc';
type SortDirection = 'asc' | 'desc';

function formatNumber(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)}K`; }
  return n.toString();
}

export default function KeywordGapAnalysis({
  yourKeywords,
  competitorKeywords,
  competitorDomain,
}: KeywordGapAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'gaps' | 'shared' | 'unique'>('gaps');
  const [sortField, setSortField] = useState<SortField>('searchVolume');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [minVolume, setMinVolume] = useState(0);

  const yourKeywordSet = useMemo(
    () => new Set(yourKeywords.map(k => k.keyword.toLowerCase())),
    [yourKeywords]
  );
  const competitorKeywordSet = useMemo(
    () => new Set(competitorKeywords.map(k => k.keyword.toLowerCase())),
    [competitorKeywords]
  );

  const gaps = useMemo(
    () => competitorKeywords.filter(k => !yourKeywordSet.has(k.keyword.toLowerCase())),
    [competitorKeywords, yourKeywordSet]
  );
  const shared = useMemo(
    () => competitorKeywords.filter(k => yourKeywordSet.has(k.keyword.toLowerCase())),
    [competitorKeywords, yourKeywordSet]
  );
  const unique = useMemo(
    () => yourKeywords.filter(k => !competitorKeywordSet.has(k.keyword.toLowerCase())),
    [yourKeywords, competitorKeywordSet]
  );

  const activeData = activeTab === 'gaps' ? gaps : activeTab === 'shared' ? shared : unique;

  const filtered = useMemo(() => {
    let data = activeData.filter(k => k.searchVolume >= minVolume);
    data = [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return data;
  }, [activeData, minVolume, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const tabs = [
    { key: 'gaps' as const, label: `Gaps (${gaps.length})`, description: 'Keywords they rank for, you don\'t' },
    { key: 'shared' as const, label: `Shared (${shared.length})`, description: 'Keywords you both rank for' },
    { key: 'unique' as const, label: `Your Unique (${unique.length})`, description: 'Keywords only you rank for' },
  ];

  return (
    <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <ArrowLeftRight className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Keyword Gap Analysis</h3>
          <p className="text-xs text-[var(--color-text-disabled)]">vs {competitorDomain}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                : 'bg-surface-elevated text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-disabled)]">
          <Filter className="w-4 h-4" />
          <span>Min Volume:</span>
          <input
            type="number"
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value) || 0)}
            className="w-24 px-2 py-1 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm"
            min={0}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--color-text-disabled)] text-xs border-b border-border-light">
                {([
                  ['keyword', 'Keyword', 'text-left'],
                  ['position', 'Position', 'text-right'],
                  ['searchVolume', 'Volume', 'text-right'],
                  ['estimatedTraffic', 'Traffic', 'text-right'],
                  ['cpc', 'CPC', 'text-right'],
                ] as const).map(([field, label, align]) => (
                  <th
                    key={field}
                    className={`${align} pb-2 px-2 cursor-pointer hover:text-[var(--color-text-secondary)] select-none`}
                    onClick={() => handleSort(field)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortField === field && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 25).map((kw, i) => (
                <tr key={i} className="border-b border-border-light/50 last:border-0">
                  <td className="py-2 px-2 text-[var(--color-text-primary)] truncate max-w-[250px]">{kw.keyword}</td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">{kw.position}</td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">{formatNumber(kw.searchVolume)}</td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">{formatNumber(kw.estimatedTraffic)}</td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">${kw.cpc.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 25 && (
            <p className="text-xs text-[var(--color-text-disabled)] mt-2 text-center">
              Showing 25 of {filtered.length} keywords
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-disabled)] text-sm">
          No keywords found for this filter
        </div>
      )}
    </div>
  );
}
