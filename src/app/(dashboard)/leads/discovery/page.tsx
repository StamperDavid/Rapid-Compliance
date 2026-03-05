'use client';

/**
 * Discovery Dashboard Page
 *
 * Start discovery batches, review results, approve/reject, and convert to CRM leads.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import SubpageNav from '@/components/ui/SubpageNav';
import { LEADS_TABS } from '@/lib/constants/subpage-nav';
import DiscoveryResultDetail from '@/components/leads/DiscoveryResultDetail';
import {
  Compass,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface IcpProfile {
  id: string;
  name: string;
  isActive: boolean;
}

interface DiscoveryBatch {
  id: string;
  icpProfileId: string;
  icpProfileName: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  searchCriteria: { keywords: string[]; maxResults: number };
  totalFound: number;
  totalScored: number;
  totalApproved: number;
  totalRejected: number;
  totalConverted: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface DiscoveryResult {
  id: string;
  batchId: string;
  icpProfileId: string;
  companyData: Record<string, unknown>;
  icpScore: number;
  icpScoreBreakdown: Record<string, number>;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  reviewedBy?: string;
  leadId?: string;
}

interface ApiBatchListResponse {
  batches: DiscoveryBatch[];
}

interface ApiBatchDetailResponse {
  batch: DiscoveryBatch;
  results: DiscoveryResult[];
}

interface ApiProfileListResponse {
  profiles: IcpProfile[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  queued: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  approved: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  converted: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
};

export default function DiscoveryPage() {
  const authFetch = useAuthFetch();

  const [batches, setBatches] = useState<DiscoveryBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<DiscoveryResult | null>(null);
  const [profiles, setProfiles] = useState<IcpProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Start modal state
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [keywords, setKeywords] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [isStarting, setIsStarting] = useState(false);

  // Selection state for bulk actions
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());

  const fetchBatches = useCallback(async () => {
    try {
      const res = await authFetch('/api/leads/discovery');
      const data = (await res.json()) as ApiBatchListResponse;
      setBatches(data.batches ?? []);
    } catch (error) {
      logger.error('Failed to fetch batches', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await authFetch('/api/leads/icp');
      const data = (await res.json()) as ApiProfileListResponse;
      setProfiles(data.profiles ?? []);
      const active = data.profiles?.find((p: IcpProfile) => p.isActive);
      if (active) {setSelectedProfileId(active.id);}
    } catch (error) {
      logger.error('Failed to fetch profiles', error instanceof Error ? error : new Error(String(error)));
    }
  }, [authFetch]);

  const fetchResults = useCallback(async (batchId: string) => {
    setIsLoadingResults(true);
    try {
      const url = statusFilter !== 'all' ? `/api/leads/discovery/${batchId}?status=${statusFilter}` : `/api/leads/discovery/${batchId}`;
      const res = await authFetch(url);
      const data = (await res.json()) as ApiBatchDetailResponse;
      setResults(data.results ?? []);
    } catch (error) {
      logger.error('Failed to fetch results', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingResults(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => { void fetchBatches(); void fetchProfiles(); }, [fetchBatches, fetchProfiles]);
  useEffect(() => { if (selectedBatchId) {void fetchResults(selectedBatchId);} }, [selectedBatchId, fetchResults]);

  const handleStart = async () => {
    if (!selectedProfileId || !keywords.trim()) {return;}
    setIsStarting(true);
    try {
      await authFetch('/api/leads/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icpProfileId: selectedProfileId,
          searchCriteria: {
            keywords: keywords.split('\n').map(k => k.trim()).filter(Boolean),
            maxResults,
          },
        }),
      });
      setShowStartModal(false);
      setKeywords('');
      void fetchBatches();
    } catch (error) {
      logger.error('Failed to start discovery', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsStarting(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject', resultId: string) => {
    try {
      await authFetch(`/api/leads/discovery/${selectedBatchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resultId }),
      });
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
    } catch (error) {
      logger.error('Action failed', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleConvert = async (resultId: string) => {
    try {
      await authFetch(`/api/leads/discovery/${selectedBatchId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'converted' } : r));
    } catch (error) {
      logger.error('Convert failed', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedResults.size === 0) {return;}
    try {
      await authFetch(`/api/leads/discovery/${selectedBatchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-approve', resultIds: Array.from(selectedResults) }),
      });
      setResults(prev => prev.map(r => selectedResults.has(r.id) ? { ...r, status: 'approved' } : r));
      setSelectedResults(new Set());
    } catch (error) {
      logger.error('Bulk approve failed', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleBulkConvert = async () => {
    const approvedSelected = results.filter(r => selectedResults.has(r.id) && r.status === 'approved').map(r => r.id);
    if (approvedSelected.length === 0) {return;}
    try {
      await authFetch(`/api/leads/discovery/${selectedBatchId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultIds: approvedSelected }),
      });
      setResults(prev => prev.map(r => approvedSelected.includes(r.id) ? { ...r, status: 'converted' } : r));
      setSelectedResults(new Set());
    } catch (error) {
      logger.error('Bulk convert failed', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);} else {next.add(id);}
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(results.map(r => r.id)));
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) {return 'text-green-400';}
    if (score >= 40) {return 'text-yellow-400';}
    return 'text-red-400';
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Lead Discovery</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">Find companies matching your ICP and review them before adding to CRM</p>
          </div>
        </div>
        <button
          onClick={() => setShowStartModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Start Discovery
        </button>
      </motion.div>

      <SubpageNav items={LEADS_TABS} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Batch List */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Discovery Batches</span>
              <button onClick={() => void fetchBatches()} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
            ) : batches.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-sm">No discovery batches yet. Start your first search.</div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                {batches.map(batch => {
                  const colors = STATUS_COLORS[batch.status] ?? STATUS_COLORS.queued;
                  return (
                    <button
                      key={batch.id}
                      onClick={() => { setSelectedBatchId(batch.id); setSelectedResults(new Set()); }}
                      className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${selectedBatchId === batch.id ? 'bg-white/10 border-l-2 border-cyan-500' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white truncate">{batch.icpProfileName}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                          {batch.status}
                        </span>
                      </div>
                      <div className="text-xs text-white/40">
                        {batch.searchCriteria.keywords.slice(0, 2).join(', ')}
                        {batch.searchCriteria.keywords.length > 2 && ` +${batch.searchCriteria.keywords.length - 2}`}
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px] text-white/30">
                        <span>{batch.totalScored} found</span>
                        <span>{batch.totalApproved} approved</span>
                        <span>{batch.totalConverted} converted</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {!selectedBatchId ? (
            <div className="rounded-xl border border-white/10 p-12 flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <Search className="w-12 h-12 text-white/20 mb-4" />
              <p className="text-white/40 text-sm">Select a batch to view discovery results</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Batch Summary */}
              {selectedBatch && (
                <div className="rounded-xl border border-white/10 p-4 flex items-center justify-between" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <div>
                    <span className="text-white font-medium">{selectedBatch.icpProfileName}</span>
                    <span className="text-white/30 mx-2">&bull;</span>
                    <span className="text-white/50 text-sm">{selectedBatch.totalScored} results</span>
                  </div>
                  {selectedBatch.status === 'running' && (
                    <div className="flex items-center gap-2 text-blue-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running...
                    </div>
                  )}
                </div>
              )}

              {/* Filters + Bulk Actions */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-white/40" />
                  {['all', 'pending', 'approved', 'rejected', 'converted'].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        statusFilter === s ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                {selectedResults.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">{selectedResults.size} selected</span>
                    <button
                      onClick={() => void handleBulkApprove()}
                      className="px-3 py-1 rounded-lg text-xs bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                    >
                      Approve All
                    </button>
                    <button
                      onClick={() => void handleBulkConvert()}
                      className="px-3 py-1 rounded-lg text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 transition-colors"
                    >
                      Convert to CRM
                    </button>
                  </div>
                )}
              </div>

              {/* Results Table */}
              {isLoadingResults ? (
                <div className="rounded-xl border border-white/10 p-12 flex justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-xl border border-white/10 p-12 text-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">
                    {selectedBatch?.status === 'running' ? 'Discovery is running... results will appear shortly.' : 'No results found for this filter.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  {/* Table Header */}
                  <div className="grid grid-cols-[40px_1fr_120px_80px_100px_140px] items-center gap-2 px-4 py-2 border-b border-white/10 text-xs text-white/40 font-medium">
                    <div>
                      <input
                        type="checkbox"
                        checked={selectedResults.size === results.length && results.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-white/20 bg-white/5 accent-cyan-500"
                      />
                    </div>
                    <div>Company</div>
                    <div>Industry</div>
                    <div className="text-center">Score</div>
                    <div className="text-center">Status</div>
                    <div className="text-right">Actions</div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                    {results.map(result => {
                      const company = result.companyData;
                      const colors = STATUS_COLORS[result.status] ?? STATUS_COLORS.pending;
                      return (
                        <div
                          key={result.id}
                          className="grid grid-cols-[40px_1fr_120px_80px_100px_140px] items-center gap-2 px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          <div>
                            <input
                              type="checkbox"
                              checked={selectedResults.has(result.id)}
                              onChange={() => toggleSelect(result.id)}
                              className="rounded border-white/20 bg-white/5 accent-cyan-500"
                            />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => setSelectedResult(result)}
                              className="text-sm font-medium text-white hover:text-cyan-300 transition-colors truncate block text-left"
                            >
                              {(company.companyName as string) ?? (company.domain as string) ?? 'Unknown'}
                            </button>
                            <span className="text-[11px] text-white/30 truncate block">{company.domain as string}</span>
                          </div>
                          <div className="text-xs text-white/50 truncate">{(company.industry as string) ?? '—'}</div>
                          <div className={`text-center text-sm font-bold ${scoreColor(result.icpScore)}`}>
                            {result.icpScore}
                          </div>
                          <div className="text-center">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                              {result.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            {result.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => void handleAction('approve', result.id)}
                                  className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => void handleAction('reject', result.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                  title="Reject"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {result.status === 'approved' && (
                              <button
                                onClick={() => void handleConvert(result.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors text-xs"
                              >
                                <ArrowRight className="w-3 h-3" />
                                Convert
                              </button>
                            )}
                            {result.status === 'converted' && (
                              <span className="text-[10px] text-violet-400/60">In CRM</span>
                            )}
                            <button
                              onClick={() => setSelectedResult(result)}
                              className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                              title="View details"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Start Discovery Modal */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowStartModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4"
              style={{ backgroundColor: 'var(--color-bg-main)' }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-white">Start New Discovery</h2>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">ICP Profile</label>
                <select
                  value={selectedProfileId}
                  onChange={e => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                >
                  <option value="">Select a profile...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (Active)' : ''}</option>
                  ))}
                </select>
                {profiles.length === 0 && (
                  <p className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Create an ICP profile first
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Keywords / Company Names (one per line)</label>
                <textarea
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  rows={4}
                  placeholder={'SaaS companies in Austin\nFinTech startups\nShopify competitors'}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Max Results</label>
                <input
                  type="number"
                  value={maxResults}
                  onChange={e => setMaxResults(Math.min(100, Math.max(1, parseInt(e.target.value) || 20)))}
                  min={1}
                  max={100}
                  className="w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleStart()}
                  disabled={isStarting || !selectedProfileId || !keywords.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-xl transition-all disabled:opacity-50"
                >
                  {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
                  Start Discovery
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Detail Modal */}
      {selectedResult && (
        <DiscoveryResultDetail
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          onApprove={(id) => void handleAction('approve', id)}
          onReject={(id) => void handleAction('reject', id)}
          onConvert={(id) => void handleConvert(id)}
        />
      )}
    </div>
  );
}
