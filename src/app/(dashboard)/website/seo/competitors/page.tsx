/**
 * Competitor SEO Analysis Page
 * Sprint 15: Analyze competitor domains, find keyword gaps, estimate costs, generate strategy
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import CompetitorAnalysisCard from '@/components/seo/CompetitorAnalysisCard';
import KeywordGapAnalysis from '@/components/seo/KeywordGapAnalysis';
import CostToCompete from '@/components/seo/CostToCompete';
import StrategyGenerator from '@/components/seo/StrategyGenerator';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { CompetitorEntry, DomainAnalysisResult } from '@/types/seo-analysis';
import {
  Search,
  Plus,
  Loader2,
  Users,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

interface AnalysisResponse {
  success: boolean;
  data?: DomainAnalysisResult;
  error?: string;
}

export default function CompetitorSEOPage() {
  const authFetch = useAuthFetch();
  const [domainInput, setDomainInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [yourKeywords, setYourKeywords] = useState<DomainAnalysisResult['topKeywords']>([]);
  const [yourDomainLoading, setYourDomainLoading] = useState(false);
  const [yourDomain, setYourDomain] = useState('');

  const analyzeDomain = useCallback(async (domain: string, keywordLimit?: number, noCache?: boolean) => {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase().trim();
    if (!cleanDomain) { return; }

    // Check for duplicate
    const existing = competitors.find(c => c.domain === cleanDomain);
    if (existing && !noCache && !keywordLimit) { return; }

    const id = existing?.id ?? `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Set status to analyzing
    setCompetitors(prev => {
      const withoutExisting = prev.filter(c => c.id !== id);
      return [...withoutExisting, {
        id,
        domain: cleanDomain,
        status: 'analyzing' as const,
        result: existing?.result ?? null,
        error: null,
        addedAt: existing?.addedAt ?? new Date().toISOString(),
        analyzedAt: null,
      }];
    });

    try {
      const response = await authFetch('/api/seo/domain-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: cleanDomain,
          ...(keywordLimit ? { keywordLimit } : {}),
          ...(noCache ? { noCache: true } : {}),
        }),
      });

      const data = await response.json() as AnalysisResponse;

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error ?? 'Analysis failed');
      }

      const analysisResult = data.data ?? null;
      setCompetitors(prev =>
        prev.map(c => c.id === id
          ? { ...c, status: 'complete' as const, result: analysisResult, analyzedAt: new Date().toISOString(), error: null }
          : c
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      logger.warn('Competitor analysis failed', { domain: cleanDomain, error: message });
      setCompetitors(prev =>
        prev.map(c => c.id === id
          ? { ...c, status: 'error' as const, error: message }
          : c
        )
      );
    }
  }, [authFetch, competitors]);

  const handleAddDomain = () => {
    if (domainInput.trim()) {
      void analyzeDomain(domainInput.trim());
      setDomainInput('');
    }
  };

  const handleBulkAdd = () => {
    const domains = bulkInput
      .split(/[,\n]/)
      .map(d => d.trim())
      .filter(d => d.length > 0);

    for (const domain of domains) {
      void analyzeDomain(domain);
    }
    setBulkInput('');
    setShowBulk(false);
  };

  const handleRemove = (id: string) => {
    setCompetitors(prev => prev.filter(c => c.id !== id));
    if (selectedCompetitor === id) {
      setSelectedCompetitor(null);
    }
  };

  const handleEnrich = (id: string) => {
    const comp = competitors.find(c => c.id === id);
    if (comp) {
      void analyzeDomain(comp.domain, 50);
    }
  };

  const handleRerun = (id: string) => {
    const comp = competitors.find(c => c.id === id);
    if (comp) {
      void analyzeDomain(comp.domain, undefined, true);
    }
  };

  const loadYourKeywords = async () => {
    if (!yourDomain.trim()) { return; }
    setYourDomainLoading(true);
    try {
      const response = await authFetch('/api/seo/domain-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: yourDomain.trim() }),
      });
      const data = await response.json() as AnalysisResponse;
      if (data.success && data.data) {
        setYourKeywords(data.data.topKeywords);
      }
    } catch (err) {
      logger.warn('Failed to load your keywords', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setYourDomainLoading(false);
    }
  };

  const selectedEntry = competitors.find(c => c.id === selectedCompetitor);
  const completedCompetitors = competitors.filter(c => c.status === 'complete');

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] p-8">
      <div>
        <SubpageNav items={[
          { label: 'SEO', href: '/website/seo' },
          { label: 'Competitors', href: '/website/seo/competitors' },
          { label: 'Domains', href: '/website/domains' },
          { label: 'Site Settings', href: '/website/settings' },
        ]} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Competitor SEO Analysis</h1>
              <p className="text-[var(--color-text-secondary)]">Analyze competitor domains, find keyword gaps, and build your SEO strategy</p>
            </div>
          </div>
        </motion.div>

        {/* Domain Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleAddDomain(); } }}
                  placeholder="Enter competitor domain (e.g. competitor.com)"
                  className="flex-1 px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
                <button
                  onClick={handleAddDomain}
                  disabled={!domainInput.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                >
                  <Search className="w-5 h-5" />
                  Analyze
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="text-sm text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              {showBulk ? 'Hide' : 'Bulk add domains'}
            </button>
          </div>

          {showBulk && (
            <div className="mt-4 space-y-3">
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Enter domains separated by commas or newlines&#10;e.g. competitor1.com, competitor2.com"
                rows={3}
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm"
              />
              <button
                onClick={handleBulkAdd}
                disabled={!bulkInput.trim()}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
              >
                Analyze All
              </button>
            </div>
          )}
        </motion.div>

        {/* Competitor List */}
        {competitors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="flex flex-wrap gap-2 mb-4">
              {competitors.map(comp => (
                <button
                  key={comp.id}
                  onClick={() => setSelectedCompetitor(comp.id === selectedCompetitor ? null : comp.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    selectedCompetitor === comp.id
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent'
                      : 'bg-surface-paper text-[var(--color-text-secondary)] border-border-light hover:border-primary/50'
                  }`}
                >
                  {comp.status === 'analyzing' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {comp.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-400" />}
                  {comp.domain}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(comp.id); }}
                    className="ml-1 opacity-50 hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Selected Competitor Detail */}
        {selectedEntry?.status === 'complete' && selectedEntry.result && (
          <div className="space-y-6">
            <CompetitorAnalysisCard
              result={selectedEntry.result}
              onEnrich={() => handleEnrich(selectedEntry.id)}
              onRerun={() => handleRerun(selectedEntry.id)}
              isEnriching={competitors.some(c => c.id === selectedEntry.id && c.status === 'analyzing')}
            />

            {/* Your Domain for Gap Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6"
            >
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Your Domain (for Gap Analysis)</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={yourDomain}
                  onChange={(e) => setYourDomain(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { void loadYourKeywords(); } }}
                  placeholder="yourdomain.com"
                  className="flex-1 px-4 py-2.5 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <button
                  onClick={() => void loadYourKeywords()}
                  disabled={!yourDomain.trim() || yourDomainLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
                >
                  {yourDomainLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load Keywords'}
                </button>
              </div>
            </motion.div>

            {/* Keyword Gap Analysis */}
            {yourKeywords.length > 0 && (
              <>
                <KeywordGapAnalysis
                  yourKeywords={yourKeywords}
                  competitorKeywords={selectedEntry.result.topKeywords}
                  competitorDomain={selectedEntry.domain}
                />

                {/* Cost to Compete */}
                <CostToCompete
                  gapKeywords={selectedEntry.result.topKeywords.filter(
                    k => !new Set(yourKeywords.map(yk => yk.keyword.toLowerCase())).has(k.keyword.toLowerCase())
                  )}
                  competitorDomain={selectedEntry.domain}
                />
              </>
            )}

            {/* Strategy Generator */}
            <StrategyGenerator
              competitorDomain={selectedEntry.domain}
              competitorResult={selectedEntry.result}
            />
          </div>
        )}

        {/* Error State */}
        {selectedEntry?.status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-red-500/30 p-6 text-center"
          >
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-[var(--color-text-primary)] font-semibold mb-1">Analysis Failed</p>
            <p className="text-sm text-[var(--color-text-disabled)]">{selectedEntry.error}</p>
            <button
              onClick={() => handleRerun(selectedEntry.id)}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Analyzing State */}
        {selectedEntry?.status === 'analyzing' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-12 text-center"
          >
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <p className="text-[var(--color-text-primary)] font-semibold">Analyzing {selectedEntry.domain}...</p>
            <p className="text-sm text-[var(--color-text-disabled)] mt-1">
              Fetching domain metrics, keywords, backlinks, and competitors
            </p>
          </motion.div>
        )}

        {/* Empty State */}
        {competitors.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border-2 border-dashed border-border-light p-12 text-center"
          >
            <Search className="w-12 h-12 text-[var(--color-text-disabled)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No Competitors Analyzed Yet</h3>
            <p className="text-sm text-[var(--color-text-disabled)] max-w-md mx-auto">
              Enter a competitor domain above to get a comprehensive SEO analysis including
              keyword rankings, backlink profile, and organic traffic estimates.
            </p>
          </motion.div>
        )}

        {/* Multi-competitor Summary (when no specific one is selected) */}
        {completedCompetitors.length > 1 && !selectedCompetitor && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {completedCompetitors.map(comp => comp.result && (
              <div
                key={comp.id}
                onClick={() => setSelectedCompetitor(comp.id)}
                className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 cursor-pointer hover:border-primary/50 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{comp.domain}</h3>
                  <span className="px-2 py-1 rounded-lg bg-surface-elevated text-xs font-semibold text-[var(--color-text-secondary)]">
                    Rank {comp.result.metrics.domainRank}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">
                      {comp.result.metrics.organicTraffic >= 1000
                        ? `${(comp.result.metrics.organicTraffic / 1000).toFixed(1)}K`
                        : comp.result.metrics.organicTraffic}
                    </div>
                    <div className="text-xs text-[var(--color-text-disabled)]">Traffic</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">
                      {comp.result.metrics.organicKeywords >= 1000
                        ? `${(comp.result.metrics.organicKeywords / 1000).toFixed(1)}K`
                        : comp.result.metrics.organicKeywords}
                    </div>
                    <div className="text-xs text-[var(--color-text-disabled)]">Keywords</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">
                      {comp.result.backlinkProfile.totalBacklinks >= 1000
                        ? `${(comp.result.backlinkProfile.totalBacklinks / 1000).toFixed(1)}K`
                        : comp.result.backlinkProfile.totalBacklinks}
                    </div>
                    <div className="text-xs text-[var(--color-text-disabled)]">Backlinks</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
